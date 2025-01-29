import ora from 'ora';
import CliTable from 'cli-table3';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Server } from 'socket-be';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import axios from 'axios';

// --- Constants ---
const RECONNECT_INTERVAL = 5000;
const MAX_NOTIFICATIONS = 10;
const RECONNECTION_TIMEOUT = 3 * 60 * 1000;
const MAX_LOGS = 10;

// --- Global Variables ---
let wss: WebSocket | null = null;
let reconnectionInterval: NodeJS.Timer | null;
let autoConnectOnStartup = false;
let webSocketUrl: string | null = null;
let isWebSocketServerOnline = false;
const notifications: string[] = [];
const logs: string[] = [];
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};
const playerUuidCache: { [key: string]: string } = {};
let reconnectionStartTime: number | null = null;

// --- ログファイル名 ---
const LOG_FILE = path.join(process.cwd(), 'ClientV3.log.txt');

// --- 設定ファイル名 ---
const CONFIG_FILE = path.join(process.cwd(), 'config.json');

// --- ログ記録用関数 ---
const writeLog = (message: string) => {
    // loadConfig()を呼び出さずに、直接タイムゾーンを取得 (ファイルが存在しない場合はデフォルト値を使用)
    let timezone = 'Asia/Tokyo';
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(data) as Config;
        timezone = config.timezone || 'Asia/Tokyo';
    } catch (error) {
        // エラーが発生してもここではログ出力しない (無限再帰を避けるため)
        console.error('タイムゾーンの取得中にエラーが発生しましたが、ログ出力はスキップします:', error);
    }

    const timestamp = new Date().toLocaleString('ja-JP', {
        timeZone: timezone
    });
    const logMessage = `[${timestamp}] ${message}\n`;

    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('ログファイルへの書き込みエラー:', error);
    }
};

// --- Helper Functions ---
const clearConsole = () => {
    console.clear();
};

const addLog = (message: string) => {
    // ログ出力時にタイムゾーンを取得する必要がなくなったため、loadConfig()を呼び出さない
    const timestamp = new Date().toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo' // デフォルトのタイムゾーンを使用
    });
    const timedMessage = `[${timestamp}] ${message}`;
    logs.push(timedMessage);
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }
    writeLog(message);
    updateDashboard();
};

const addNotification = (
    message: string,
    type: 'connection' | 'disconnection' | 'other' = 'other',
) => {
    // ログ出力時にタイムゾーンを取得する必要がなくなったため、loadConfig()を呼び出さない
    const timestamp = new Date().toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo' // デフォルトのタイムゾーンを使用
    });
    const timedMessage = `[${timestamp}] ${message}`;

    notifications.push(timedMessage);
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications.shift();
    }

    addLog(`[Notification] ${message}`);
};

// --- 設定ファイルの読み込みと書き込み ---
interface Config {
    wssUrl: string;
    autoConnectOnStartup: boolean;
    socketBePort: number;
    timezone: string;
}

const defaultConfig: Required<Config> = {
    wssUrl: "WebSocketサーバーURL",
    autoConnectOnStartup: false,
    socketBePort: 8000,
    timezone: "Asia/Tokyo",
};

const loadConfig = (): Config => {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(data) as Config;
        return config;
    } catch (error) {
        // loadConfig() 内でエラーが発生した場合は、コンソールにエラーを出力するが、addLog() は呼び出さない
        console.error(`設定ファイルの読み込み中にエラーが発生しました: ${error}`);
        return defaultConfig;
    }
};

const saveConfig = <T extends Config>(config: T) => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        addNotification(`設定ファイルが更新されました。`);
    } catch (error) {
        addLog(`設定ファイルの更新中にエラーが発生しました: ${error}`);
    }
};

const updateConfig = <K extends keyof Config>(key: K, value: Config[K]) => {
    const config = loadConfig();
    config[key] = value;
    saveConfig<Config>(config); // 型引数として Config を渡す
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
        ws.on('error', () => resolveAndClose(false));
        setTimeout(() => resolveAndClose(false), 5000);
    });
};

