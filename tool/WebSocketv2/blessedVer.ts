import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import inquirer from 'inquirer';
import axios from 'axios';
import blessed from 'blessed';

// --- Constants ---
const RECONNECT_INTERVAL = 5000;
const MAX_NOTIFICATIONS = 50; // 通知タブに表示する最大通知数
const RECONNECTION_TIMEOUT = 3 * 60 * 1000; // 3分

// --- Global Variables ---
let wss: WebSocket | null = null;
let reconnectionInterval: NodeJS.Timer | null;
let envLoaded = false;
let autoConnectOnStartup = false;
let webSocketUrl: string | null = null;
let isWebSocketServerOnline = false;
const notifications: string[] = []; // 通知タブ用の通知を格納する配列
const playerNameCache: { [key: string]: { name: string; uuid: string } } = {};
const playerUuidCache: { [key: string]: string } = {}; // プレイヤー名からUUIDを引くためのキャッシュ
let reconnectionStartTime: number | null = null;

// --- ログファイル名 ---
const LOG_FILE = path.join(process.cwd(), 'ClientV3.log.txt');

// --- Blessed UI Elements ---
// blessedのscreenを使用するよう変更
const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
});

// 画面のリサイズを処理するイベントリスナーを追加
screen.on('resize', () => {
    logBox.emit('attach');
    notificationBox.emit('attach');
    statusBox.emit('attach');
    menu.emit('attach');
});

const logBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '66%',
    height: '70%',
    border: { type: 'line' },
    label: 'Server Log',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
        style: {
            bg: 'blue', // スクロールバーの背景色を設定
        },
    }
});

const notificationBox = blessed.log({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '50%',
    height: '30%',
    border: { type: 'line' },
    label: 'Notifications',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
        style: {
            bg: 'blue', // スクロールバーの背景色を設定
        },
    }
});

const statusBox = blessed.box({
    parent: screen,
    top: 0,
    right: 0,
    width: '34%',
    height: '30%',
    border: { type: 'line' },
    label: 'Status',
    content: 'Status: Offline',
    style: {
        fg: 'red',
        border: {
            fg: '#f0f0f0',
        },
    },
});

const menu = blessed.list({
    parent: screen,
    top: '30%',
    right: 0,
    width: '34%',
    height: '70%',
    border: { type: 'line' },
    label: 'Menu',
    keys: true,
    mouse: true,
    style: {
        fg: 'white',
        selected: {
            bg: 'blue',
        },
        border: {
            fg: '#f0f0f0',
        },
    },
    items: ['Connect', 'Set URL', 'Toggle AutoConnect', 'Exit'],
});

// ログ出力のテスト
logBox.log('Server started.');
logBox.log('Monitoring activity...');

// --- ログ記録用関数 ---
const writeLog = (message: string) => {
    const timestamp = new Date().toLocaleString('ja-JP', {
        timeZone: process.env.TIMEZONE || 'Asia/Tokyo',
    });
    const logMessage = `[${timestamp}] ${message}\n`;

    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('ログファイルへの書き込みエラー:', error);
    }
};

// --- Helper Functions ---

// clearConsole関数の調整 blessedでは直接画面クリアをサポートしていないため、
// 以下の方法を試します。
const clearConsole = () => {
    // ターミナルタイプを取得する
    const isTTY = process.stdout.isTTY;
    const isWindowsTerminal = process.env.WT_SESSION;
    const isTrueColor = process.env.COLORTERM === 'truecolor';

    if (isTTY && (isWindowsTerminal || isTrueColor)) {
        // Windows Terminalやtruecolorをサポートするターミナルでの処理
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // 画面全体とスクロールバッファをクリア
    } else if (isTTY) {
        // 一般的なターミナルでの処理
        process.stdout.write('\x1b[2J\x1b[H'); // 画面をクリアしてカーソルをホームポジションに移動
    } else {
        // blessedの場合、次のような方法でコンテンツをクリアして再描画できる
        logBox.setContent('');
        notificationBox.setContent('');
        screen.render();
    }

    // エラー発生後、後続の出力を次の行から開始させる
    if (isTTY) {
        process.stdout.write('\n'); // 標準出力（TTY）の場合、改行を1つ書き込む
    }
};

