import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';
import inquirer from 'inquirer';
import { ItemUsed, PlayerDied } from './interface';

// --- Constants ---
const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RESET = '\x1b[0m';

const SERVER_STATUS_INTERVAL = 5000;
const RECONNECT_INTERVAL = 5000;
const MAX_NOTIFICATIONS = 10;

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
let isWebSocketServerOnline = false; // Add this line to track WebSocket server online status
const notifications: string[] = [];
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};

// --- Helper Functions ---

const clearConsole = () => console.clear();

const log = (color: string, message: string) => {
    switch (color) {
        case 'red':
            console.log(COLOR_RED + message + COLOR_RESET);
            break;
        case 'green':
            console.log(COLOR_GREEN + message + COLOR_RESET);
            break;
        case 'yellow':
            console.log(COLOR_YELLOW + message + COLOR_RESET);
            break;
        default:
            console.log(message);
    }
};

const addNotification = (message: string) => {
    notifications.push(message);
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications.shift();
    }
};

const displayNotifications = async () => {
    clearConsole();
    if (notifications.length === 0) {
        console.log('通知はありません。\n');
    } else {
        console.log('通知:\n');
        notifications.forEach((notification) => console.log(`${notification}\n`));
    }
    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: 'メニューに戻るにはEnterキーを押してください...',
        },
    ]);
    displayMenu();
};

const updateEnvFile = (key: string, value: string) => {
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}="${value}"`);
        } else {
            envContent += `\n${key}="${value}"`;
        }
        fs.writeFileSync(envPath, envContent);
        // config({ path: envPath, override: true }); // <= .env 更新後に再度読み込み
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
        let resolved = false;

        const resolveAndClose = (value: boolean) => {
            if (!resolved) {
                resolved = true;
                resolve(value);
                ws.close();
            }
        };

        ws.on('open', () => resolveAndClose(true));
        ws.on(
            'error',
            (error) => resolveAndClose((error as any).message.includes('404') ? false : true)
        );
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

// --- UI Functions ---

const displayMenu = async () => {
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

    const choices = [
        'サーバーに再接続',
        'サーバーの状態を確認',
        'WebSocketサーバーURLを設定',
        `起動時の自動接続を切り替え (現在: ${autoConnectOnStartup ? '有効' : '無効'})`,
        '通知',
        '終了',
    ];

    clearConsole();
    console.log(COLOR_GREEN + 'Minecraftサーバーマネージャー' + COLOR_RESET);
    console.log(
        `WebSocketサーバー: ${isWebSocketServerOnline
            ? COLOR_GREEN + 'オンライン' + COLOR_RESET
            : COLOR_RED + 'オフライン' + COLOR_RESET
        }`
    );

    try {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'menuChoice',
                message: '選択してください:',
                choices: choices,
            },
        ]);

        handleMenuChoice(choices.indexOf(answers.menuChoice) + 1);
    } catch (error) {
        log('red', 'エラーが発生しました: ' + error);
    }
};

const handleMenuChoice = (choice: number) => {
    switch (choice) {
        case 1:
            restartWss();
            break;
        case 2:
            checkServerStatus();
            break;
        case 3:
            setupWebSocketUrl();
            break;
        case 4:
            toggleAutoConnect();
            break;
        case 5:
            displayNotifications();
            break;
        case 6:
            console.log('終了します...');
            process.exit(0);
            break;
        default:
            addNotification(
                `${COLOR_RED}無効な選択です。もう一度お試しください。${COLOR_RESET}`
            );
            setTimeout(displayMenu, 1000);
    }
};

const restartWss = async () => {
    clearConsole();
    if (webSocketUrl) {
        log("yellow", `WebSocketサーバー: ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'}\n`);
        if (!isWebSocketServerOnline) {
            console.log(COLOR_RED + 'WebSocketサーバーに接続されていません。' + COLOR_RESET);
        }
    }
    if (!envLoaded) {
        log("yellow", `${COLOR_RED}エラー: .envファイルが読み込まれていないか、必要な変数が不足しています。${COLOR_RESET}`);
        return;
    }
    if (!webSocketUrl) {
        log("red", `${COLOR_RED}エラー: WebSocket URLが設定されていません。${COLOR_RESET}`);
        return;
    }
    await wss?.close()
    await connectToWss(webSocketUrl);
    console.log('メニューに戻るにはEnterキーを押してください...\n');
    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: 'メニューに戻るにはEnterキーを押してください...',
        },
    ]);
    displayMenu();
};