async function extractPlayerName(
    playerNameWithTags: string,
): Promise<{ name: string; uuid: string } | null> {
    if (playerNameCache[playerNameWithTags]) {
        return playerNameCache[playerNameWithTags];
    }

    const world = server.getWorlds()[0];
    if (!world) {
        return null;
    }

    try {
        const playerListResult = await world.runCommand(`testfor @a`);
        if (playerListResult.statusCode !== 0 || !playerListResult.victim) {
            return null;
        }

        for (const realPlayerName of playerListResult.victim) {
            if (playerNameWithTags.includes(realPlayerName)) {
                const queryResult = await world.runCommand(
                    `querytarget @a[name="${realPlayerName}"]`,
                );
                if (queryResult.statusCode === 0 && queryResult.details !== '[]') {
                    const playerData = JSON.parse(queryResult.details);
                    if (playerData && playerData.length > 0) {
                        const playerInfo = {
                            name: realPlayerName,
                            uuid: playerData[0].uniqueId,
                        };
                        playerNameCache[playerNameWithTags] = playerInfo;
                        playerUuidCache[realPlayerName] = playerData[0].uniqueId;
                        return playerInfo;
                    }
                }
            }
        }
    } catch (error) {
        addLog(`プレイヤー情報の取得中にエラーが発生しました: ${error}`);
        return null;
    }

    return null;
}

// --- UI Functions ---
let statusTable = new CliTable({
    head: ['WebSocket', 'URL', 'AutoConnect'],
    colWidths: [15, 40, 15],
});

const updateDashboard = () => {
    clearConsole();

    statusTable.length = 0;

    // ステータス表示
    console.log(chalk.yellow('[Status]'));
    statusTable.push([
        isWebSocketServerOnline ? chalk.green('Online') : chalk.red('Offline'),
        webSocketUrl || 'N/A',
        autoConnectOnStartup ? 'On' : 'Off',
    ]);
    console.log(statusTable.toString());

    console.log(chalk.gray('--------------------------------------------------'));

    console.log(chalk.blue('[Notifications]'));
    notifications.slice(-5).forEach((notification) => {
        console.log(notification);
    });

    console.log(chalk.gray('--------------------------------------------------'));

    console.log(chalk.green('[Logs]'));
    logs.slice(-20).forEach((log) => {
        console.log(log);
    });

    console.log(chalk.gray('--------------------------------------------------'));

    console.log(chalk.yellow('[Menu]'));
};

const initialize = async () => {
    try {
        const config = loadConfig();
        addLog('設定ファイルを読み込みました。');

        webSocketUrl = config.wssUrl || null;
        autoConnectOnStartup = config.autoConnectOnStartup || false;

        if (webSocketUrl) {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            addLog(
                `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`,
            );
            if (isWebSocketServerOnline && autoConnectOnStartup) {
                addLog('起動時の自動接続が有効です。WebSocketサーバーに接続します。');
                await connectToWss(webSocketUrl);
            }
        }
        updateDashboard();
    } catch (error) {
        addLog(`初期化中にエラーが発生しました: ${error}`);
    }
};

const displayMenu = async () => {
    //updateDashboard();

    const choices = [
        'Connect',
        'Configure WebSocket URL', // メニュー項目名を変更
        'Toggle AutoConnect',
        new inquirer.Separator(),
        'Exit',
    ];

    const { menuChoice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'menuChoice',
            message: 'メニュー:',
            choices: choices,
            pageSize: 7,
        },
    ]);

    switch (menuChoice) {
        case 'Connect':
            if (webSocketUrl) {
                const spinner = ora('WebSocketサーバーへ接続中...').start();
                try {
                    await connectToWss(webSocketUrl);
                    spinner.succeed('WebSocketサーバーに接続しました。');
                } catch (error) {
                    spinner.fail(`WebSocketサーバーへの接続に失敗しました: ${error}`);
                }
            } else {
                addLog('エラー: WebSocket URLが設定されていません。');
            }
            break;
        case 'Configure WebSocket URL': // メニュー項目名を変更
            await configureWebSocketUrl();
            break;
        case 'Toggle AutoConnect':
            await toggleAutoConnect();
            break;
        case 'Exit':
            addLog('アプリケーションを終了します。');
            process.exit(0);
    }
    displayMenu();
};

