import { Player, world } from '../../backend';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { calculateUptime } from '../../module/Data';
import fetch from 'node-fetch'; // node-fetchをインポート

// .envファイルのパスを現在のディレクトリに設定
const serverEnvPath = path.resolve(__dirname, 'server.env');

// server.envファイルが存在するか確認し、なければ作成
if (!fs.existsSync(serverEnvPath)) {
    const sampleServerEnvContent = `HTTP_PORT=80\nAPI_SERVER_ADDRESSES=127.0.0.1,127.0.0.2\n`; // カンマ区切りで複数のアドレスを指定
    fs.writeFileSync(serverEnvPath, sampleServerEnvContent);
    console.warn('警告: server.envファイルが作成されました。HTTP_PORT と API_SERVER_ADDRESSES を適切な値に更新してください。');
}

dotenv.config({ path: serverEnvPath }); // server.env の読み込み

// HTTPサーバー関連の変数
const app = express();
const server = http.createServer(app);
const port = process.env.HTTP_PORT || 80;
let serverStartTime: Date | null = null;

// index.htmlのパス (同階層を想定)
const indexPath = path.join(__dirname, 'index.html');

// index.htmlが存在するか確認
if (!fs.existsSync(indexPath)) {
    console.error(`エラー: index.html が ${indexPath} に見つかりません。`);
    process.exit(1);
}

// 認証情報の型定義
interface AuthInfo {
    username: string;
    password: string;
}

// 認証情報を格納する変数 (簡易的な実装のため、本来はデータベース等を使用するべきです)
const authorizedUsers: AuthInfo[] = [
    { username: 'PEXkoukunn', password: '@gamelist1990' },
];

// ログイン状態を管理するマップ (ユーザー名とWebSocketの紐づけ)
const authenticatedClients = new Map<string, WebSocket>();

// WebSocketサーバーの作成
const wss = new WebSocketServer({ server });

// ルートの設定
app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// コンソールログを保存する配列
const consoleLogs: string[] = [];

// POSTリクエストのボディを解析するためのミドルウェア
app.use(express.json());

// ログインエンドポイント
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = authorizedUsers.find(u => u.username === username && u.password === password);

    if (user) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// Status APIのエンドポイント (複数サーバー対応、ping情報追加)
app.get('/status', async (req, res) => {
    const apiServerAddresses = process.env.API_SERVER_ADDRESSES;

    if (!apiServerAddresses) {
        res.status(500).json({ error: 'API_SERVER_ADDRESSES が設定されていません' });
        return;
    }

    const addresses = apiServerAddresses.split(',');
    const results: { [key: string]: any } = {};

    try {
        const promises = addresses.map(async (address) => {
            const apiResponse = await fetch(`https://api.mcsrvstat.us/2/${address.trim()}`) as any;

            if (!apiResponse.ok) {
                throw new Error(`API request for ${address} failed with status ${apiResponse.status}`);
            }

            return { address: address.trim(), data: await apiResponse.json() as any };
        });

        const settledPromises = await Promise.allSettled(promises);

        settledPromises.forEach((result) => {
            if (result.status === "fulfilled") {
                const { address, data } = result.value;

                if (data.online) {
                    results[address] = {
                        status: 'online',
                        players: {
                            online: data.players.online,
                            max: data.players.max
                        },
                        motd: data.motd,
                        // `ping` が存在する場合は追加
                        ping: data.ping || null
                    };
                } else {
                    results[address] = { status: 'offline' };
                }
            } else {
                const address = result.reason.message.match(/API request for (.+?) failed/)?.[1] || "unknown";
                results[address] = { status: 'error', error: result.reason.message };
            }
        });

        res.json(results);
    } catch (error) {
        console.error('Status API error:', error);
        res.status(500).json({ error: 'Status API error' });
    }
});

