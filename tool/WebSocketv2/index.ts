import { Server } from 'socket-be';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import inquirer from 'inquirer';
import { ItemUsed, PlayerDied } from './interface';

// --- Constants ---
const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_RESET = '\x1b[0m';

const RECONNECT_INTERVAL = 5000;
const MAX_NOTIFICATIONS = 10;

// --- Global Variables ---
let wss: WebSocket | null = null;
let reconnectionInterval: NodeJS.Timeout | null;
let envLoaded = false;
let autoConnectOnStartup = false;
let webSocketUrl: string | null = null;
let isWebSocketServerOnline = false;
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
    addNotification(`${COLOR_GREEN}.envファイルが更新されました。${COLOR_RESET}`);
  } catch (error) {
    addNotification(
      `${COLOR_RED}.envファイルの更新中にエラーが発生しました: ${error}${COLOR_RESET}`,
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
    ws.on('error', (error) =>
      resolveAndClose((error as any).message.includes('404') ? false : true),
    );
    setTimeout(() => resolveAndClose(false), 5000);
  });
};

async function extractPlayerName(
  playerNameWithTags: string,
): Promise<{ name: string; uuid: string } | null> {
  // キャッシュに存在すればそれを返す
  if (playerNameCache[playerNameWithTags]) {
    //    console.log(`[Cache Hit] ${playerNameWithTags}`);
    return playerNameCache[playerNameWithTags];
  }

  const world = server.getWorlds()[0];
  if (!world) {
    //   console.error("World not found.");
    return null;
  }

  // testfor コマンドでプレイヤーを検索
  const playerListResult = await world.runCommand(`testfor @a`);
  if (playerListResult.statusCode !== 0 || !playerListResult.victim) {
    //  console.error(`testfor command failed: ${JSON.stringify(playerListResult)}`);
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
          //   console.log(`[Found] ${playerNameWithTags}: ${JSON.stringify(playerInfo)}`);
          return playerInfo;
        } else {
          //  console.error(`Invalid player data format: ${queryResult.details}`);
        }
      } else {
        //   console.error(`querytarget command failed: ${JSON.stringify(queryResult)}`);
      }
    }
  }

  //console.error(`Player not found: ${playerNameWithTags}`);
  return null;
}

// --- UI Functions ---

// displayMenu関数を更新して、WebSocketサーバーのステータス確認後に再帰的に呼び出すように変更
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
      addNotification(`${COLOR_RED}無効な選択です。もう一度お試しください。${COLOR_RESET}`);
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
    addNotification(`${COLOR_GREEN}.envファイルを再読み込みしました。${COLOR_RESET}`);
  } catch (error) {
    addNotification(`${COLOR_RED}.envファイルの再読み込み中にエラーが発生しました: ${error}${COLOR_RESET}`);
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
      console.log(COLOR_RED + 'WebSocketサーバーに接続されていません。' + COLOR_RESET);
    }
  } else {
    log('red', `${COLOR_RED}エラー: WebSocket URLが設定されていません。${COLOR_RESET}`);
    // .envの読み込みに失敗した場合、もしくは、.envが存在しない場合は、処理を停止。
    return;
  }
  if (!autoConnectOnStartup) {
    log('yellow', `${COLOR_YELLOW}起動時の自動接続が無効になっています。${COLOR_RESET}`);
  }

  // WebSocket接続
  if (autoConnectOnStartup) {
    await wss?.close();
    await connectToWss(webSocketUrl);
  }

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

    const url = answers.url.trim();
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
        log('green', 'WebSocketサーバーに接続しました。');
      }
    } catch (error) {
      log('red', `WebSocketサーバーの状態確認または接続中にエラーが発生しました: ${error}`);
    }
  } catch (error) {
    log('red', 'エラーが発生しました: ' + error);
  } finally {
    // setupWebSocketUrlが完了したら、再度WebSocketサーバーの状態を確認してメニューを更新
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
  addNotification(message);
  displayMenu();
};