const configureWebSocketUrl = async () => {
    try {
        const { url } = await inquirer.prompt([
            {
                type: 'input',
                name: 'url',
                message: 'WebSocketサーバーのURLを入力してください (例: ws://example.com):',
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

        // 新しいURLの確認
        const { confirmUrl } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmUrl',
                message: `入力されたURL: ${url}\nこのURLでよろしいですか？`,
                default: true,
            },
        ]);

        if (!confirmUrl) {
            addLog('URLの入力をキャンセルしました。');
            updateDashboard();
            displayMenu();
            return;
        }

        webSocketUrl = url.trim();
        if (webSocketUrl) {
            updateConfig('wssUrl', webSocketUrl);
        }
        const config = loadConfig();
        autoConnectOnStartup = config.autoConnectOnStartup || false;
        addLog(`WebSocket URLが設定されました: ${webSocketUrl}`);

        const checkStatusAndConnect = async () => {
            const timeout = 10000;
            const checkStatusPromise = checkWebSocketStatus(webSocketUrl!);
            const timeoutPromise = new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error('WebSocket status check timed out')), timeout),
            );

            try {
                isWebSocketServerOnline = await Promise.race([checkStatusPromise, timeoutPromise]);
                addLog(
                    `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`,
                );

                if (isWebSocketServerOnline && autoConnectOnStartup) {
                    addNotification('WebSocketサーバーへの接続を試みます...');
                    const connectPromise = connectToWss(webSocketUrl!);
                    const connectTimeoutPromise = new Promise<void>((_, reject) =>
                        setTimeout(() => reject(new Error('WebSocket connection timed out')), timeout),
                    );

                    await Promise.race([connectPromise, connectTimeoutPromise]);
                    addNotification('WebSocketサーバーに接続しました。');
                }
            } catch (error) {
                addLog(`WebSocketサーバーの状態確認または接続中にエラーが発生しました: ${error}`);
            } finally {
                displayMenu();
                updateDashboard();
            }
        };

        checkStatusAndConnect();
    } catch (error) {
        addLog('エラーが発生しました: ' + error);
    }
};

const toggleAutoConnect = async () => {
    const config = loadConfig();
    const newAutoConnectValue = !config.autoConnectOnStartup;

    updateConfig('autoConnectOnStartup', newAutoConnectValue);

    autoConnectOnStartup = newAutoConnectValue;
    const message = `起動時の自動接続が ${autoConnectOnStartup ? '有効' : '無効'} になりました。`;
    addLog(message);
    updateDashboard();
};

// --- WebSocket Functions ---
const connectToWss = async (url: string) => {
    return new Promise<void>(async (resolve, reject) => {
        isWebSocketServerOnline = false;
        if (wss) {
            wss.removeAllListeners();
            await wss.removeAllListeners();
            wss.close();
            wss = null;
        }

        wss = new WebSocket(url);
        wss.setMaxListeners(50);

        wss.on('open', () => {
            clearInterval(reconnectionInterval!);
            reconnectionInterval = null;
            isWebSocketServerOnline = true;
            reconnectionStartTime = null;
            addNotification(`WebSocketサーバーに接続しました。`);
            resolve();
        });

        wss.on('message', async (data: string) => {
            try {
                if (!data) {
                    addNotification('空のメッセージを受信しました。');
                    return;
                }
                let message: any;
                try {
                    message = JSON.parse(data.toString());
                } catch (error) {
                    addNotification(`無効なJSONメッセージを受信しました: ${error}`);
                    return;
                }

                if (message.command) {
                    const world = server.getWorlds()[0];

                    if (world) {
                        try {
                            switch (message.command) {
                                case 'sendMessage':
                                    if (message.playerName) {
                                        await world.sendMessage(message.message, message.playerName);
                                    } else {
                                        await world.sendMessage(message.message);
                                    }
                                    break;
                                default:
                                    const commandResult = await world.runCommand(message.command);
                                    sendDataToWss('commandResult', {
                                        result: commandResult,
                                        command: message.command,
                                        commandId: message.commandId,
                                    });
                                    break;
                            }
                        } catch (error) {
                            writeLog(`コマンド実行中にエラーが発生しました: ${error}`);
                            sendDataToWss('commandError', {
                                error: `コマンド実行中にエラーが発生しました: ${error}`,
                                command: message.command,
                                commandId: message.commandId,
                            });
                        }
                    }
                }
            } catch (error) {
                addLog(`メッセージ処理中にエラーが発生しました: ${error}`);
            }
        });

        wss.on('close', async () => {
            if (isWebSocketServerOnline) {
                addNotification(`WebSocketサーバーから切断されました。`);
                isWebSocketServerOnline = false;
                updateDashboard();
            }

            if (reconnectionStartTime === null) {
                reconnectionStartTime = Date.now();
            }

            if (webSocketUrl && autoConnectOnStartup) {
                reconnect()
                    .then(() => resolve())
                    .catch(reject);
            }
        });

        wss.on('error', (error) => {
            if (isWebSocketServerOnline) {
                addLog(`WebSocketエラー: ${error}`);
            }
            reject(error);
        });
    });
};

