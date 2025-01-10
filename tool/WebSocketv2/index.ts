import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import { measureMemory } from 'vm';

const defaultEnvContent = `# 自動的に.envファイルを作成しました\n
# ここに設定値を書き込んで下さい

ADMINUUID=['マイクラでの管理者のID']
ADMINNAME=['マイクラでの管理者のname']
SERVER_STATUS_INTERVAL=5000
WSS_URL_API_URL="WebSocketサーバーのURLを取得するAPIのURL"
`;

// 環境変数初期化
const createDefaultEnvFile = async (filePath: string) => {
    try {
        await fs.promises.writeFile(filePath, defaultEnvContent);
        console.log(`Created default .env file at ${filePath}`);
    } catch (error) {
        console.error(`Error creating default .env file:`, error);
        process.exit(1);
    }
};

const initEnv = async () => {
    const currentDirEnvPath = path.resolve(process.cwd(), '.env');

    try {
        await fs.promises.access(currentDirEnvPath);
        config({ path: currentDirEnvPath });
        console.log("環境変数を.envファイルから読み込みました。");
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            console.warn("システムまたは.envファイルから環境変数を読み込めませんでした。");
            createDefaultEnvFile(currentDirEnvPath);
            config({ path: currentDirEnvPath });
            console.warn("デフォルトの.envファイルを作成しました。設定値を入力して再起動してください。");
            process.exit(1);
        } else {
            console.error(".envファイルへのアクセス中にエラーが発生しました:", error);
            process.exit(1);
        }
    }

    const requiredVars = ["WSS_URL_API_URL"];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error(`必須の環境変数が設定されていません: ${missingVars.join(", ")}`);
        console.warn(".envファイルを編集し、必要な情報を設定してください。");
        process.exit(1);
    }
};

// 環境変数読み込み
initEnv();

// 定数
const SERVER_STATUS_INTERVAL = parseInt(process.env.SERVER_STATUS_INTERVAL || "5000", 10);
const serverStartTime = Date.now();
const WSS_URL_API_URL = process.env.WSS_URL_API_URL;
const ADMINUUIDs: string[] = process.env.ADMINUUID as any || [];
const ADMINNAMEs: string[] = process.env.ADMINNAME as any || [];

// グローバル変数
let isWorldLoaded = false;
let wss: any;
let ServerStauts: NodeJS.Timeout;

// isAdmin関数 (管理者権限チェック)
export const isAdmin = async (playerName: string): Promise<boolean> => {
    try {
        const world = server.getWorlds()[0];
        if (!world) return false;

        const res = await world.runCommand(`testfor "${playerName}"`);
        if (res.statusCode !== 0) return false;

        return ADMINUUIDs.includes(playerName) || ADMINNAMEs.includes(playerName);
    } catch (error) {
        console.error("権限検証エラー:", error);
        return false;
    }
};

// WebSocketサーバーのURLを取得する関数
async function getWssUrl(): Promise<string> {
    try {
        if (!WSS_URL_API_URL) {
            throw new Error('WSS_URL_API_URL is not defined');
        }
        const response = await axios.get(WSS_URL_API_URL);
        return response.data.wssUrl;
    } catch (error) {
        console.error('Error fetching WebSocket server URL:', error);
        throw error;
    }
}

// WebSocketサーバーに接続する関数
async function connectToWss(url: string) {
    const WebSocket = require('ws');
    wss = new WebSocket(url);

    wss.on('open', () => {
        console.log('Connected to WebSocket server./ 受信側サーバーに接続しました');
        sendStatus().catch(console.error);
    });

    wss.on('message', async (data: string) => {
        // console.log('Received message from WSS:', data);
        try {
            const message = JSON.parse(data);
            if (message.command) {
                const world = server.getWorlds()[0];
                if (world) {
                    if (message.command === "sendMessage") {
                        if (message.playerName) {
                            await world.sendMessage(message.message, message.playerName);
                        } else {
                            await world.sendMessage(message.message);
                        }
                    } else {
                        const commandResult = await world.runCommand(message.command);
                        // commandId を含めて結果を送信
                        sendDataToWss('commandResult', { result: commandResult, command: message.command, commandId: message.commandId });
                    }
                    if (message.event === 'getAllPlayersInfo') {
                        // 全プレイヤー情報のリクエストを処理
                        handleAllPlayersInfoRequest();
                    }
                } else {
                    console.error("World is not loaded yet. Cannot execute command.");
                }
            }
        } catch (error) {
            console.error('Error processing message from WSS:', error);
        }
    });

    wss.on('close', () => {
        console.log('Disconnected from WebSocket server.');
    });

    wss.on('error', (error: any) => {
        console.error('WebSocket error:', error);
    });
}

// WebSocketサーバーにデータを送信する関数
function sendDataToWss(event: string, data: any) {
    if (wss && wss.readyState === wss.OPEN) {
        wss.send(JSON.stringify({ event, data }));
    } else {
        console.error('WebSocket is not connected.');
    }
}