// blessed を使って書き直したlog関数
const log = (color: string, message: string) => {
    const colorMap: { [key: string]: string } = {
        red: 'red',
        green: 'green',
        yellow: 'yellow',
        white: 'white',
    };

    const logColor = colorMap[color] || 'white';
    logBox.log(`{${logColor}-fg}${message}{/${logColor}-fg}`);
    writeLog(message);
};

// addNotification関数は、接続成功と切断時のみ通知するように変更
const addNotification = (
    message: string,
    type: 'connection' | 'disconnection' | 'other' = 'other',
) => {
    // メッセージの前にタイムスタンプを追加
    const timestamp = new Date().toLocaleTimeString('ja-JP', {
        timeZone: process.env.TIMEZONE || 'Asia/Tokyo',
    });
    const timedMessage = `[${timestamp}] ${message}`;

    notifications.push(timedMessage);
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications.shift(); // 古い通知を削除
    }
    // 通知をログに記録し、blessedのログボックスに追加
    notificationBox.log(timedMessage);
    writeLog(`[Notification] ${message}`); // 必要に応じて、このログを通知専用のログファイルに記録することも検討してください
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
        addNotification(`.envファイルが更新されました。`, 'other');
        log('green', '.envファイルが更新されました。');
    } catch (error) {
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

    try {
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
                        playerUuidCache[realPlayerName] = playerData[0].uniqueId;
                        return playerInfo;
                    }
                }
            }
        }
    } catch (error) {
        log('red', `プレイヤー情報の取得中にエラーが発生しました: ${error}`);
        return null;
    }

    return null;
}

// --- UI Functions ---
const updateStatus = async () => {
    statusBox.setContent(
        `WebSocket: ${isWebSocketServerOnline ? '{green-fg}Online{/green-fg}' : '{red-fg}Offline{/red-fg}'
        }\nURL: ${webSocketUrl || 'N/A'}\nAutoConnect: ${autoConnectOnStartup ? 'On' : 'Off'}`,
    );
    screen.render();
};

const initialize = async () => {
    try {
        // .envファイルを読み込み
        config({ path: path.resolve(process.cwd(), '.env'), override: true });
        envLoaded = true;
        log('green', '.envファイルを読み込みました。');

        // 環境変数から設定を読み込み
        webSocketUrl = process.env.WSS_URL || null;
        autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

        // WebSocketサーバーの状態を確認して、UIを更新
        if (webSocketUrl) {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            log(
                'green',
                `WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。`,
            );
            if (isWebSocketServerOnline && autoConnectOnStartup) {
                log('green', '起動時の自動接続が有効です。WebSocketサーバーに接続します。');
                await connectToWss(webSocketUrl);
            }
        }

        // UIの状態を更新
        await updateStatus();
        screen.render();
    } catch (error) {
        log('red', `初期化中にエラーが発生しました: ${error}`);
        addNotification(`初期化中にエラーが発生しました: ${error}`, 'other');
    }
};

const displayMenu = async () => {
    updateStatus();
    screen.render();

    // メニューの選択項目とコールバック関数を定義する
    const menuCallbacks: { [key: string]: () => Promise<void> } = {
        'Connect': async () => {
            // サーバーに接続するためのコード
            if (webSocketUrl) {
                await connectToWss(webSocketUrl);
            } else {
                log('red', 'エラー: WebSocket URLが設定されていません。');
            }
        },
        'Set URL': configureWebSocketUrl,
        'Toggle AutoConnect': toggleAutoConnect,
        'Exit': () => {
            // 終了処理
            log('white', 'アプリケーションを終了します。');
            screen.destroy();
            process.exit(0);
        },
    };

    menu.on('select', (item, index) => {
        // メニュー選択時に、選択項目に応じて対応するコールバック関数を呼び出す
        const selectedMenu = item.content; // 選択項目のテキストを取得
        const callback = menuCallbacks[selectedMenu]; // テキストに対応するコールバック関数を取得

        if (callback) {
            callback();
        }
    });

    menu.focus();
    screen.render();
};

