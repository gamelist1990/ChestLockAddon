import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import inquirer from 'inquirer';
import axios from 'axios';

// --- Constants ---
const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RESET = '\x1b[0m';

const RECONNECT_INTERVAL = 5000;
const MAX_NOTIFICATIONS = 50; // 通知タブに表示する最大通知数
const RECONNECTION_TIMEOUT = 3 * 60 * 1000; // 3分

// --- Global Variables ---
let wss: WebSocket | null = null;
let reconnectionInterval: NodeJS.Timeout | null;
let envLoaded = false;
let autoConnectOnStartup = false;
let webSocketUrl: string | null = null;
let isWebSocketServerOnline = false; // WebSocket サーバーのオンライン状態 (初期値は false)
const notifications: string[] = []; // 通知タブ用の通知を格納する配列
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};
let reconnectionStartTime: number | null = null;

// --- ログファイル名 ---
const LOG_FILE = path.join(process.cwd(), 'ClientV3.log.txt');

// --- ログ記録用関数 ---
const writeLog = (message: string) => {
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: process.env.TIMEZONE || 'Asia/Tokyo' });
    const logMessage = `[${timestamp}] ${message}\n`;

    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('ログファイルへの書き込みエラー:', error);
    }
};

// --- Helper Functions ---

const clearConsole = () => console.clear();

const log = (color: string, message: string) => {
    switch (color) {
        case 'red':
            console.log(COLOR_RED + message + COLOR_RESET);
            writeLog(message);
            break;
        case 'green':
            console.log(COLOR_GREEN + message + COLOR_RESET);
            writeLog(message);
            break;
        case 'yellow':
            console.log(COLOR_YELLOW + message + COLOR_RESET);
            writeLog(message);
            break;
        default:
            console.log(message);
            writeLog(message);
    }
};

// addNotification関数は、接続成功と切断時のみ通知するように変更
const addNotification = (message: string, type: 'connection' | 'disconnection' | 'other' = 'other') => {
    notifications.push(message);
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications.shift(); // 古い通知を削除
    }
};

// displayNotifications関数は通知タブの内容を表示するように変更
const displayNotifications = async () => {
    clearConsole();
    if (notifications.length === 0) {
        console.log('通知はありません。\n');
        writeLog('通知はありません。');
    } else {
        notifications.forEach((notification) => console.log(notification));
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
        addNotification(`${COLOR_GREEN}.envファイルが更新されました。${COLOR_RESET}`, 'other');
        log('green', '.envファイルが更新されました。');
    } catch (error) {
        // addNotification(`${COLOR_RED}.envファイルの更新中にエラーが発生しました: ${error}${COLOR_RESET}`); // 通知しない
        log('red', `.envファイルの更新中にエラーが発生しました: ${error}`);
    }
};

// WebSocket サーバーのステータスを確認する関数
const checkWebSocketStatus = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        // WebSocketのパスが /minecraft で終わる場合は、それを /isOnline に置き換える
        const statusUrl = url.endsWith('/minecraft') ? url.replace(/\/minecraft$/, '/isOnline') : url;

        const ws = new WebSocket(statusUrl);
        let resolved = false;

        const resolveAndClose = (value: boolean) => {
            if (!resolved) {
                resolved = true;
                resolve(value);
                ws.close();
            }
        };

        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'isOnline' }));
        });

        ws.on('message', (data: any) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.status === 'online') {
                    resolveAndClose(true);
                } else {
                    resolveAndClose(false);
                }
            } catch (error) {
                console.error(`WebSocketステータス確認エラー: ${error}`);
                resolveAndClose(false);
            }
        });

        ws.on('error', (error) => {
            console.error(`WebSocketエラー: ${error}`);
            resolveAndClose(false);
        });

        // 5秒後にタイムアウト
        setTimeout(() => resolveAndClose(false), 5000);
    });
};

async function extractPlayerName(
    playerNameWithTags: string,
): Promise<{ name: string; uuid: string } | null> {
    // キャッシュに存在すればそれを返す
    if (playerNameCache[playerNameWithTags]) {
        return playerNameCache[playerNameWithTags];
    }

    const world = server.getWorlds()[0];
    if (!world) {
        return null;
    }

    // testfor コマンドでプレイヤーを検索
    const playerListResult = await world.runCommand(`testfor @a`);
    if (playerListResult.statusCode !== 0 || !playerListResult.victim) {
        return null;
    }

    // プレイヤーリストから目的のプレイヤーを探す
    for (const realPlayerName of playerListResult.victim) {
        if (playerNameWithTags.includes(realPlayerName)) {
            // querytarget コマンドでプレイヤーの詳細情報を取得
            const queryResult = await world.runCommand(`querytarget @a[name="${realPlayerName}"]`);
            if (queryResult.statusCode === 0 && queryResult.details !== '[]') {
                const playerData = JSON.parse(queryResult.details);
                if (playerData && playerData.length > 0) {
                    const playerInfo = {
                        name: realPlayerName,
                        uuid: playerData[0].uniqueId,
                    };
                    // キャッシュに保存
                    playerNameCache[playerNameWithTags] = playerInfo;
                    return playerInfo;
                }
            }
        }
    }

    return null;
}

