import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import inquirer from 'inquirer';
import axios from 'axios';
import { spawn } from 'child_process';

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
let isWebSocketServerOnline = false;
const notifications: string[] = []; // 通知タブ用の通知を格納する配列
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};
let reconnectionStartTime: number | null = null;

// --- ログファイル名 ---
const LOG_FILE = path.join(process.cwd(), 'ClientV2.log.txt');

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

        ws.on('open', () => resolveAndClose(true)); // 接続成功時はオンライン
        ws.on('error', () => resolveAndClose(false)); // エラー発生時はオフライン
        setTimeout(() => resolveAndClose(false), 5000); // タイムアウト時もオフライン
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
    if (webSocketUrl && !envLoaded) { // 初回起動時のみWebSocketサーバーのステータスを確認
        try {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            log(
                'green',
                `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`,
            );
        } catch (error) {
            log(
                'red',
                `WebSocketサーバーの状態確認中にエラーが発生しました: ${error}`,
            );
        }
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

    // WebSocket接続
    if (autoConnectOnStartup) {
        if (wss) {
            wss.close();
        }
        await connectToWss(webSocketUrl);
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

        const timeout = 10000;
        const checkStatusPromise = checkWebSocketStatus(url);
        const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('WebSocket status check timed out')), timeout),
        );

        try {
            isWebSocketServerOnline = await Promise.race([checkStatusPromise, timeoutPromise]);
            log(
                'green',
                `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`,
            );

            if (isWebSocketServerOnline && autoConnectOnStartup) {
                const connectPromise = connectToWss(url);
                const connectTimeoutPromise = new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error('WebSocket connection timed out')), timeout),
                );

                await Promise.race([connectPromise, connectTimeoutPromise]);
                addNotification('WebSocketサーバーに接続しました。', "other");
            }
        } catch (error) {
            log('red', `WebSocketサーバーの状態確認または接続中にエラーが発生しました: ${error}`);
        }
    } catch (error) {
        log('red', 'エラーが発生しました: ' + error);
    } finally {
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
const connectToWss = async (url: string) => {
    return new Promise<void>(async (resolve, reject) => {
        // 接続試行前に isWebSocketServerOnline を false に設定
        isWebSocketServerOnline = false;

        // `wss`が既に存在する場合は、既存の接続を削除してnullにする
        if (wss) {
            wss.removeAllListeners();
            wss.close();
            wss = null;
        }

        // ngrok URLの取得処理 (必要であれば)
        if (url.includes('ngrok-free.app')) {
            try {
                const response = await axios.get('https://bfxmknk4-80.asse.devtunnels.ms/get_api');
                url = response.data;
                webSocketUrl = url; // グローバル変数も更新
                writeLog(`ngrok URLを更新しました: ${url}`);
                updateEnvFile('WSS_URL', url);
            } catch (error) {
                //log('red', `ngrok URLの取得に失敗しました: ${error}`);
                // 失敗した場合は、元のURLを使い続けるか、rejectして再試行を促すかを選択
                // return reject(error); // 例：失敗時にリジェクトする
            }
        }

        // 新しいWebSocket接続を確立
        wss = new WebSocket(url);
        // `open`イベント: 接続が開かれたとき
        wss.on('open', () => {
            clearInterval(reconnectionInterval!);
            reconnectionInterval = null;
            isWebSocketServerOnline = true;
            reconnectionStartTime = null; // 接続成功時にリセット
            writeLog(`WebSocketサーバーに接続しました。`); // 接続が確立されたときにログに記録
            addNotification(`WebSocketサーバーに接続しました。`, 'connection'); // 接続が確立されたときに通知
            resolve(); // プロミスを解決
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

                if (message.command) {
                    const world = server.getWorlds()[0];

                    if (world) {
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
                    }

                }
            } catch (error) {
            }
        });

        // `close`イベント: 接続が閉じられたとき
        wss.on('close', () => {
            // `isWebSocketServerOnline`が`true`の場合にのみ切断通知を出す
            // これにより、接続されていないときや切断通知が既に処理されたときに、誤った通知が表示されるのを防ぐ
            if (isWebSocketServerOnline) {
                addNotification(`WebSocketサーバーから切断されました。`, 'disconnection');
                writeLog('WebSocketサーバーから切断されました。');
                isWebSocketServerOnline = false;
            }

            // 再接続試行開始タイムスタンプを設定 (初めての切断時のみ)
            if (reconnectionStartTime === null) {
                reconnectionStartTime = Date.now();
            }

            // 自動再接続が有効な場合に再接続を試みる
            if (webSocketUrl && autoConnectOnStartup) {
                reconnect()
                    .then(() => resolve())  // 再接続が成功したらresolveを呼ぶ
                    .catch(reject); // 再接続が失敗したらrejectを呼ぶ
            }
        });

        // `error`イベント: エラーが発生したとき
        wss.on('error', (error) => {
            // `isWebSocketServerOnline`が`true`の場合にのみエラーを記録
            // 接続がまだ確立されていないか、既に切断されている場合にエラーが記録されるのを防ぐ
            if (isWebSocketServerOnline) {
                writeLog(`WebSocketエラー: ${error}`);
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

                addNotification(`${COLOR_YELLOW}WebSocketサーバーへの再接続を試みています...${COLOR_RESET}`, 'other');

                connectToWss(webSocketUrl!)
                    .then(() => {
                        clearInterval(reconnectionInterval!);
                        resolve();
                    })
                    .catch(() => { /* エラーは無視して再試行を続ける */ });
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
        addNotification(`WebSocketが接続されていません。`, "other");
    }
};

// --- Server Setup and Event Handlers ---

const server = new Server({
    port: parseInt(process.env.SOCKET_BE_PORT || '8000'),
    timezone: process.env.TIMEZONE || 'Asia/Tokyo',
});

server.events.on('serverOpen', async () => {
    log('green', 'Minecraft server started.');

    // worldAdd イベントをリッスン
    server.events.on('worldAdd', async () => {
        if (webSocketUrl) {
            try {
                isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
                writeLog(`WebSocket server is ${isWebSocketServerOnline ? 'online' : 'offline'}.`);
                if (autoConnectOnStartup && isWebSocketServerOnline) {
                    writeLog('Attempting to connect to WebSocket server.');
                    await connectToWss(webSocketUrl);
                }
            } catch (error) {
                writeLog(`Error checking WebSocket server status: ${error}`);
            }
        }
    });
});

server.events.on('worldAdd', async (event) => {
    sendDataToWss('worldAdd', {});
    addNotification(`Minecraftサーバーに接続しました。`, 'connection');
    const { world } = event;
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

// 再起動関数の追加
const restartApp = () => {
    console.log('アプリケーションを再起動します...');
    // 現在のプロセスを新しいプロセスで置き換える
    spawn(process.execPath, process.argv.slice(1), {
        cwd: process.cwd(),
        detached: true,
        stdio: 'inherit'
    }).unref();
    process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('exit', (code) => {
    if (code !== 0) {
        log('red', `異常終了 コード: ${code}`);
        restartApp(); // 再起動を行う場合
    }
});

// エラーハンドリングの追加
process.on('uncaughtException', (error) => {
    log('red', `キャッチされなかった例外: ${error}`);
    restartApp(); // 再起動を行う場合
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
        try {
            // 初期化時にWebSocketサーバーの状態を確認
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            writeLog(`WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`);
            if (isWebSocketServerOnline && autoConnectOnStartup) {
                writeLog(`起動時の自動接続が有効です。WebSocketサーバーに接続します。`);
                await connectToWss(webSocketUrl);
            }
        } catch (error) {
            writeLog(`WebSocketサーバーの状態確認中にエラーが発生しました: ${error}`);
        }
    }
};

// --- Start ---
(async () => {

    await initEnv();
    envLoaded = false;
    displayMenu();
})();