const reconnect = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        clearInterval(reconnectionInterval!);

        if (!webSocketUrl) {
            reject('WSS_URLが定義されていません。');
            return;
        }

        const attemptReconnect = async () => {
            if (!isWebSocketServerOnline) {
                const elapsedTime = reconnectionStartTime ? Date.now() - reconnectionStartTime : 0;

                if (
                    webSocketUrl &&
                    webSocketUrl.includes('ngrok-free.app') &&
                    elapsedTime >= RECONNECTION_TIMEOUT
                ) {
                    addLog('再接続試行開始から3分が経過しました。ngrok URLの再取得を試みます。');
                    reconnectionStartTime = Date.now();

                    try {
                        const response = await axios.get('https://bfxmknk4-80.asse.devtunnels.ms/get_api');
                        const newWebSocketUrl = response.data;
                        if (newWebSocketUrl !== webSocketUrl) {
                            webSocketUrl = newWebSocketUrl;
                            addNotification(`ngrok URLを更新しました: ${webSocketUrl}`);
                            if (webSocketUrl) {
                                updateConfig('wssUrl', webSocketUrl);
                            }
                        } else {
                            addNotification('ngrok URLは変更されていません。');
                        }
                    } catch (error) {
                        addNotification(`ngrok URLの再取得に失敗しました: ${error}`);
                    }
                }

                addNotification(`WebSocketサーバーへの再接続を試みています...`);

                connectToWss(webSocketUrl!)
                    .then(() => {
                        clearInterval(reconnectionInterval!);
                        resolve();
                    })
                    .catch(() => {
                        /* エラーは無視して再試行を続ける */
                    });
            }
        };

        reconnectionInterval = setInterval(attemptReconnect, RECONNECT_INTERVAL);
        attemptReconnect();
    });
};

const sendDataToWss = (event: string, data: any) => {
    if (wss && wss.readyState === WebSocket.OPEN) {
        wss.send(JSON.stringify({ event, data }));
    } else {
        addNotification(`WebSocketが接続されていません。`);
    }
};

// --- Server Setup and Event Handlers ---
const config = loadConfig();
const server = new Server({
    port: config.socketBePort || 8000,
    timezone: config.timezone || 'Asia/Tokyo',
});
server.setMaxListeners(50);

server.events.on('serverOpen', async () => {
    addLog('Minecraft server started.');

    server.events.on('worldAdd', async () => {
        if (webSocketUrl && autoConnectOnStartup && isWebSocketServerOnline) {
            try {
                addLog('Attempting to connect to WebSocket server.');
                await connectToWss(webSocketUrl);
            } catch (error) {
                addLog(`Error connecting to WebSocket server: ${error}`);
            }
        }
        sendDataToWss('worldAdd', {});
        addNotification(`Minecraftサーバーに接続しました。`);
        const world = server.getWorlds()[0];
        world.subscribeEvent('ItemUsed');
        world.subscribeEvent('PlayerDied');
    });
});

