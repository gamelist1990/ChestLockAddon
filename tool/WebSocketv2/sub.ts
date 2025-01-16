import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';
import express from 'express';
import open from 'open';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ItemUsed, PlayerDied } from './interface';

// --- Constants ---
const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RESET = '\x1b[0m';

const SERVER_STATUS_INTERVAL = 5000;
const RECONNECT_INTERVAL = 5000;
const MAX_NOTIFICATIONS = 10;
const HTTP_PORT = 80;

// --- Types ---
type ServerStatus = {
    uptime: string;
    playerCount: number;
    cpuUsage: string;
    memoryUsage: number;
    usedMemoryMB: number;
    loadStatus: string;
    wsPing: number;
    isWorldLoaded: boolean;
};

// --- Global Variables ---
let isWorldLoaded = false;
let wss: WebSocket | null = null;
let serverStatusInterval: NodeJS.Timeout | null = null;
let reconnectionInterval: NodeJS.Timeout | null = null;
let serverStartTime = Date.now();
let envLoaded = false;
let autoConnectOnStartup = false;
let webSocketUrl: string | null = null;
let isWebSocketServerOnline = false;
const notifications: string[] = [];
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};

// --- Express and Socket.IO Setup ---
const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

// --- Socket.IO Connection Handling ---
io.on('connection', (socket: Socket) => {
    console.log('A user connected to the GUI');
    socket.emit('initialData', {
        notifications,
        isWebSocketServerOnline,
        autoConnectOnStartup,
        webSocketUrl,
    });

    socket.on('reconnect', restartWss);
    socket.on('checkServerStatus', checkServerStatus);
    socket.on('setWebSocketUrl', setupWebSocketUrlFromGUI);
    socket.on('toggleAutoConnect', toggleAutoConnect);
    socket.on('disconnect', () => console.log('A user disconnected from the GUI'));
});

// --- Helper Functions ---
const log = (color: string, message: string) => {
    console.log(`${color}${message}${COLOR_RESET}`);
};

const addNotification = (message: string) => {
    notifications.push(message);
    if (notifications.length > MAX_NOTIFICATIONS) notifications.shift();
    io.emit('notification', message);
};

const updateEnvFile = (key: string, value: string) => {
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = new RegExp(`^${key}=.*$`, 'm');
        envContent = envContent.match(regex)
            ? envContent.replace(regex, `${key}="${value}"`)
            : envContent + `\n${key}="${value}"`;
        fs.writeFileSync(envPath, envContent);
        config({ path: envPath, override: true });
        addNotification(`${COLOR_GREEN}.envファイルが更新されました。${COLOR_RESET}`);
    } catch (error) {
        addNotification(
            `${COLOR_RED}.envファイルの更新中にエラーが発生しました: ${error}${COLOR_RESET}`
        );
    }
};

const checkWebSocketStatus = async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        const resolveAndClose = (value: boolean) => {
            resolve(value);
            ws.close();
        };
        ws.on('open', () => resolveAndClose(true));
        ws.on('error', (error) => resolveAndClose(false));
        setTimeout(() => resolveAndClose(false), 5000);
    });
};

const extractPlayerName = async (
    playerNameWithTags: string
): Promise<{ name: string; uuid: string } | null> => {
    if (playerNameCache[playerNameWithTags])
        return playerNameCache[playerNameWithTags];

    const world = server.getWorlds()[0];
    if (!world) return null;

    const playerListResult = await world.runCommand(`testfor @a`);
    if (playerListResult.statusCode !== 0 || !playerListResult.victim)
        return null;

    for (const realPlayerName of playerListResult.victim) {
        if (playerNameWithTags.includes(realPlayerName)) {
            const queryResult = await world.runCommand(
                `querytarget @a[name="${realPlayerName}"]`
            );
            if (queryResult.statusCode === 0 && queryResult.details !== '[]') {
                const playerData = JSON.parse(queryResult.details);
                if (playerData && playerData.length > 0) {
                    const playerInfo = {
                        name: realPlayerName,
                        uuid: playerData[0].uniqueId,
                    };
                    playerNameCache[realPlayerName] = playerInfo;
                    return playerInfo;
                }
            }
        }
    }
    return null;
};