// --- WebSocket Functions ---
const connectToWss = async (url: string) => {
  if (wss) {
    wss.removeAllListeners();
    wss.close();
    wss = null;
  }

  wss = new WebSocket(url);

  wss.on('open', () => {
    addNotification(`${COLOR_GREEN}WebSocketサーバーに接続しました。${COLOR_RESET}`);
    clearInterval(reconnectionInterval!);
    reconnectionInterval = null;
    isWebSocketServerOnline = true;
  });

  wss.on('message', async (data: string) => {
    try {
      // 受信データが空でないことを確認
      if (!data) {
        addNotification(`${COLOR_RED}空のメッセージを受信しました。${COLOR_RESET}`);
        return;
      }
      let message: any;
      try {
        message = JSON.parse(data);
      } catch (error) {
        addNotification(`${COLOR_RED}無効なJSONメッセージを受信しました: ${error}${COLOR_RESET}`);
        // 受信データをログに出力してデバッグを支援
        console.error('Received invalid JSON data:', data);
        return;
      }
      switch (message.event) {
        case 'commandResult':
          addNotification(`コマンド結果: ${message.data.result}`);
          break;
        case 'playerJoin':
          addNotification(
            `${COLOR_GREEN}プレイヤーが参加しました: ${message.data.player} (UUID: ${message.data.uuid})${COLOR_RESET}`,
          );
          break;
        case 'playerLeave':
          addNotification(
            `${COLOR_YELLOW}プレイヤーが退出しました: ${message.data.player} (UUID: ${message.data.uuid})${COLOR_RESET}`,
          );
          break;
        case 'playerChat':
          addNotification(`[チャット] ${message.data.sender}: ${message.data.message}`);
          break;
        case 'PlayerDied':
          addNotification(`[PlayerDied]`);
          break;
        case 'ItemUsed':
          addNotification(`[ItemUsed]`);
          break;
        case 'serverShutdown':
          addNotification(`${COLOR_RED}サーバーがシャットダウンしています。${COLOR_RESET}`);
          break;
        default:
          if (message.command) {
            const world = server.getWorlds()[0];
            if (!world) {
              addNotification(
                `${COLOR_RED}ワールドがまだロードされていません。コマンドを実行できません。${COLOR_RESET}`,
              );
              break;
            }

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
      }
    } catch (error) {
      addNotification(
        `${COLOR_RED}WSSからのメッセージ処理中にエラーが発生しました: ${error}${COLOR_RESET}`,
      );
    }
  });

  wss.on('close', () => {
    if (isWebSocketServerOnline) {
      addNotification(`${COLOR_YELLOW}WebSocketサーバーから切断されました。${COLOR_RESET}`);
      isWebSocketServerOnline = false;
    }
    if (webSocketUrl && autoConnectOnStartup) {
      reconnect();
    }
  });

  wss.on('error', (error) => {
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
          `${COLOR_YELLOW}WebSocketサーバーへの再接続を試みています...${COLOR_RESET}`,
        );
        connectToWss(webSocketUrl!)
          .then(() => {
            clearInterval(reconnectionInterval!);
            resolve();
          })
          .catch(() => { });
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
    addNotification(`${COLOR_RED}WebSocketが接続されていません。${COLOR_RESET}`);
  }
};

// --- Server Setup and Event Handlers ---

const server = new Server({
  port: parseInt(process.env.SOCKET_BE_PORT || '8000'),
  timezone: process.env.TIMEZONE || 'Asia/Tokyo',
});

server.events.on('serverOpen', async () => {
  if (autoConnectOnStartup) {
    addNotification(
      `${COLOR_GREEN}MinecraftサーバーがWebSocket経由で接続されました!${COLOR_RESET}`,
    );
  }
  if (webSocketUrl && autoConnectOnStartup) {
    await connectToWss(webSocketUrl);
  }
});

server.events.on('worldAdd', async (event) => {
  sendDataToWss('worldAdd', {});
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
  }, 4000);
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

server.events.on('packetReceive', async (event) => {
  const body = event.packet.body;
  const header = event.packet.header;
  const eventName = header.eventName;

  if (eventName === 'ItemUsed') {
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
  } else if (eventName === 'PlayerDied') {
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
  clearInterval(reconnectionInterval!);
  try {
    sendDataToWss('serverShutdown', {});
  } catch (error) {
    addNotification(
      `${COLOR_RED}WSSへのサーバーシャットダウンの送信中にエラーが発生しました: ${error}${COLOR_RESET}`,
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
  const defaultEnvContent = `# 自動的に作成された.envファイル\n# ここに設定値を記入してください\nWSS_URL="WebSocketサーバーURL"\nAUTO_CONNECT_ON_STARTUP="false" # 起動時の自動接続 (true or false)\nSOCKET_BE_PORT="8000" # ソケットビーサーバーのポート番号\nTIMEZONE="Asia/Tokyo" # タイムゾーン\n`;

  const createDefaultEnvFile = async (filePath: string) => {
    try {
      await fs.promises.writeFile(filePath, defaultEnvContent);
      addNotification(
        `${COLOR_YELLOW}デフォルトの.envファイルが ${filePath} に作成されました${COLOR_RESET}`,
      );
    } catch (error) {
      addNotification(
        `${COLOR_RED}デフォルトの.envファイルの作成中にエラーが発生しました: ${error}${COLOR_RESET}`,
      );
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
      addNotification(
        `${COLOR_YELLOW}システムまたは.envファイルから環境変数を読み込めませんでした。${COLOR_RESET}`,
      );
      await createDefaultEnvFile(envPath);
      config({ path: envPath });
      envLoaded = false;
    } else {
      addNotification(
        `${COLOR_RED}.envファイルへのアクセス中にエラーが発生しました: ${error}${COLOR_RESET}`,
      );
      process.exit(1);
    }
  }

  webSocketUrl = process.env.WSS_URL || null;
  autoConnectOnStartup = process.env.AUTO_CONNECT_ON_STARTUP === 'true';

  if (webSocketUrl) {
    addNotification(`${COLOR_GREEN}WebSocket URLが検出されました: ${webSocketUrl}${COLOR_RESET}`);
    try {
      // 初期化時にWebSocketサーバーの状態を確認
      isWebSocketServerOnline = await checkWebSocketStatus(webSocketUrl);
      addNotification(
        `${COLOR_GREEN}WebSocketサーバーは ${isWebSocketServerOnline ? 'オンライン' : 'オフライン'} です。${COLOR_RESET}`,
      );
      if (isWebSocketServerOnline && autoConnectOnStartup) {
        addNotification(
          `${COLOR_GREEN}起動時の自動接続が有効です。WebSocketサーバーに接続します。${COLOR_RESET}`,
        );
        await connectToWss(webSocketUrl);
      }
    } catch (error) {
      addNotification(
        `${COLOR_RED}WebSocketサーバーの状態確認中にエラーが発生しました: ${error}${COLOR_RESET}`,
      );
    }
  }
};

// --- Start ---
(async () => {
  await initEnv();
  envLoaded = false;
  displayMenu();
})();