// WebSocketの接続処理
wss.on('connection', (ws: WebSocket) => {
    console.log('新しいクライアントが接続しました');

    let isAuthenticated = false; // 認証状態
    let username = ''; // 認証されたユーザー名

    // メッセージ受信時の処理
    ws.on('message', async (message: string) => {
        const data = JSON.parse(message);

        // 認証メッセージの処理
        if (data.type === 'authenticate') {
            const user = authorizedUsers.find(u => u.username === data.username && u.password === data.password);
            if (user) {
                isAuthenticated = true;
                username = data.username;
                authenticatedClients.set(username, ws);
                console.log(`クライアント ${username} が認証されました`);
                // 認証成功時に、既存の情報を送信
                sendDataToClient(ws, 'playerCount', world ? (await world.getPlayers()).length : 0);
                sendDataToClient(ws, 'console', consoleLogs.join('\n'));
                sendDataToClient(ws, 'uptime', serverStartTime ? calculateUptime(serverStartTime) : "不明");
            } else {
                console.log(`クライアント ${data.username} の認証に失敗しました`);
                ws.send(JSON.stringify({ type: 'error', message: '認証に失敗しました' }));
            }
        }

        

        // コマンドメッセージの処理 (認証済みの場合のみ)
        if (isAuthenticated && data.type === 'command') {
            console.log(`コマンドが実行されました: ${data.command}`);
            if (world) {
                // コマンド実行結果をコンソールとクライアントに送信
                const result = await world.runCommand(data.command);
                const logEntry = `> ${data.command}\n${JSON.stringify(result, null, 2)}\n`;
                consoleLogs.push(logEntry);
                if (consoleLogs.length > 100) {
                    consoleLogs.shift();
                }
                broadcast('console', logEntry);
            } else {
                console.warn("サーバーが起動していないため、コマンドを送信できませんでした。");
            }
        }
    });

    // 切断時の処理
    ws.on('close', () => {
        console.log(`クライアント ${username} が切断しました`);
        authenticatedClients.delete(username); // 認証情報を削除
    });
});

// データをクライアントに送信する関数
function sendDataToClient(client: WebSocket, type: string, data: any) {
    client.send(JSON.stringify({ type, data }));
}

async function getOnlinePlayersInfo() {
    if (!world) return [];
    const players = await world.getPlayers();
    const onlinePlayersInfo = await Promise.all(
        players.map(async (player) => {
            try {
                return {
                    name: player.name,
                    uuid: player.uuid,
                    position: player.position,
                };
            } catch (error) {
                console.error(`プレイヤー ${player.name} の位置情報の取得に失敗しました:`, error);
                return {
                    name: player.name,
                    uuid: player.uuid,
                    position: null,
                };
            }
        })
    );

    return onlinePlayersInfo;
}

// worldイベントの監視
if (world) {
    let serverStartTime = new Date();
    setInterval(async () => {
        broadcast('uptime', calculateUptime(serverStartTime));

        const onlinePlayers = await getOnlinePlayersInfo();
        broadcast('onlinePlayers', onlinePlayers);
    }, 1000);

    // プレイヤーが参加したときの処理
    world.on('playerJoin', async () => {
        const players = await world.getPlayers();
        broadcast('playerCount', players.length);
    });

    // プレイヤーが退出したときの処理
    world.on('playerLeave', async () => {
        const players = await world.getPlayers();
        broadcast('playerCount', players.length);
    });

    // サーバーからのメッセージをコンソールログに追加し、クライアントに送信
    world.on('serverLog', (log: string) => {
        consoleLogs.push(log);
        if (consoleLogs.length > 100) {
            consoleLogs.shift(); // ログが多すぎる場合は古いものを削除
        }
        broadcast('console', log);
    });

    // プレイヤーチャットをコンソールログに追加し、クライアントに送信
    world.on('playerChat', async (sender: string, message: string, type: string) => {
        if (type === "chat" && sender !== "外部") {
            const logEntry = `[プレイヤーチャット] ${sender}: ${message}\n`;
            consoleLogs.push(logEntry);
            if (consoleLogs.length > 100) {
                consoleLogs.shift();
            }
            broadcast('console', logEntry);
        }
    });
}

// 認証済みの全クライアントにデータを送信する関数
function broadcast(type: string, data: any) {
    authenticatedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            sendDataToClient(client, type, data);
        }
    });
}

// サーバーの起動
server.listen(port, () => {
    console.log(`HTTPサーバーがポート ${port} で起動しました。`);
});