const reconnectWebSocket = async () => {
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
        writeLog(`WebSocketサーバーURL: ${webSocketUrl}\n`);
        try {
            isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
            writeLog(`WebSocketサーバー: ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'}\n`);
        } catch (error) {
            writeLog(`WebSocketサーバーの状態確認中にエラーが発生しました: ${error}`);
            isWebSocketServerOnline = false;
        }
        if (!isWebSocketServerOnline) {
            writeLog('WebSocketサーバーに接続されていません。');
        }
    } else {
        log('red', `エラー: WebSocket URLが設定されていません。`);
        return;
    }
    if (!autoConnectOnStartup) {
        writeLog(`起動時の自動接続が無効になっています。`);
    }

    // WebSocket接続
    if (autoConnectOnStartup) {
        await connectToWss(webSocketUrl);
    }

    updateStatus();
    screen.render();
};

const configureWebSocketUrl = async () => {
    const handleUrlConfirmation = async () => {
        if (webSocketUrl) {
            try {
                const { useExistingUrl } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'useExistingUrl',
                        message: `既にWebSocket URLが設定されています: ${webSocketUrl}\nこのURLを使用しますか？`,
                        default: true,
                    },
                ]);

                if (useExistingUrl) {
                    log('green', `既存のWebSocket URLを使用します: ${webSocketUrl}`);
                    displayMenu();
                    return;
                }
            } catch (error) {
                log('red', 'エラーが発生しました: ' + error);
                return;
            }
        }
        handleUrlInput();
    };

    const handleUrlInput = async () => {
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

            webSocketUrl = url.trim();
            if (webSocketUrl) {
                updateEnvFile('WSS_URL', webSocketUrl);
            }
            config({ path: path.resolve(process.cwd(), '.env'), override: true });
            autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';
            envLoaded = true;
            log('green', `WebSocket URLが設定されました: ${webSocketUrl}`);

            const checkStatusAndConnect = async () => {
                const timeout = 10000;
                const checkStatusPromise = checkWebSocketStatus(webSocketUrl!);
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
                        const connectPromise = connectToWss(webSocketUrl!);
                        const connectTimeoutPromise = new Promise<void>((_, reject) =>
                            setTimeout(() => reject(new Error('WebSocket connection timed out')), timeout),
                        );

                        await Promise.race([connectPromise, connectTimeoutPromise]);
                        addNotification('WebSocketサーバーに接続しました。', 'other');
                    }
                } catch (error) {
                    log('red', `WebSocketサーバーの状態確認または接続中にエラーが発生しました: ${error}`);
                } finally {
                    if (webSocketUrl) {
                        isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
                        updateStatus();
                        screen.render();
                    }
                    displayMenu();
                }
            };

            checkStatusAndConnect();
        } catch (error) {
            log('red', 'エラーが発生しました: ' + error);
        }
    };

    handleUrlConfirmation();
};

const toggleAutoConnect = async () => {
    autoConnectOnStartup = !autoConnectOnStartup;
    updateEnvFile('AUTO_CONNECT_ON_STARTUP', autoConnectOnStartup.toString());
    config({ path: path.resolve(process.cwd(), '.env'), override: true });
    autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';
    const message = `起動時の自動接続が ${autoConnectOnStartup ? '有効' : '無効'} になりました。`;
    log('white', message);
    updateStatus();
    screen.render();
};