// --- UI Functions ---

const displayMenu = async () => {
    // WebSocket サーバーのステータスを再確認
    if (webSocketUrl) {
        isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
        log('green', `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`);
    }

    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

    const choices = [
        'サーバーに再接続',
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
        }`,
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

        await handleMenuChoice(choices.indexOf(answers.menuChoice) + 1);
    } catch (error) {
        log('red', 'エラーが発生しました: ' + error);
    }
};
const handleMenuChoice = async (choice: number) => {
    switch (choice) {
        case 1:
            await restartWss();
            break;
        case 2:
            await setupWebSocketUrl();
            break;
        case 3:
            await toggleAutoConnect();
            break;
        case 4:
            await displayNotifications();
            break;
        case 5:
            console.log('終了します...');
            process.exit(0);
            break;
        default:
            log('red', '無効な選択です。もう一度お試しください。');
            setTimeout(displayMenu, 1000);
    }
};

const restartWss = async () => {
    clearConsole();

    // .envファイルを再読み込み
    envLoaded = false; // フラグをリセット
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        config({ path: envPath, override: true });
        envLoaded = true;
        log('green', '.envファイルを再読み込みしました。');
    } catch (error) {
        log('red', `.envファイルの再読み込み中にエラーが発生しました: ${error}`);
        // 必要に応じてデフォルト値を設定
    }

    // グローバル変数を更新
    webSocketUrl = process.env.WSS_URL || null;
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

    // WebSocketサーバーのステータス表示を更新
    if (webSocketUrl) {
        log('yellow', `WebSocketサーバーURL: ${webSocketUrl}\n`);
        isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
        log('yellow', `WebSocketサーバー: ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'}\n`);
        if (!isWebSocketServerOnline) {
            log('red', 'WebSocketサーバーに接続されていません。');
        }
    } else {
        log('red', `エラー: WebSocket URLが設定されていません。`);
        return;
    }
    if (!autoConnectOnStartup) {
        log('yellow', `起動時の自動接続が無効になっています。`);
    }

    // WebSocket接続 (Minecraft サーバーへの接続を再試行)
    if (autoConnectOnStartup) {
        if (wss) {
            wss.close();
            wss = null; // 既存の接続をリセット
        }
        connectToMinecraftWss(); // Minecraft サーバーへの再接続を試行
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

const setupWebSocketUrl = async () => {
    try {
        const answers = await inquirer.prompt([
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

        let url = answers.url.trim();

        webSocketUrl = url;
        updateEnvFile('WSS_URL', url);
        config({ path: path.resolve(process.cwd(), '.env'), override: true });
        autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';
        envLoaded = true;
        log('green', `WebSocket URLが設定されました: ${url}`);

        // WebSocket サーバーのステータスを確認
        isWebSocketServerOnline = await checkWebSocketStatus(url);
        log('green', `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`);

        // オンラインでかつ自動接続が有効な場合、Minecraft サーバーに接続
        if (isWebSocketServerOnline && autoConnectOnStartup) {
            connectToMinecraftWss();
            addNotification('WebSocketサーバーに接続しました。', 'other');
        }
    } catch (error) {
        log('red', 'エラーが発生しました: ' + error);
    } finally {
        // WebSocket サーバーのステータスを再確認して表示を更新
        if (webSocketUrl) {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
        }
        displayMenu();
    }
};

const toggleAutoConnect = async () => {
    autoConnectOnStartup = !autoConnectOnStartup;
    updateEnvFile('AUTO_CONNECT_ON_STARTUP', autoConnectOnStartup.toString());
    config({ path: path.resolve(process.cwd(), '.env'), override: true });
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';
    const message = `${COLOR_GREEN}起動時の自動接続が ${autoConnectOnStartup ? '有効' : '無効'} になりました。${COLOR_RESET}`;
    log('white', message);
    displayMenu();
};

// --- WebSocket Functions ---

// Minecraft サーバーに接続するための関数
const connectToMinecraftWss = async () => {
    if (!webSocketUrl) {
        log('red', 'エラー: WebSocket URLが設定されていません。');
        return;
    }

    if (wss) {
        wss.removeAllListeners();
        wss.close();
        wss = null;
    }

    // 実際のゲームデータ通信用の WebSocket 接続 (Minecraft 用)
    wss = new WebSocket(webSocketUrl);

    wss.on('open', () => {
        clearInterval(reconnectionInterval!);
        reconnectionInterval = null;
        isWebSocketServerOnline = true;
        reconnectionStartTime = null;
        log('green', 'Minecraftサーバーに接続しました。');
        addNotification('Minecraftサーバーに接続しました。', 'connection');
    });

    wss.on('message', async (data: string) => {
        try {
            if (!data) {
                addNotification('空のメッセージを受信しました。', 'other');
                return;
            }
            let message: any;
            try {
                message = JSON.parse(data);
            } catch (error) {
                addNotification(`無効なJSONメッセージを受信しました: ${error}`, 'other');
                return;
            }

            // 'event' フィールドをチェックして、コマンド実行リクエストかどうかを判定
            if (message.event === 'commandRequest') {
                const world = server.getWorlds()[0];

                if (world) {
                    switch (message.data.command) {
                        case 'sendMessage':
                            if (message.data.playerName) {
                                await world.sendMessage(message.data.message, message.data.playerName);
                            } else {
                                await world.sendMessage(message.data.message);
                            }
                            break;
                        default:
                            const commandResult = await world.runCommand(message.data.command);
                            sendDataToWss('commandResult', {
                                result: commandResult,
                                command: message.data.command,
                                commandId: message.data.commandId,
                            });
                            break;
                    }
                }
            }
        } catch (error) {
            console.error('メッセージ処理エラー:', error);
        }
    });

    wss.on('close', () => {
        if (isWebSocketServerOnline) {
            addNotification('Minecraftサーバーから切断されました。', 'disconnection');
            writeLog('Minecraftサーバーから切断されました。');
            isWebSocketServerOnline = false;
        }

        if (reconnectionStartTime === null) {
            reconnectionStartTime = Date.now();
        }

        if (webSocketUrl && autoConnectOnStartup) {
            reconnect()
                .then(() => {
                    log('green', 'Minecraftサーバーへの再接続に成功しました。');
                })
                .catch((error) => {
                    log('red', `Minecraftサーバーへの再接続に失敗しました: ${error}`);
                });
        }
    });

    wss.on('error', (error) => {
        if (isWebSocketServerOnline) {
            log('red', `MinecraftサーバーとのWebSocketエラー: ${error}`);
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

        const attemptReconnect = async () => {
            if (!isWebSocketServerOnline) {
                const elapsedTime = reconnectionStartTime ? Date.now() - reconnectionStartTime : 0;

                // 3分以上経過しているかチェック
                if (elapsedTime >= RECONNECTION_TIMEOUT) {
                    log('yellow', '再接続試行開始から3分が経過しました。ngrok URLの再取得を試みます。');
                    reconnectionStartTime = Date.now(); // タイムスタンプをリセット

                    // ngrok URLを再取得
                    try {
                        const response = await axios.get('https://bfxmknk4-80.asse.devtunnels.ms/get_api');
                        const newWebSocketUrl = response.data;
                        if (newWebSocketUrl !== webSocketUrl) {
                            webSocketUrl = newWebSocketUrl;
                            addNotification(`ngrok URLを更新しました: ${webSocketUrl}`);
                            if (webSocketUrl) {
                                updateEnvFile('WSS_URL', webSocketUrl);
                            }
                        } else {
                            addNotification('ngrok URLは変更されていません。');
                        }
                    } catch (error) {
                        addNotification(`ngrok URLの再取得に失敗しました: ${error}`);
                    }
                }

                addNotification(`${COLOR_YELLOW}Minecraftサーバーへの再接続を試みています...${COLOR_RESET}`, 'other');

                // Minecraft サーバーへの接続を試みる
                connectToMinecraftWss();
            }
        };

        reconnectionInterval = setInterval(attemptReconnect, RECONNECT_INTERVAL);
        attemptReconnect();
    });
};

// 他のWebSocketサーバーにデータを送信するための関数
const sendDataToWss = (event: string, data: any) => {
    if (wss && wss.readyState === WebSocket.OPEN) {
        wss.send(JSON.stringify({ event, data }));
    } else {
        addNotification(`WebSocketが接続されていません。`, 'other');
    }
};

// --- Server Setup and Event Handlers ---

const server = new Server({
    port: parseInt(process.env.SOCKET_BE_PORT || '8000'),
    timezone: process.env.TIMEZONE || 'Asia/Tokyo',
});

server.events.on('serverOpen', async () => {
    log('green', 'Minecraftサーバーが起動しました。');

    // worldAdd イベントをリッスン (サーバー起動後に発生)
    server.events.on('worldAdd', async () => {
        log('green', 'ワールドが追加されました。');

        if (webSocketUrl) {
            try {
                // WebSocket サーバーのオンライン状態を確認
                isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
                log('green', `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`);

                // オンラインでかつ自動接続が有効な場合、Minecraft サーバーに接続
                if (isWebSocketServerOnline && autoConnectOnStartup) {
                    log('green', 'WebSocketサーバーに接続します。');
                    await connectToMinecraftWss();
                }
            } catch (error) {
                log('red', `WebSocketサーバーの状態確認中にエラーが発生しました: ${error}`);
            }
        }
    });
});

server.events.on('worldAdd', async () => {
    sendDataToWss('worldAdd', {});
    addNotification(`Minecraftサーバーに接続しました。`, 'connection');
    const world = server.getWorlds()[0];
    world.subscribeEvent('ItemUsed');
    world.subscribeEvent('PlayerDied');
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
    log('white', `${signal}を受信しました。プロセスをクリアします。`);
    clearInterval(reconnectionInterval!);
    try {
        sendDataToWss('serverShutdown', {});
    } catch (error) {
        log('red', `WSSへのサーバーシャットダウンの送信中にエラーが発生しました: ${error}`);
    } finally {
        log('white', `Node.jsアプリケーションを終了します。`);
        wss?.close();
        process.exit(0);
    }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('exit', (code) => {
    if (code !== 0) {
        log('red', `異常終了 コード: ${code}`);
    }
});

// エラーハンドリングの追加
process.on('uncaughtException', (error) => {
    log('red', `キャッチされなかった例外: ${error}`);
});

if (process.platform === 'win32') {
    process.on('SIGHUP', () => handleShutdown('SIGHUP'));
}

// --- Initialization ---

const validateWebSocketUrl = (url: string): boolean => {
    return /^wss?:\/\/.+$/.test(url);
};

const initEnv = async () => {
    const envPath = path.resolve(process.cwd(), '.env');
    const defaultEnvContent = `# 自動的に作成された.envファイル\n# ここに設定値を記入してください\nWSS_URL="WebSocketサーバーURL"\nAUTO_CONNECT_ON_STARTUP="false" # 起動時の自動接続 (true or false)\nSOCKET_BE_PORT="8000" # ソケットビーサーバーのポート番号\nTIMEZONE="Asia/Tokyo" # タイムゾーン\n`;

    const createDefaultEnvFile = async (filePath: string) => {
        try {
            await fs.promises.writeFile(filePath, defaultEnvContent);
            log('yellow', `デフォルトの.envファイルが ${filePath} に作成されました`);
        } catch (error) {
            log('red', `デフォルトの.envファイルの作成中にエラーが発生しました: ${error}`);
            process.exit(1);
        }
    };

    try {
        await fs.promises.access(envPath);
        config({ path: envPath });
        log('green', `.envファイルから環境変数を読み込みました。`);
        addNotification(`.envファイルから環境変数を読み込みました。`, 'other');
        envLoaded = true;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            log('yellow', `システムまたは.envファイルから環境変数を読み込めませんでした。`);
            await createDefaultEnvFile(envPath);
            config({ path: envPath });
            envLoaded = false;
        } else {
            log('red', `.envファイルへのアクセス中にエラーが発生しました: ${error}`);
            process.exit(1);
        }
    }

    webSocketUrl = process.env.WSS_URL || null;
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

    if (webSocketUrl && !validateWebSocketUrl(webSocketUrl)) {
        console.log(
            `${COLOR_RED}エラー: .envファイル内のWSS_URLの形式が不正です。ws:// または wss:// で始まる必要があります。${COLOR_RESET}`,
        );
        console.log(`${COLOR_RED}起動を中止します。WSS_URLを修正し、再度起動してください。${COLOR_RESET}`);
        process.exit(1);
    }

    if (webSocketUrl) {
        writeLog(`WebSocket URLが検出されました: ${webSocketUrl}`);
        addNotification(`WebSocket URLが検出されました: ${webSocketUrl}`, 'other');
    }
};

// --- Start ---
(async () => {
    await initEnv();
    envLoaded = false;
    displayMenu();
})();