const checkServerStatus = async () => {
    clearConsole();
    if (webSocketUrl) {
        log("yellow", `WebSocketサーバー: ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'}\n`);
        if (!isWebSocketServerOnline) {
            console.log(COLOR_RED + 'WebSocketサーバーに接続されていません。' + COLOR_RESET);
        }
    }
    log(
        isWorldLoaded ? "green" : "red",
        `Minecraftサーバーステータス: ${isWorldLoaded ? 'オンライン' : 'オフライン'}\n`
    );

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: 'メニューに戻るにはEnterキーを押してください...',
        },
    ]);
    displayMenu();
};

const setupWebSocketUrl = async () => {
    try {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'url',
                message:
                    'WebSocketサーバーのURLを入力してください (例: ws://example.com):',
                validate: (input: string) => {
                    if (!input.trim()) {
                        return 'WebSocket URLを空にすることはできません。';
                    }
                    if (!/^wss?:\/\/.+$/.test(input)) {
                        return '無効なURL形式です。ws:// または wss:// で始まる必要があります。';
                    }
                    return true;
                },
            },
        ]);

        const url = answers.url.trim();
        webSocketUrl = url;
        updateEnvFile('WSS_URL', url);
        config({ path: path.resolve(process.cwd(), '.env'), override: true });
        autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';
        envLoaded = true;
        log('green', `WebSocket URLが設定されました: ${url}`);

        // WebSocket サーバーのステータスチェックにタイムアウトを設定
        const timeout = 10000; // 例：10秒
        const checkStatusPromise = checkWebSocketStatus(url);
        const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('WebSocket status check timed out')), timeout)
        );

        try {
            isWebSocketServerOnline = await Promise.race([checkStatusPromise, timeoutPromise]);
            log(
                'green',
                `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。\nサーバーマネージャーに戻った際にEnterを押すことで選択できるようになります`
            );

            if (isWebSocketServerOnline && autoConnectOnStartup) {
                // WebSocket サーバーへの接続試行にタイムアウトを設定
                const connectPromise = connectToWss(url);
                const connectTimeoutPromise = new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error('WebSocket connection timed out')), timeout)
                );

                await Promise.race([connectPromise, connectTimeoutPromise]);
                log('green', 'WebSocketサーバーに接続しました。');
            }
        } catch (error) {
            log('red', `WebSocketサーバーの状態確認または接続中にエラーが発生しました: ${error}`);
        }
    } catch (error) {
        log('red', 'エラーが発生しました: ' + error);
    } finally {
        // エラーの有無に関わらず、メニューを再表示
        setTimeout(displayMenu, 1000);
    }
};

const toggleAutoConnect = async () => {
    autoConnectOnStartup = !autoConnectOnStartup;
    updateEnvFile('AUTO_CONNECT_ON_STARTUP', autoConnectOnStartup.toString());
    // *** 修正: .env 更新後に再度読み込み ***
    config({ path: path.resolve(process.cwd(), '.env'), override: true });
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';
    const message = `${COLOR_GREEN}起動時の自動接続が ${autoConnectOnStartup ? '有効' : '無効'} になりました。${COLOR_RESET}`;
    log("white", message);
    addNotification(message);
    displayMenu();
};