// --- UI Functions (Handled by the GUI) ---
const restartWss = async () => {
    if (!envLoaded || !webSocketUrl) {
        log(
            'red',
            `${COLOR_RED}エラー: .envファイルが読み込まれていないか、WebSocket URLが設定されていません。${COLOR_RESET}`
        );
        return;
    }
    await wss?.close();
    await connectToWss(webSocketUrl);
    log('yellow', `WebSocketサーバー: ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'}`);
};

const checkServerStatus = () => {
    log('yellow', `WebSocketサーバー: ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'}`);
    log(
        isWorldLoaded ? 'green' : 'red',
        `Minecraftサーバーステータス: ${isWorldLoaded ? 'オンライン' : 'オフライン'}`
    );
};

const setupWebSocketUrlFromGUI = async (url: string) => {
    try {
        const trimmedUrl = url.trim();
        webSocketUrl = trimmedUrl;
        updateEnvFile('WSS_URL', trimmedUrl);
        config({ path: path.resolve(process.cwd(), '.env'), override: true });
        envLoaded = true;
        log('green', `WebSocket URLが設定されました: ${trimmedUrl}`);
        io.emit('webSocketUrlUpdated', trimmedUrl);

        isWebSocketServerOnline = await checkWebSocketStatus(trimmedUrl);
        log(
            'green',
            `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`
        );
        io.emit('webSocketStatus', isWebSocketServerOnline);

        if (isWebSocketServerOnline && autoConnectOnStartup) {
            await connectToWss(trimmedUrl);
            log('green', 'WebSocketサーバーに接続しました。');
        }
    } catch (error) {
        log('red', `エラーが発生しました: ${error}`);
    }
};

const toggleAutoConnect = () => {
    autoConnectOnStartup = !autoConnectOnStartup;
    updateEnvFile('AUTO_CONNECT_ON_STARTUP', autoConnectOnStartup.toString());
    config({ path: path.resolve(process.cwd(), '.env'), override: true });
    const message = `${COLOR_GREEN}起動時の自動接続が ${autoConnectOnStartup ? '有効' : '無効'} になりました。${COLOR_RESET}`;
    log('white', message);
    addNotification(message);
    io.emit('autoConnectStatus', autoConnectOnStartup);
};

// --- WebSocket Functions ---
const connectToWss = async (url: string) => {
    wss?.removeAllListeners();
    wss?.close();
    wss = new WebSocket(url);

    wss.on('open', () => {
        addNotification(`${COLOR_GREEN}WebSocketサーバーに接続しました。${COLOR_RESET}`);
        clearInterval(reconnectionInterval!);
        reconnectionInterval = null;
        isWebSocketServerOnline = true;
        io.emit('webSocketStatus', true);
        sendStatus().catch(console.error);
    });

    wss.on('message', async (data: string) => {
        const message = JSON.parse(data.toString());
        try {
            if (message.event === 'serverStatus') {
                displayServerStatus(message.data);
            } else if (message.command) {
                const world = server.getWorlds()[0];
                if (!world) {
                    addNotification(`${COLOR_RED}ワールドがまだロードされていません。コマンドを実行できません。${COLOR_RESET}`);
                    return;
                }
                const commandResult = await world.runCommand(message.command);
                sendDataToWss('commandResult', {
                    result: commandResult,
                    command: message.command,
                    commandId: message.commandId,
                });
            } else {
                addNotification(`[${message.event}]`);
            }
        } catch (error) {
            addNotification(`${COLOR_RED}WSSからのメッセージ処理中にエラーが発生しました: ${error}${COLOR_RESET}`);
        }
    });

    wss.on('close', () => {
        if (isWebSocketServerOnline) {
            addNotification(`${COLOR_YELLOW}WebSocketサーバーから切断されました。${COLOR_RESET}`);
            isWebSocketServerOnline = false;
            io.emit('webSocketStatus', false);
        }
        if (webSocketUrl && autoConnectOnStartup) reconnect();
    });

    wss.on('error', (error) => {
        if (isWebSocketServerOnline)
            addNotification(`${COLOR_RED}WebSocketエラー: ${error}${COLOR_RESET}`);
    });
};

