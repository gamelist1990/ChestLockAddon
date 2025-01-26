import { world, PlayerData } from '../../backend';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { calculateUptime } from '../../module/Data';
import fetch from 'node-fetch';
import { banListCache, loadBanList, PlayerBAN, PlayerUNBAN } from '../ban';
import { ver } from '../../version';
import { ngrokUrls } from '../discord/discord';



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

// 認証情報ファイルのパス
const authDataPath = path.join(__dirname, 'auth_data.json');

// 認証情報を格納する変数
let authorizedUsers: AuthInfo[] = [];

// 認証情報をファイルから読み込む関数
function loadAuthData() {
    try {
        if (fs.existsSync(authDataPath)) {
            const data = fs.readFileSync(authDataPath, 'utf8');
            authorizedUsers = JSON.parse(data);
        } else {
            console.warn('auth_data.json が見つかりません。新しいファイルを作成します。');
            authorizedUsers = [];
            saveAuthData();
        }
    } catch (error) {
        console.error('認証情報の読み込みに失敗しました:', error);
        authorizedUsers = [];
    }
}

// 認証情報をファイルに保存する関数
function saveAuthData() {
    try {
        const data = JSON.stringify(authorizedUsers, null, 2);
        fs.writeFileSync(authDataPath, data, 'utf8');
    } catch (error) {
        console.error('認証情報の保存に失敗しました:', error);
    }
}

// ユーザー認証情報を追加する関数
export function addUser(username: string, password: string) {
    authorizedUsers.push({ username, password });
    saveAuthData();
}

// ユーザー認証情報を削除する関数
export function removeUser(username: string): boolean {
    const initialLength = authorizedUsers.length;
    authorizedUsers = authorizedUsers.filter(user => user.username !== username);
    saveAuthData();
    return authorizedUsers.length < initialLength;
}


// 認証情報を読み込む
loadAuthData();

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

app.get('/api', (req, res) => {
    res.sendFile(path.join(__dirname, 'status.html'));
});

app.get('/get_url', (req, res) => {
    let wsUrl2 = "ws://example.com";
    if (ngrokUrls) {
        wsUrl2 = ngrokUrls.web.url
    }
    res.send(wsUrl2);
});

app.get('/get_api', (req, res) => {
    let wsUrl2 = "ws://localhost:8000";
    let ngrokUrl = ngrokUrls?.api.url;
    if (ngrokUrl) {
        let wssUrl = ngrokUrl.replace("https", "wss");
        wsUrl2 = `${wssUrl}/minecraft`;
    }
    console.log("get_api Requested")
    res.send(wsUrl2);
});

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
            const trimmedAddress = address.trim();
            const isLocalhost = trimmedAddress.startsWith('localhost') || trimmedAddress.startsWith('127.0.0.1');

            if (isLocalhost) {
                // localhost の場合の処理: POSTリクエストで /get_api に送信
                try {
                    const response = await fetch(`http://${trimmedAddress}/get_api`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ address: trimmedAddress }),
                        timeout: 5000
                    });

                    if (response.ok) {
                        const data = await response.json();
                        //console.log(JSON.stringify(data))
                        results[trimmedAddress] = data; // データをそのまま結果に格納
                    } else {
                        results[trimmedAddress] = { status: 'offline', error: `Error from /get_api: ${response.status}` };
                    }
                } catch (error) {
                    results[trimmedAddress] = { status: 'offline', error: error.message };
                }
            } else {
                // 外部サーバーの場合の処理 (mcsrvstat API を使用)
                const apiResponse = await fetch(`https://api.mcsrvstat.us/2/${trimmedAddress}`);

                if (!apiResponse.ok) {
                    throw new Error(`API request for ${trimmedAddress} failed with status ${apiResponse.status}`);
                }

                const data = await apiResponse.json();

                if (data.online) {
                    results[trimmedAddress] = {
                        status: 'online',
                        players: {
                            online: data.players.online,
                            max: data.players.max,
                        },
                        motd: data.motd,
                        ping: data.ping || null,
                        server: {
                            version: data.version || null, // サーバーバージョンを追加
                        },
                    };
                } else {
                    results[trimmedAddress] = { status: 'offline' };
                }
            }
        });

        const settledPromises = await Promise.allSettled(promises);

        settledPromises.forEach((result) => {
            if (result.status === 'fulfilled') {
                // fulfilled の場合は、すでに results に結果が格納されているので何もしない
            } else {
                const address = result.reason.message.match(/API request for (.+?) failed/)
                    ?.[1]
                    || (result.reason.message.includes('localhost') || result.reason.message.includes('127.0.0.1'))
                    ? result.reason.message
                    : 'unknown';
                results[address] = { status: 'error', error: result.reason.message };
            }
        });

        res.json(results);
    } catch (error) {
        console.error('Status API error:', error);
        res.status(500).json({ error: 'Status API error' });
    }
});