// --- WebSocket Functions ---
const connectToWss = async (url: string) => {
    // Close the existing connection if it exists
    if (wss) {
        wss.removeAllListeners();
        wss.close();
        wss = null; // Reset the wss variable
    }

    // Create a new WebSocket connection
    wss = new WebSocket(url);

    wss.on('open', () => {
        addNotification(
            `${COLOR_GREEN}WebSocketサーバーに接続しました。${COLOR_RESET}`
        );
        clearInterval(reconnectionInterval!);
        reconnectionInterval = null; // Reset reconnection interval on successful connection
        isWebSocketServerOnline = true; // Update WebSocket server online status
        sendStatus().catch(console.error);
    });

    wss.on('message', async (data: string) => {
        const message = JSON.parse(data.toString());

        try {
            switch (message.event) {
                case 'serverStatus':
                    displayServerStatus(message.data);
                    break;
                case 'commandResult':
                    addNotification(`コマンド結果: ${message.data.result}`);
                    break;
                case 'playerJoin':
                    addNotification(
                        `${COLOR_GREEN}プレイヤーが参加しました: ${message.data.player} (UUID: ${message.data.uuid})${COLOR_RESET}`
                    );
                    break;
                case 'playerLeave':
                    addNotification(
                        `${COLOR_YELLOW}プレイヤーが退出しました: ${message.data.player} (UUID: ${message.data.uuid})${COLOR_RESET}`
                    );
                    break;
                case 'playerChat':
                    addNotification(
                        `[チャット] ${message.data.sender}: ${message.data.message}`
                    );
                    break;
                case 'PlayerDied':
                    addNotification(`[PlayerDied]`);
                    break;
                case 'ItemUsed':
                    addNotification(`[ItemUsed]`);
                    break;
                case 'serverShutdown':
                    addNotification(
                        `${COLOR_RED}サーバーがシャットダウンしています。${COLOR_RESET}`
                    );
                    break;
                default:
                    if (message.command) {
                        const world = server.getWorlds()[0];
                        if (!world) {
                            addNotification(
                                `${COLOR_RED}ワールドがまだロードされていません。コマンドを実行できません。${COLOR_RESET}`
                            );
                            break;
                        }

                        switch (message.command) {
                            case 'sendMessage':
                                if (message.playerName) {
                                    await world.sendMessage(
                                        message.message,
                                        message.playerName
                                    );
                                } else {
                                    await world.sendMessage(message.message);
                                }
                                break;
                            default:
                                const commandResult = await world.runCommand(
                                    message.command
                                );
                                sendDataToWss('commandResult', {
                                    result: commandResult,
                                    command: message.command,
                                    commandId: message.commandId,
                                });
                                break;
                        }
                    }
            }
        } catch (error) {
            addNotification(
                `${COLOR_RED}WSSからのメッセージ処理中にエラーが発生しました: ${error}${COLOR_RESET}`
            );
        }
    });

    wss.on('close', () => {
        if (isWebSocketServerOnline) {
            addNotification(
                `${COLOR_YELLOW}WebSocketサーバーから切断されました。${COLOR_RESET}`
            );
            isWebSocketServerOnline = false;
        }
        // Reconnect if auto-connect is enabled and URL is set
        if (webSocketUrl && autoConnectOnStartup) {
            reconnect();
        }
    });

    wss.on('error', (error) => {
        // Only show error notifications if the server was previously online
        if (isWebSocketServerOnline) {
            addNotification(`${COLOR_RED}WebSocketエラー: ${error}${COLOR_RESET}`);
        }
    });
};

const reconnect = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        clearInterval(reconnectionInterval!);

        if (!webSocketUrl) {
            reject('WSS_URLが定義されていません。');
            return;
        }

        const attemptReconnect = () => {
            if (!isWebSocketServerOnline) {
                addNotification(
                    `${COLOR_YELLOW}WebSocketサーバーへの再接続を試みています...${COLOR_RESET}`
                );
                connectToWss(webSocketUrl!)
                    .then(() => {
                        clearInterval(reconnectionInterval!);
                        resolve();
                    })
                    .catch(() => { }); // Ignore errors, retry on next interval
            }
        };

        reconnectionInterval = setInterval(attemptReconnect, RECONNECT_INTERVAL);
        attemptReconnect(); // Initial attempt
    });
};