// --- WebSocket Functions ---
const connectToWss = async (url: string) => {
    return new Promise<void>(async (resolve, reject) => {
        // 接続試行前に isWebSocketServerOnline を false に設定
        isWebSocketServerOnline = false;
        if (wss) {
            // 既存のイベントリスナーを削除
            wss.removeAllListeners();
            wss.removeAllListeners();
            wss.removeAllListeners();
            await wss.removeAllListeners();
            wss.close();
            wss = null;
        }

        // 新しいWebSocket接続を確立
        wss = new WebSocket(url);
        wss.setMaxListeners(50);

        // `open`イベント: 接続が開かれたとき
        wss.on('open', () => {
            clearInterval(reconnectionInterval!);
            reconnectionInterval = null;
            isWebSocketServerOnline = true;
            reconnectionStartTime = null; // 接続成功時にリセット
            writeLog(`WebSocketサーバーに接続しました。`); // 接続が確立されたときにログに記録
            addNotification(`WebSocketサーバーに接続しました。`, 'connection'); // 接続が確立されたときに通
            resolve();
        });

        wss.on('message', async (data: string) => {
            try {
                if (!data) {
                    addNotification('空のメッセージを受信しました。', 'other');
                    return;
                }
                let message: any;
                try {
                    message = JSON.parse(data.toString());
                } catch (error) {
                    addNotification(`無効なJSONメッセージを受信しました: ${error}`, 'other');
                    return;
                }

                if (message.command) {
                    const world = server.getWorlds()[0];

                    if (world) {
                        try {
                            // エラーハンドリングを追加
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
                log('red', `メッセージ処理中にエラーが発生しました: ${error}`);
            }
        });

        // `close`イベント: 接続が閉じられたとき
        wss.on('close', async () => {
            // `isWebSocketServerOnline`が`true`の場合にのみ切断通知を出す
            // これにより、接続されていないときや切断通知が既に処理されたときに、誤った通知が表示されるのを防ぐ
            if (isWebSocketServerOnline) {
                addNotification(`WebSocketサーバーから切断されました。`, 'disconnection');
                writeLog('WebSocketサーバーから切断されました。');
                updateStatus();
                screen.render();
                isWebSocketServerOnline = false;
            }

            // 再接続試行開始タイムスタンプを設定 (初めての切断時のみ)
            if (reconnectionStartTime === null) {
                reconnectionStartTime = Date.now();
            }

            // 自動再接続が有効な場合に再接続を試みる
            if (webSocketUrl && autoConnectOnStartup) {
                reconnect()
                    .then(() => resolve()) // 再接続が成功したらresolveを呼ぶ
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

                // WSS_URLがngrok URL (ngrok-free.app を含む) の場合のみ、3分経過後に再取得を試みる
                if (
                    webSocketUrl &&
                    webSocketUrl.includes('ngrok-free.app') &&
                    elapsedTime >= RECONNECTION_TIMEOUT
                ) {
                    writeLog('再接続試行開始から3分が経過しました。ngrok URLの再取得を試みます。');
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

                addNotification(`WebSocketサーバーへの再接続を試みています...`, 'other');

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
        addNotification(`WebSocketが接続されていません。`, 'other');
    }
};

// --- Server Setup and Event Handlers ---

const server = new Server({
    port: parseInt(process.env.SOCKET_BE_PORT || '8000'),
    timezone: process.env.TIMEZONE || 'Asia/Tokyo',
});
server.setMaxListeners(50);

server.events.on('serverOpen', async () => {
    log('green', 'Minecraft server started.');

    // worldAdd イベントをリッスン
    server.events.on('worldAdd', async () => {
        if (webSocketUrl && autoConnectOnStartup && isWebSocketServerOnline) {
            try {
                writeLog('Attempting to connect to WebSocket server.');
                await connectToWss(webSocketUrl);
            } catch (error) {
                writeLog(`Error connecting to WebSocket server: ${error}`);
            }
        }
        // worldAdd イベントの共通処理
        sendDataToWss('worldAdd', {});
        addNotification(`Minecraftサーバーに接続しました。`, 'connection');
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
    // プレイヤーが退出したらキャッシュから情報を削除
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
    log('white', `${signal}を受信しました。プロセスをクリアします。`);
    clearInterval(reconnectionInterval!);
    try {
        sendDataToWss('serverShutdown', {});
    } catch (error) {
        log('red', `WSSへのサーバーシャットダウンの送信中にエラーが発生しました: ${error}`);
    } finally {
        log('white', `Node.jsアプリケーションを終了します。`);
        wss?.close();
        screen.destroy();
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
        config({ path: envPath }); // 1回だけ呼び出す
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
        log(
            'red',
            `エラー: .envファイル内のWSS_URLの形式が不正です。ws:// または wss:// で始まる必要があります。`,
        );
        log('red', `起動を中止します。WSS_URLを修正し、再度起動してください。`);
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
    screen.key(['escape', 'q', 'C-c'], () => {
        screen.destroy();
        return process.exit(0);
    });
    await initEnv();
    envLoaded = false;
    initialize(); // 初期化処理
    displayMenu();
})();