server.events.on('worldRemove', async () => {
    sendDataToWss('worldRemove', {});
});

server.events.on('playerJoin', async (event) => {
    setTimeout(async () => {
        const playerInfo = await extractPlayerName(event.players.toString());
        sendDataToWss('playerJoin', {
            player: playerInfo?.name ?? event.players,
            uuid: playerInfo?.uuid ?? null,
        });
    }, 2000);
});

server.events.on('playerLeave', async (event) => {
    const playerInfo = await extractPlayerName(event.players.toString());
    if (playerInfo && playerInfo.name) {
        delete playerNameCache[event.players.toString()];
        delete playerUuidCache[playerInfo.name];
    }
    sendDataToWss('playerLeave', {
        player: playerInfo?.name ?? event.players,
        uuid: playerInfo?.uuid ?? null,
    });
});

server.events.on('playerChat', async (event) => {
    const { sender, message, type, receiver } = event;
    if (!sender || sender === 'External') return;
    sendDataToWss('playerChat', { sender, message, type, receiver });
});

// --- Process Exit Handlers ---
const handleShutdown = async (signal: string) => {
    addLog(`${signal}を受信しました。プロセスをクリアします。`);
    clearInterval(reconnectionInterval!);
    try {
        sendDataToWss('serverShutdown', {});
    } catch (error) {
        addLog(`WSSへのサーバーシャットダウンの送信中にエラーが発生しました: ${error}`);
    } finally {
        addLog(`Node.jsアプリケーションを終了します。`);
        wss?.close();
        process.exit(0);
    }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('exit', (code) => {
    if (code !== 0) {
        addLog(`異常終了 コード: ${code}`);
    }
});

process.on('uncaughtException', (error) => {
    addLog(`キャッチされなかった例外: ${error}`);
});

if (process.platform === 'win32') {
    process.on('SIGHUP', () => handleShutdown('SIGHUP'));
}

// --- Initialization ---
const validateWebSocketUrl = (url: string): boolean => {
    return /^wss?:\/\/.+$/.test(url);
};

const initConfig = async () => {

    try {
        await fs.promises.access(CONFIG_FILE);
        const config: Config = loadConfig(); // 型注釈を追加
        addNotification(`設定ファイルから環境変数を読み込みました。`);

        // 不足しているキーをデフォルト値で補完
        for (const key in defaultConfig) {
            if (!config.hasOwnProperty(key)) {
                (config as Config)[key] = defaultConfig[key as keyof Config];
            }
        }
        saveConfig<Config>(config); // 型引数として Config を渡す
    } catch (error) {
        if ((error as any).code === "ENOENT") {
            addLog(
                `設定ファイルが見つかりませんでした。デフォルトの設定ファイルを作成します。`
            );
            saveConfig<Config>(defaultConfig); // 型引数として Config を渡す
        } else {
            addLog(`設定ファイルへのアクセス中にエラーが発生しました: ${error}`);
            process.exit(1);
        }
    }

    webSocketUrl = loadConfig().wssUrl || null;
    autoConnectOnStartup = loadConfig().autoConnectOnStartup || false;

    if (webSocketUrl && !validateWebSocketUrl(webSocketUrl)) {
        addLog(
            `エラー: 設定ファイル内のWSS_URLの形式が不正です。ws:// または wss:// で始まる必要があります。`,
        );
        addLog(`起動を中止します。WSS_URLを修正し、再度起動してください。`);
        process.exit(1);
    }

    if (webSocketUrl) {
        addNotification(`WebSocket URLが検出されました: ${webSocketUrl}`);
        try {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            if (isWebSocketServerOnline && autoConnectOnStartup) {
                addLog(`起動時の自動接続が有効です。WebSocketサーバーに接続します。`);
                await connectToWss(webSocketUrl);
            }
        } catch (error) {
            addLog(`WebSocketサーバーの状態確認中にエラーが発生しました: ${error}`);
        }
    }
};

// --- Start ---
(async () => {
    await initConfig();
    await initialize();
    displayMenu();
})();