const sendDataToWss = (event: string, data: any) => {
    if (wss && wss.readyState === WebSocket.OPEN) {
        wss.send(JSON.stringify({ event, data }));
    } else {
        addNotification(`${COLOR_RED}WebSocketが接続されていません。${COLOR_RESET}`);
    }
};

const displayServerStatus = async (statusData: ServerStatus) => {
    clearConsole();
    console.log(
        COLOR_GREEN + 'サーバーステータス (WebSocket経由):' + COLOR_RESET
    );
    console.log(`稼働時間: ${statusData.uptime}`);
    console.log(`プレイヤー数: ${statusData.playerCount}`);
    console.log(`CPU使用率: ${statusData.cpuUsage}%`);
    console.log(`メモリ使用率: ${statusData.memoryUsage}%`);
    console.log(`使用メモリ: ${statusData.usedMemoryMB} MB`);
    console.log(`負荷状態: ${statusData.loadStatus}`);
    console.log(`WebSocket Ping: ${statusData.wsPing}ms`);
    console.log(
        `ワールドがロードされているか: ${statusData.isWorldLoaded ? 'はい' : 'いいえ'}`
    );
    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: 'メニューに戻るにはEnterキーを押してください...',
        },
    ]);
    displayMenu();
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

    if (!isWorldLoaded) {
        sendDataToWss('serverStatus', defaultStatus);
        return;
    }

    const world = server.getWorlds()[0];
    if (!world) {
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
        const cpuUsage = (
            100 -
            (100 * totalIdleTime) / totalCpuTime
        ).toFixed(2);

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
        const loadStatus =
            loadAverage < 0.7 ? '低' : loadAverage < 1.0 ? '中' : '高';

        const serverPing = isWorldLoaded ? world.ping - 50 : 999;

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
        // Handle error appropriately (logging, etc.)
    }
};

// --- Server Setup and Event Handlers ---

const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
    // path: "./server", // Remove this line if you don't want to start the server
    // killWhenExit: true, // Remove this line if you don't want to kill the server when the script exits
});

server.events.on('serverOpen', async () => {
    if (autoConnectOnStartup) {
        addNotification(
            `${COLOR_GREEN}MinecraftサーバーがWebSocket経由で接続されました!${COLOR_RESET}`
        );
    }
    serverStartTime = Date.now();
    if (webSocketUrl && autoConnectOnStartup) {
        await connectToWss(webSocketUrl);
    }
});

server.events.on('worldAdd', async (event) => {
    isWorldLoaded = true;
    if (serverStatusInterval) clearInterval(serverStatusInterval);
    serverStatusInterval = setInterval(sendStatus, SERVER_STATUS_INTERVAL);
    sendDataToWss('worldAdd', {});
    const { world } = event;
    //ここに追加する(イベントを)
    world.subscribeEvent("ItemUsed");
    world.subscribeEvent("PlayerDied");
});