const reconnect = () => {
    clearInterval(reconnectionInterval!);
    if (!webSocketUrl) return;
    reconnectionInterval = setInterval(() => {
        if (!isWebSocketServerOnline) {
            addNotification(`${COLOR_YELLOW}WebSocketサーバーへの再接続を試みています...${COLOR_RESET}`);
            connectToWss(webSocketUrl!).catch(() => { });
        }
    }, RECONNECT_INTERVAL);
};

const sendDataToWss = (event: string, data: any) => {
    if (wss?.readyState === WebSocket.OPEN) {
        wss.send(JSON.stringify({ event, data }));
    } else {
        addNotification(`${COLOR_RED}WebSocketが接続されていません。${COLOR_RESET}`);
    }
};

const displayServerStatus = (statusData: ServerStatus) => {
    io.emit('serverStatus', statusData);
};

const sendStatus = async () => {
    const defaultStatus: ServerStatus = {
        uptime: 'N/A',
        playerCount: 0,
        cpuUsage: '0',
        memoryUsage: 0,
        usedMemoryMB: 0,
        loadStatus: 'N/A',
        wsPing: 999,
        isWorldLoaded: false,
    };

    const world = server.getWorlds()[0];
    if (!world || !isWorldLoaded) {
        sendDataToWss('serverStatus', defaultStatus);
        return;
    }

    try {
        const playerListResult = await world.runCommand('list');
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
        const cpuUsage = (100 - (100 * totalIdleTime) / totalCpuTime).toFixed(2);

        const totalMem = os.totalmem();
        const usedMem = totalMem - os.freemem();
        const memUsage = Math.round((usedMem / totalMem) * 100);

        const serverUptime = Math.floor((Date.now() - serverStartTime) / 1000);
        const uptimeString = formatDuration(serverUptime);

        const loadavg = os.loadavg();
        const loadAverage = loadavg[0] / os.cpus().length;
        const loadStatus =
            loadAverage < 0.7 ? '低' : loadAverage < 1.0 ? '中' : '高';

        const serverPing = world.ping - 50;

        const statusData: ServerStatus = {
            uptime: uptimeString,
            playerCount,
            cpuUsage,
            memoryUsage: memUsage,
            usedMemoryMB: Math.round(usedMem / 1024 / 1024),
            loadStatus: `${loadStatus} (${loadAverage.toFixed(2)})`,
            wsPing: serverPing,
            isWorldLoaded,
        };

        sendDataToWss('serverStatus', statusData);
    } catch (error) {
        console.error('Error getting server status:', error);
    }
};