// ステータスを送信する関数
async function sendStatus() {
    const world = server.getWorlds()[0];
    const playerListResult = await world?.runCommand('list');
    const playerCount = playerListResult?.players.length ?? 0;

    const cpus = os.cpus();
    let totalCpuTime = 0;
    let totalIdleTime = 0;
    for (const cpu of cpus) {
        for (const type in cpu.times) {
            totalCpuTime += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdleTime += cpu.times.idle;
    }
    const cpuUsage = 100 - (100 * totalIdleTime / totalCpuTime);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);

    const serverUptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const days = Math.floor(serverUptime / (3600 * 24));
    const hours = Math.floor((serverUptime % (3600 * 24)) / 3600);
    const minutes = Math.floor((serverUptime % 3600) / 60);
    const seconds = serverUptime % 60;
    const uptimeString = `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;

    const loadavg = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadAverage = loadavg[0] / cpuCount;
    const loadStatus = loadAverage < 0.7 ? "低" : loadAverage < 1.0 ? "中" : "高";

    let serverPing: number;
    if (!isWorldLoaded) {
        serverPing = 999;
    } else {
        const wsping = world.ping;
        serverPing = wsping - 50;
    }

    const statusData = {
        uptime: uptimeString,
        playerCount: playerCount,
        cpuUsage: cpuUsage.toFixed(2),
        memoryUsage: memUsage,
        usedMemoryMB: Math.round(usedMem / 1024 / 1024),
        loadStatus: `${loadStatus} (${loadAverage.toFixed(2)})`,
        wsPing: serverPing,
        isWorldLoaded: isWorldLoaded,
    };

    sendDataToWss('serverStatus', statusData);
}

// Minecraftサーバー
export const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
});

// イベントハンドラー
server.events.on('serverOpen', async () => {
    console.log('Minecraft server is connected via websocket!');
    const wssUrl = await getWssUrl();
    await connectToWss(wssUrl);
});

server.events.on('worldAdd', async () => {
    isWorldLoaded = true;
    ServerStauts = setInterval(sendStatus, SERVER_STATUS_INTERVAL);
    sendDataToWss('worldAdd', {});
});

server.events.on('worldRemove', async () => {
    isWorldLoaded = false;
    clearInterval(ServerStauts);
    sendDataToWss('worldRemove', {});
});

// プレイヤー名抽出のためのキャッシュ
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};

// プレイヤー名をタグ付きの名前から抽出する関数
async function extractPlayerName(playerNameWithTags: string): Promise<{ name: string; uuid: string } | null> {
    // キャッシュをチェック
    for (const cachedName in playerNameCache) {
        if (playerNameWithTags.includes(cachedName)) {
            return playerNameCache[cachedName];
        }
    }

    // キャッシュにない場合は、ワールドにクエリを送信
    const world = server.getWorlds()[0];
    if (!world) return null;

    const playerListResult = await world.runCommand(`testfor @a`);
    if (playerListResult.statusCode !== 0 || !playerListResult.victim) {
        return null;
    }

    for (const realPlayerName of playerListResult.victim) {
        if (playerNameWithTags.includes(realPlayerName)) {
            const queryResult = await world.runCommand(`querytarget @a[name="${realPlayerName}"]`);
            if (queryResult.statusCode === 0 && queryResult.details !== "[]") {
                const playerData = JSON.parse(queryResult.details);
                if (playerData && playerData.length > 0) {
                    const playerInfo = { name: realPlayerName, uuid: playerData[0].uniqueId };
                    // キャッシュに保存
                    playerNameCache[realPlayerName] = playerInfo;
                    return playerInfo;
                }
            }
        }
    }

    return null;
}

async function handleAllPlayersInfoRequest() {
    const world = server.getWorlds()[0];
    if (!world) return;

    try {
        const playerListResult = await world.runCommand('list');
        if (playerListResult.statusCode !== 0 || !playerListResult.players) {
            console.error('Error fetching player list');
            return;
        }

        const playersInfo: { name: string; uuid: string }[] = [];
        for (const playerName of playerListResult.players) {
            const queryResult = await world.runCommand(`querytarget @a[name="${playerName}"]`);
            if (queryResult.statusCode === 0 && queryResult.details !== "[]") {
                const playerData = JSON.parse(queryResult.details);
                if (playerData && playerData.length > 0) {
                    playersInfo.push({ name: playerName, uuid: playerData[0].uniqueId as string });
                }
            }
        }

        sendDataToWss('allPlayersInfoResponse', playersInfo);
    } catch (error) {
        console.error('Error fetching all players info:', error);
    }
}

server.events.on('playerJoin', async (event) => {
    const playerInfo = await extractPlayerName(event.players[0]);
    if (playerInfo) {
        sendDataToWss('playerJoin', { player: playerInfo.name, uuid: playerInfo.uuid });
    } else {
        sendDataToWss('playerJoin', { player: event.players, uuid: null }); // プレイヤー名が抽出できない場合、UUIDはnullとする
    }
});

server.events.on('playerLeave', async (event) => {
    const playerInfo = await extractPlayerName(event.players[0]);
    if (playerInfo) {
        sendDataToWss('playerLeave', { player: playerInfo.name, uuid: playerInfo.uuid });
    } else {
        sendDataToWss('playerLeave', { player: event.players, uuid: null }); // プレイヤー名が抽出できない場合、UUIDはnullとする
    }
});

server.events.on('playerChat', async (event) => {
    const { sender, message, type } = event;
    if (sender === 'External') return;
    sendDataToWss('playerChat', { sender, message, type });
});

// プロセス終了時の処理
async function handleShutdown(signal: string) {
    console.log(`Received ${signal}. Process Clear.`);
    clearInterval(ServerStauts);
    try {
        sendDataToWss('serverShutdown', {});
    } catch (error) {
        console.error("Error sending server shutdown to WSS:", error);
    } finally {
        console.log("Exiting Node.js application.");
        wss.close();
        process.exit(0);
    }
}

process.on('SIGINT', async () => {
    await handleShutdown('SIGINT');
});

process.on('SIGTERM', async () => {
    await handleShutdown('SIGTERM');
});

process.on('exit', async (code) => {
    if (code !== 0) {
        await handleShutdown('exit with error code: ' + code);
    }
});

if (process.platform === 'win32') {
    process.on('SIGHUP', async () => {
        await handleShutdown('SIGHUP');
    });
}