server.events.on('worldRemove', async () => {
    isWorldLoaded = false;
    clearInterval(serverStatusInterval!);
    serverStatusInterval = null;
    sendDataToWss('worldRemove', {});
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

server.events.on('playerChat', async (event) => {
    const { sender, message, type } = event;
    if (!sender || sender === 'External') return;
    sendDataToWss('playerChat', { sender, message, type });
});

server.events.on('packetReceive', async (event) => {
    const body = event.packet.body;
    const header = event.packet.header;
    const eventName = header.eventName;

    if (eventName === "ItemUsed") {
        const itemUsedData: ItemUsed = {
            count: body.count,
            item: {
                aux: body.item.aux,
                id: body.item.id,
                namespace: body.item.namespace,
            },
            player: {
                color: body.player.color,
                dimension: body.player.dimension,
                id: body.player.id,
                name: body.player.name,
                position: {
                    x: body.player.position.x,
                    y: body.player.position.y,
                    z: body.player.position.z,
                },
                type: body.player.type,
                variant: body.player.variant,
                yRot: body.player.yRot,
            },
            useMethod: body.useMethod,
        };
        sendDataToWss('ItemUsed', { event: itemUsedData });
    } else if (eventName === "PlayerDied") {
        const playerDiedData: PlayerDied = {
            cause: body.cause,
            inRaid: body.inRaid,
            killer: body.killer
                ? {
                    color: body.killer.color,
                    id: body.killer.id,
                    type: body.killer.type,
                    variant: body.killer.variant,
                }
                : null,
            player: {
                color: body.player.color,
                dimension: body.player.dimension,
                id: body.player.id,
                name: body.player.name,
                position: {
                    x: body.player.position.x,
                    y: body.player.position.y,
                    z: body.player.position.z,
                },
                type: body.player.type,
                variant: body.player.variant,
                yRot: body.player.yRot,
            },
        };
        sendDataToWss('PlayerDied', { event: playerDiedData });
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
        addNotification(
            `${COLOR_RED}WSSへのサーバーシャットダウンの送信中にエラーが発生しました: ${error}${COLOR_RESET}`
        );
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
    const defaultEnvContent = `# 自動的に作成された.envファイル\n# ここに設定値を記入してください\nSERVER_STATUS_INTERVAL=5000\nWSS_URL="WebSocketサーバーURL"\nAUTO_CONNECT_ON_STARTUP="false" # 起動時の自動接続 (true or false)\n`;

    const createDefaultEnvFile = async (filePath: string) => {
        try {
            await fs.promises.writeFile(filePath, defaultEnvContent);
            addNotification(
                `${COLOR_YELLOW}デフォルトの.envファイルが ${filePath} に作成されました${COLOR_RESET}`
            );
        } catch (error) {
            addNotification(
                `${COLOR_RED}デフォルトの.envファイルの作成中にエラーが発生しました: ${error}${COLOR_RESET}`
            );
            process.exit(1);
        }
    };

    try {
        await fs.promises.access(envPath);
        config({ path: envPath });
        addNotification(
            `${COLOR_GREEN}.envファイルから環境変数を読み込みました。${COLOR_RESET}`
        );
        envLoaded = true;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            addNotification(
                `${COLOR_YELLOW}システムまたは.envファイルから環境変数を読み込めませんでした。${COLOR_RESET}`
            );
            await createDefaultEnvFile(envPath);
            config({ path: envPath });
            envLoaded = false;
        } else {
            addNotification(
                `${COLOR_RED}.envファイルへのアクセス中にエラーが発生しました: ${error}${COLOR_RESET}`
            );
            process.exit(1);
        }
    }

    webSocketUrl = process.env.WSS_URL || null;
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

    if (webSocketUrl) {
        addNotification(
            `${COLOR_GREEN}WebSocket URLが検出されました: ${webSocketUrl}${COLOR_RESET}`
        );
        try {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            addNotification(
                `${COLOR_GREEN}WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。${COLOR_RESET}`
            );
            if (isWebSocketServerOnline && autoConnectOnStartup) {
                addNotification(
                    `${COLOR_GREEN}起動時の自動接続が有効です。WebSocketサーバーに接続します。${COLOR_RESET}`
                );
                await connectToWss(webSocketUrl);
            }
        } catch (error) {
            addNotification(
                `${COLOR_RED}WebSocketサーバーの状態確認中にエラーが発生しました: ${error}${COLOR_RESET}`
            );
        }
    }
};

// --- Start ---
(async () => {
    await initEnv();
    displayMenu();
})();