// Helper function to format duration
function formatDuration(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${days}日 ${hours}時間 ${minutes}分 ${remainingSeconds}秒`;
}

// --- Server Setup and Event Handlers ---
const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
});

server.events.on('serverOpen', async () => {
    serverStartTime = Date.now();
    if (webSocketUrl && autoConnectOnStartup) await connectToWss(webSocketUrl);
});

server.events.on('worldAdd', async (event) => {
    isWorldLoaded = true;
    clearInterval(serverStatusInterval!);
    serverStatusInterval = setInterval(sendStatus, SERVER_STATUS_INTERVAL);
    const { world } = event;
    world.subscribeEvent("ItemUsed");
    world.subscribeEvent("PlayerDied");
});

server.events.on('worldRemove', () => {
    isWorldLoaded = false;
    clearInterval(serverStatusInterval!);
});

server.events.on('playerJoin', async (event) => {
    const playerInfo = await extractPlayerName(event.players[0]);
    sendDataToWss('playerJoin', {
        player: playerInfo?.name ?? event.players,
        uuid: playerInfo?.uuid ?? null,
    });
});

server.events.on('playerLeave', async (event) => {
    const playerInfo = await extractPlayerName(event.players[0]);
    sendDataToWss('playerLeave', {
        player: playerInfo?.name ?? event.players,
        uuid: playerInfo?.uuid ?? null,
    });
});

server.events.on('playerChat', (event) => {
    const { sender, message, type } = event;
    if (!sender || sender === 'External') return;
    sendDataToWss('playerChat', { sender, message, type });
});

// Handle packet events
server.events.on('packetReceive', (event) => {
    const { header, body } = event.packet;
    if (header.eventName === 'ItemUsed') {
        sendDataToWss('ItemUsed', { event: body as ItemUsed });
    } else if (header.eventName === 'PlayerDied') {
        sendDataToWss('PlayerDied', { event: body as PlayerDied });
    }
});

// --- Process Exit Handlers ---
const handleShutdown = async (signal: string) => {
    addNotification(`${signal}を受信しました。プロセスをクリアします。`);
    clearInterval(serverStatusInterval!);
    clearInterval(reconnectionInterval!);
    try {
        sendDataToWss('serverShutdown', {});
    } catch (error) {
        addNotification(`${COLOR_RED}WSSへのサーバーシャットダウンの送信中にエラーが発生しました: ${error}${COLOR_RESET}`);
    } finally {
        addNotification(`Node.jsアプリケーションを終了します。`);
        wss?.close();
        process.exit(0);
    }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('exit', (code) => {
    if (code !== 0) handleShutdown(`異常終了 コード: ${code}`);
});

if (process.platform === 'win32') {
    process.on('SIGHUP', () => handleShutdown('SIGHUP'));
}

// --- Initialization ---
const initEnv = async () => {
    const envPath = path.resolve(process.cwd(), '.env');
    const defaultEnvContent = `# 自動的に作成された.envファイル\nWSS_URL="WebSocketサーバーURL"\nAUTO_CONNECT_ON_STARTUP="false"`;

    const createDefaultEnvFile = async (filePath: string) => {
        try {
            await fs.promises.writeFile(filePath, defaultEnvContent);
            addNotification(`${COLOR_YELLOW}デフォルトの.envファイルが ${filePath} に作成されました${COLOR_RESET}`);
        } catch (error) {
            addNotification(`${COLOR_RED}デフォルトの.envファイルの作成中にエラーが発生しました: ${error}${COLOR_RESET}`);
            process.exit(1);
        }
    };

    try {
        await fs.promises.access(envPath);
        config({ path: envPath });
        addNotification(`${COLOR_GREEN}.envファイルから環境変数を読み込みました。${COLOR_RESET}`);
        envLoaded = true;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            addNotification(`${COLOR_YELLOW}システムまたは.envファイルから環境変数を読み込めませんでした。${COLOR_RESET}`);
            await createDefaultEnvFile(envPath);
            config({ path: envPath });
            envLoaded = false;
        } else {
            addNotification(`${COLOR_RED}.envファイルへのアクセス中にエラーが発生しました: ${error}${COLOR_RESET}`);
            process.exit(1);
        }
    }

    webSocketUrl = process.env.WSS_URL || null;
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

    if (webSocketUrl) {
        addNotification(`${COLOR_GREEN}WebSocket URLが検出されました: ${webSocketUrl}${COLOR_RESET}`);
        try {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            addNotification(`${COLOR_GREEN}WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。${COLOR_RESET}`);
            if (isWebSocketServerOnline && autoConnectOnStartup) {
                addNotification(`${COLOR_GREEN}起動時の自動接続が有効です。WebSocketサーバーに接続します。${COLOR_RESET}`);
                await connectToWss(webSocketUrl);
            }
        } catch (error) {
            addNotification(`${COLOR_RED}WebSocketサーバーの状態確認中にエラーが発生しました: ${error}${COLOR_RESET}`);
        }
    }
};

// --- Start ---
(async () => {
    await initEnv();
    httpServer.listen(HTTP_PORT, () => {
        console.log(`HTTP server listening on port ${HTTP_PORT}`);
        open(`http://localhost:${HTTP_PORT}`);
    });
})();