app.post('/get_api', async (req, res) => {
    const { address } = req.body;
    if (!address) {
        res.status(400).json({ error: 'Address is required' });
        return;
    }
    let online = 0;

    if (world) {
        const playerDataObject = await world.getPlayerData();
        const playerDataArray = Object.values(playerDataObject);
        const onlinePlayers = playerDataArray.filter((player: PlayerData) => player.isOnline);
        online = onlinePlayers.length;
    }

    const serverData = {
        status: 'online',
        players: {
            online,
            max: 100,
        },
        motd: {
            raw: `WebSocket Server`,
            clean: `A WebSocket Server ${ver} is running`,
        },
        server: {
            version: `${ver}`
        }
    };

    res.json(serverData);
});

// BAN処理のエンドポイント
//@ts-ignore
app.post('/ban', async (req, res) => {
    // 認証情報の確認
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.warn(`未認証のリクエストが拒否されました: ${req.ip}`);
        return res.status(401).json({ success: false, error: '認証情報がありません' });
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = authorizedUsers.find(u => u.username === auth[0] && u.password === auth[1]);

    if (!user) {
        console.warn(`認証に失敗しました: ${req.ip}`);
        return res.status(403).json({ success: false, error: '認証に失敗しました' });
    }

    const { playerName, reason, duration } = req.body;
    const bannedBy = "Server"; // BAN実行者を "Server" に設定

    if (!playerName || !reason) {
        res.status(400).json({ success: false, error: 'プレイヤー名と理由が必要です' });
        return;
    }

    try {
        if (world) {
            // プレイヤー名からプレイヤーオブジェクトを取得
            const playerToBan = await world.getEntityByName(playerName);
            if (playerToBan) {
                await PlayerBAN(bannedBy, playerName, reason, `[${duration}]`);
                broadcast('banList', banListCache);
                res.json({ success: true });
            } else {
                res.status(404).json({ success: false, error: 'プレイヤーが見つかりません' });
            }
        }
    } catch (error) {
        console.error('BAN処理エラー:', error);
        res.status(500).json({ success: false, error: 'BAN処理エラー' });
    }
});

// Unban処理のエンドポイント
//@ts-ignore
app.post('/unban', async (req, res) => {
    // 認証情報の確認
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.warn(`未認証のリクエストが拒否されました: ${req.ip}`);
        return res.status(401).json({ success: false, error: '認証情報がありません' });
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = authorizedUsers.find(u => u.username === auth[0] && u.password === auth[1]);

    if (!user) {
        console.warn(`認証に失敗しました: ${req.ip}`);
        return res.status(403).json({ success: false, error: '認証に失敗しました' });
    }

    const { playerName } = req.body;
    const unbannedBy = "Server"; // Unban実行者を "Server" に設定

    if (!playerName) {
        res.status(400).json({ success: false, error: 'プレイヤー名が必要です' });
        return;
    }

    try {
        if (world) {
            // プレイヤー名からプレイヤーオブジェクトを取得
            await PlayerUNBAN(unbannedBy, playerName);
            broadcast('banList', banListCache);
            res.json({ success: true });

        }
    } catch (error) {
        console.error('Unban処理エラー:', error);
        res.status(500).json({ success: false, error: 'Unban処理エラー' });
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
        // BANリスト取得リクエストの処理
        if (isAuthenticated && data.type === 'getBanList') {
            sendDataToClient(ws, 'banList', banListCache);
        }
        // プレイヤーリスト取得リクエストの処理
        if (isAuthenticated && data.type === 'getPlayerList') {
            if (world) {
                const players = await world.getPlayers();
                sendDataToClient(ws, 'playerList', players.map(player => player.name));
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
    try {
        const players = await world.getPlayers();
        const onlinePlayersInfo = await Promise.all(
            players.map(async (player) => {
                return {
                    name: player.name,
                    uuid: player.uuid,
                    ping: player.ping,
                    position: player.position,
                };
            })
        );

        return onlinePlayersInfo;
    } catch (error) {
        console.error('プレイヤー情報の取得に失敗しました:', error);
        return [];
    }
}

// worldイベントの監視
if (world) {
    let serverStartTime = new Date();
    setInterval(async () => {
        broadcast('uptime', calculateUptime(serverStartTime));
        const onlinePlayers = await getOnlinePlayersInfo();
        broadcast('onlinePlayers', onlinePlayers);
        const load = await loadBanList();
        if (load) {
            broadcast('banList', banListCache);
        }
        let userData: PlayerData;
        const playerDataObject = await world.getPlayerData();
        const playerDataArray = Object.values(playerDataObject);
        userData = JSON.parse(JSON.stringify(playerDataArray));
        broadcast('playerData', userData);

    }, 1000);

    // プレイヤーが参加したときの処理
    world.on('playerJoin', async () => {
        const players = await world.getPlayers();
        broadcast('playerCount', players.length);
        broadcast('playerList', players.map(player => player.name));
    });

    // プレイヤーが退出したときの処理
    world.on('playerLeave', async () => {
        const players = await world.getPlayers();
        broadcast('playerCount', players.length);
        broadcast('playerList', players.map(player => player.name));
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