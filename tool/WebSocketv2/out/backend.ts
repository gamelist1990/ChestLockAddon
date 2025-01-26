import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { World } from './module/world';
import { promises as fsPromises } from 'fs';
import { getData } from './module/Data';

// プレイヤー情報を表すインターフェース (最適化: 不要なプロパティを削除)
export interface Player {
    name: string;
    uuid: string;
    id: number;
    dimension: number;
    ping: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    sendMessage: (message: string) => void;
    runCommand: (command: string) => Promise<any>;
    hasTag: (tag: string) => Promise<boolean>;
    getTags: () => Promise<string[]>;
}

// コマンドの設定情報を表すインターフェース
export interface CommandConfig {
    enabled: boolean;
    adminOnly: boolean;
    requireTag: string[];
}

// コマンドの実行関数
type CommandExecutor = (player: Player, args: string[]) => void;

export interface Command {
    name: string;
    description: string;
    usage?: string;
    maxArgs?: number;
    minArgs?: number;
    config: CommandConfig;
    executor: CommandExecutor;
}

// 汎用的な検証関数
async function verifier(player: Player, config: CommandConfig): Promise<boolean> {
    if (config.enabled !== true) {
        player.sendMessage('このコマンドは無効です。');
        return false;
    } else if (config.adminOnly === true && !(await player.hasTag('admin'))) {
        player.sendMessage('このコマンドを使用する権限がありません。');
        return false;
    } else if (
        config.requireTag.length > 0 &&
        !(await player.getTags()).some((tag: string) => config.requireTag.includes(tag))
    ) {
        player.sendMessage('このコマンドを使用するには必要なタグがありません。');
        return false;
    }
    return true;
}

// プレイヤーデータのインターフェース (join と left を string 型に変更)
export interface PlayerData {
    name: string;
    oldNames: string[];
    uuid: string;
    join: string;
    left: string;
    isOnline: boolean;
    position?: {
        x: number;
        y: number;
        z: number;
    };
}

export class WsServer {
    private port: number;
    private wss: WebSocketServer;
    private clients: Map<string, WebSocket>;
    public commands: Record<string, Command>;
    private minecraftClient: WebSocket | null;
    private commandPrefix: string;
    private world: World;
    private playerDataFile: string;
    private timeout: number = 5000;

    constructor(port: number, commandPrefix: string = '#') {
        this.port = port;
        this.clients = new Map<string, WebSocket>();
        this.commands = {};
        this.minecraftClient = null;
        this.commandPrefix = commandPrefix;
        this.playerDataFile = 'playerData.json';

        // 全てのプレイヤーに影響する汎用ワールドを初期化
        this.world = new World('all', this);

        // WebSocket サーバーを初期化
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('listening', () => {
            console.log(`WebSocket server started on port ${this.port}`);
        });

        // プレイヤーデータの初期化または読み込み
        this.initPlayerData();
        setInterval(() => this.checkOnlineStatus(), 10000);
    }

    // プレイヤーデータの初期化または読み込み
    private async initPlayerData() {
        try {
            await fsPromises.access(this.playerDataFile);
            const data = await fsPromises.readFile(this.playerDataFile, 'utf-8');
            const jsonData = JSON.parse(data);

            // 読み込んだデータが配列であればオブジェクトに変換する
            if (Array.isArray(jsonData)) {
                const playerObject: { [key: string]: PlayerData } = {};
                for (const player of jsonData) {
                    if (player.uuid) {
                        playerObject[player.uuid] = {
                            ...player,
                            oldNames: player.oldNames || [],
                        };
                    }
                }
                await this.savePlayerData(playerObject); // 変換したデータを保存
                console.log('playerData.json was converted from array to object and saved.');
            } else {
                // 既存のデータに oldNames がない場合は追加する
                for (const uuid in jsonData) {
                    if (!jsonData[uuid].oldNames) {
                        jsonData[uuid].oldNames = [];
                    }
                }
                await this.savePlayerData(jsonData);
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // ファイルが存在しない場合は新規作成
                await fsPromises.writeFile(this.playerDataFile, '{}');
                console.log('playerData.json created.');
            } else {
                console.error('Error initializing player data:', error);
            }
        }
    }

    // Minecraft サーバーとの接続処理
    private async handleMinecraftConnection(ws: WebSocket) {
        console.log('Minecraft server connected.');

        const load = await import('./import');
        //Load Command
        load;

        this.minecraftClient = ws;
        ws.on('message', this.handleMinecraftMessage.bind(this));
        ws.on('close', this.handleMinecraftClose.bind(this));
        ws.on('error', this.handleMinecraftError.bind(this));
    }

    // Minecraft サーバーからのメッセージ処理
    private handleMinecraftMessage(data: any) {
        try {
            const message = JSON.parse(data);
            this.handleMinecraftServerData(message.event, message.data);
        } catch (error) {
            console.error('Error processing message from Minecraft server:', error);
        }
    }

    // Minecraft サーバーとの接続切断処理
    private handleMinecraftClose() {
        console.log('Minecraft server disconnected.');
        this.minecraftClient = null;
    }

    // Minecraft サーバーとの接続エラー処理
    private handleMinecraftError(error: any) {
        console.error('Error with Minecraft server connection:', error);
    }

    // 新しいクライアントとの接続処理
    private handleConnection(ws: WebSocket, req: IncomingMessage) {
        const url = new URL(req.url!, `wss://${req.headers.host}`);
        if (url.pathname === '/minecraft') {
            this.handleMinecraftConnection(ws);
        } else {
            ws.close();
        }
    }


    // プレイヤー名から`Player`オブジェクトを生成する (最適化・軽量化)
    public async createPlayerObject(playerName: string): Promise<Player | null> {
        const queryResult = await this.executeMinecraftCommand(`querytarget @a[name=${playerName}]`);
        const softData = await getData(playerName);

        if (queryResult === null) {
            return null;
        }
        if (softData === null) {
            return null
        }

        if (queryResult.statusCode !== 0 || !queryResult.details) return null;

        let playerDataRaw: any;

        try {
            playerDataRaw = JSON.parse(queryResult.details.replace(/\\/g, ''))[0];
        } catch (error) {
            //   console.error('Error parsing player data:', error);
            return null;
        }


        if (!playerDataRaw || !playerDataRaw.uniqueId) return null;

        const storedPlayerData = await this.loadPlayerData();
        const playerUUID = playerDataRaw.uniqueId;
        if (storedPlayerData[playerUUID]) {
            storedPlayerData[playerUUID].position = {
                x: playerDataRaw.position.x,
                y: playerDataRaw.position.y - 2,
                z: playerDataRaw.position.z
            };
            await this.savePlayerData(storedPlayerData);
        }

        return {
            name: playerName,
            uuid: playerDataRaw.uniqueId,
            id: playerDataRaw.id,
            dimension: playerDataRaw.dimension,
            ping: softData ? softData.ping || 0 : 0,
            position: { x: playerDataRaw.position.x, y: playerDataRaw.position.y - 2, z: playerDataRaw.position.z },
            sendMessage: (message: string) =>
                this.sendToMinecraft({ command: `sendMessage`, message, playerName }),
            runCommand: (command: string) => this.executeMinecraftCommand(command),
            hasTag: async (tag: string) => {
                const result = await this.executeMinecraftCommand(`tag ${playerName} list`);
                return result && result.statusMessage
                    ? new RegExp(`§a${tag}§r`).test(result.statusMessage)
                    : false;
            },
            getTags: async () => {
                const result = await this.executeMinecraftCommand(`tag ${playerName} list`);
                if (!result || !result.statusMessage) return [];
                const tagRegex = /§a([\w\d]+)§r/g;
                const tags: string[] = [];
                let match;
                while ((match = tagRegex.exec(result.statusMessage)) !== null) {
                    tags.push(match[1]);
                }
                return tags;
            },
        };
    }


    // Minecraft コマンドを実行する (最適化)
    public async executeMinecraftCommand(command: string): Promise<any> {
        if (!this.minecraftClient || this.minecraftClient.readyState !== WebSocket.OPEN) {
            // console.error('Minecraft server is not connected.');
            return null;
        }

        return new Promise((resolve, reject) => { // reject も使用する
            let timeoutId: NodeJS.Timeout | undefined;
            const commandId = Math.random().toString(36).substring(2, 15);

            let resolved = false; // 成功、失敗問わず1度だけ resolve/reject を呼ぶ
            const listener = (data: any) => {
                if (resolved) {
                    return;
                }

                try {
                    const message = JSON.parse(data);
                    if (message.event === 'commandResult' && message.data.commandId === commandId) {
                        resolved = true; // 成功フラグ

                        if (this.minecraftClient) {
                            this.minecraftClient.off('message', listener);
                        }

                        clearTimeout(timeoutId); // タイムアウトをクリア

                        resolve(message.data.result);
                    }
                } catch (error) {
                    console.error('Error processing command result:', error);

                    resolved = true; // エラー発生でrejectする

                    if (this.minecraftClient) {
                        this.minecraftClient.off('message', listener);
                    }

                    clearTimeout(timeoutId); // タイムアウトをクリア

                    reject(new Error('Error processing command result. See console for details.')); // 詳細エラーを投げ直す。consoleに出力してあるエラーと同じ内容にする
                }
            };

            if (this.minecraftClient) {
                this.minecraftClient.setMaxListeners(20);
                this.minecraftClient.on('message', listener);

                // タイムアウト処理を追加

                this.sendToMinecraft({ command, commandId });
            } else {
                reject(new Error('Minecraft server is not connected.')); // this.minecraftClientがnullだった場合、既に上でエラーを投げているので冗長に思えるが念の為入れておく
            }
        });
    }

    // プレイヤーのチャットを処理する (最適化: 引数の処理とコマンド処理を調整)
    public async onPlayerChat(sender: string, message: string, type: string, receiver: string) {
        let chatSender = sender;
        let chatMessage = message;

        try {
            // JSON文字列の解析を試みる
            let parsedMessage: any;

            try {
                parsedMessage = JSON.parse(message);
            } catch (error) {
                // console.error("Invalid JSON:", message, error);
            }

            // rawtextプロパティがあるか確認
            if (parsedMessage && parsedMessage.rawtext && parsedMessage.rawtext.length > 0) {
                const text = parsedMessage.rawtext[0].text;
                const nameMatch = text.match(/<([^>]*)>/);
                chatSender = nameMatch ? nameMatch[1] : sender;
                chatMessage = text.replace(/<[^>]*>\s*/, '');
            }
        } catch (error) {
            // 失敗！w
        }
        if (chatMessage.startsWith(this.commandPrefix)) {
            const args = chatMessage
                .slice(this.commandPrefix.length)
                .replace('@', '')
                .match(/(".*?"|\S+)/g)
                ?.map((match: string) => match.replace(/"/g, ''));
            if (!args) return;

            const commandName = args.shift()!; // args[0] を取得し、args から削除
            const player = await world.getEntityByName(chatSender) as Player;

            if (!player) {
                console.error(`Player object not found for ${chatSender}`);
                return;
            }

            this.processCommand(player, commandName, args);
            return;
        }


        // 通常のチャット処理 (JSONから抽出されたか、元のチャットかに関わらず処理)
        this.world.triggerEvent('playerChat', chatSender, chatMessage, type, receiver);
        this.broadcastToClients({ event: 'playerChat', data: { sender: chatSender, message: chatMessage, type, receiver } });
    }

    // コマンドを処理する
    private async processCommand(player: Player, commandName: string, args: string[]) {
        let command = this.commands[commandName];
        if (!command) {
            player.sendMessage(`不明なコマンドです: ${commandName}`);
            return;
        }

        // 最終的なコマンドの検証と実行
        const hasPermission = await verifier(player, command.config);
        if (!hasPermission) {
            return;
        }

        // 引数の数の確認と使用法の表示
        if (command.minArgs !== undefined && args.length < command.minArgs) {
            const usageMessage = command.usage
                ? `使用法: ${commandName} ${command.usage}`
                : `使用法: ${commandName}`;
            player.sendMessage(`引数が不足しています。${usageMessage}`);
            return;
        }
        if (command.maxArgs !== undefined && args.length > command.maxArgs) {
            const usageMessage = command.usage
                ? `使用法: ${commandName} ${command.usage}`
                : `使用法: ${commandName}`;
            player.sendMessage(`引数が多すぎます。${usageMessage}`);
            return;
        }

        command.executor(player, args);
    }

    // コマンドを処理する (最適化: 引数の処理を調整)
    private async handleCommand(player: Player, commandName: string, args: string[]) {
        this.processCommand(player, commandName, args);
    }

    // プレイヤーデータをファイルから読み込む
    public async loadPlayerData(): Promise<{ [key: string]: PlayerData }> {
        const data = await fsPromises.readFile(this.playerDataFile, 'utf8');
        return JSON.parse(data);
    }

    // プレイヤーデータをファイルに書き込む
    private async savePlayerData(playerData: { [key: string]: PlayerData }) {
        try {
            // JSON 文字列に変換する前に、不正な値を修正する
            const cleanedPlayerData = this.cleanPlayerData(playerData);

            const data = JSON.stringify(cleanedPlayerData, null, 2);
            await fsPromises.writeFile(this.playerDataFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving player data:', error);
            console.error('Problematic player data:', playerData); // 問題のある playerData を出力
            // ここで、エラーを適切に処理する。
            // 例えば、デフォルトのデータを書き込む、エラーを上位に伝播させるなど。
            // 下記は、空のデータを書き込む例です。
            // 注意：この対応はあくまで例であり、環境に応じて最適なものを選んでください
            try {
                await fsPromises.writeFile(this.playerDataFile, '{}', 'utf8');
                console.warn('Wrote empty object to player data file due to previous error.');
            } catch (writeError) {
                console.error('Failed to write empty object to player data file:', writeError);
                // 必要に応じて、さらにエラー処理や、呼び出し元にエラーを伝播させるなどを記述します
            }
        }
    }



    // プレイヤーデータから不正な値を取り除くヘルパー関数
    private cleanPlayerData(playerData: { [key: string]: PlayerData }): { [key: string]: PlayerData } {
        const cleanedData: { [key: string]: PlayerData } = {};
        for (const uuid in playerData) {
            const player = playerData[uuid];
            cleanedData[uuid] = {
                name: player.name,
                oldNames: player.oldNames || [],
                uuid: player.uuid,
                join: player.join,
                left: player.left, // left が undefined や null の場合は空文字列にする
                isOnline: !!player.isOnline, // 明示的に boolean に変換する
                position: player.position ? {
                    x: player.position.x,
                    y: player.position.y,
                    z: player.position.z,
                } : undefined,
            };
        }
        return cleanedData;
    }

    private formatTimestamp(): string {
        const now = new Date();
        return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    }
    // ワールドにいる全プレイヤーを取得する
    public async getPlayers(): Promise<Player[]> {
        const queryResult = await this.executeMinecraftCommand(`list`);
        if (queryResult === null || queryResult.statusCode !== 0 || !queryResult.statusMessage) {
            return []; // エラーが発生した場合、または statusMessage がない場合は空の配列を返す
        }

        // ログのパターンに応じて処理を分岐
        const players: Player[] = [];

        if (queryResult.statusMessage.includes('オンラインです:')) {
            // "オンラインです:\n" 以降の文字列を取得
            const playerListString = queryResult.statusMessage.split('オンラインです:\n')[1];

            // プレイヤー名をカンマとスペースで分割して配列にする
            const playerNames = playerListString.split(', ');

            for (const name of playerNames) {
                const player = await this.createPlayerObject(name.trim());
                if (player) {
                    players.push(player);
                }
            }
        }

        return players;
    }

    private async checkOnlineStatus() {
        try {
            const onlinePlayers = await this.getPlayers();
            const playerData = await this.loadPlayerData();

            for (const uuid in playerData) {
                const playerIsOnline = onlinePlayers.some((player) => player.uuid === uuid);
                if (playerData[uuid].isOnline && !playerIsOnline) {
                    // プレイヤーがオフラインになった場合
                    playerData[uuid].isOnline = false;
                    playerData[uuid].left = '';
                    console.log(`Player ${playerData[uuid].name} marked as offline.`);
                } else if (!playerData[uuid].isOnline && playerIsOnline) {
                    // プレイヤーがオンラインに復帰した場合
                    playerData[uuid].isOnline = true;
                    playerData[uuid].left = '';
                    console.log(`Player ${playerData[uuid].name} marked as online.`);
                }
            }

            await this.savePlayerData(playerData);
        } catch (error) {
        }
    }

    private async handleWorldRemoveEvent() {
        try {
            const playerData = await this.loadPlayerData();

            for (const uuid in playerData) {
                if (playerData[uuid].isOnline) {
                    playerData[uuid].isOnline = false;
                    playerData[uuid].left = this.formatTimestamp();
                    console.log(`Player ${playerData[uuid].name} marked as offline due to worldRemove event.`);
                }
            }

            await this.savePlayerData(playerData);
            console.log('All players marked as offline due to worldRemove event.');
        } catch (error) {
            console.error('Error handling worldRemove event:', error);
        }
    }

    private async handleMinecraftServerData(event: string, data: any) {
        switch (event) {
            case 'worldAdd':
                this.world.triggerEvent('worldAdd', 'add');
                this.getWorld().triggerEvent('worldAdd', 'add');
                break;
            case 'worldRemove':
                await this.handleWorldRemoveEvent();
                this.world.triggerEvent('worldRemove', 'remove');
                this.getWorld().triggerEvent('worldRemove', 'remove');
                break;
            case 'worldLeave':
                this.world.triggerEvent('worldLeave', 'leave');
                this.getWorld().triggerEvent('worldLeave', 'leave');
                break;
            case 'playerJoin':
                try {
                    setTimeout(async () => {
                        // プレイヤー名を取得
                        const playerNames = Array.isArray(data.player) ? data.player[0] : data.player;
                        const playerName = await world.getPlayers().then((players) => players.find((p) => p.name === playerNames)?.name);

                        // プレイヤーデータとフラグを初期化

                        console.log('playerJoin:', playerName);
                        const playerData = await this.loadPlayerData();
                        let isNewPlayer = false;
                        let isOnlineStatusChanged = false;

                        if (playerName) {
                            const timestamp = this.formatTimestamp();
                            let uuid: string | null = null;
                            let retryCount = 0;
                            const maxRetries = 10;
                            const retryInterval = 3000; // 3秒

                            // プレイヤー名から既存プレイヤーを探す
                            let existingPlayer: PlayerData | undefined;

                            while (!uuid && retryCount < maxRetries) {
                                existingPlayer = Object.values(playerData).find((p) => p.name === playerName);

                                if (existingPlayer) {
                                    uuid = existingPlayer.uuid;
                                } else {
                                    uuid = await this.getPlayerUUID(playerName);
                                }

                                if (!uuid) {
                                    retryCount++;
                                    console.log(
                                        `UUID not found for player: ${playerName}, retrying in ${retryInterval / 1000} seconds... (${retryCount}/${maxRetries})`,
                                    );
                                    await new Promise((resolve) => setTimeout(resolve, retryInterval));
                                }
                            }

                            if (uuid) {
                                // uuid が null でないことを確認
                                if (!existingPlayer) {
                                    // 新規プレイヤーの場合
                                    playerData[uuid] = {
                                        name: playerName,
                                        oldNames: [],
                                        uuid: uuid,
                                        join: timestamp,
                                        left: '',
                                        isOnline: true,
                                    };
                                    console.log('New player added to playerData:', playerName);
                                    isNewPlayer = true;
                                } else {
                                    // 既存プレイヤーの場合
                                    if (existingPlayer.name !== playerName) {
                                        // 名前が異なる場合、古い名前をoldNamesに追加
                                        if (!existingPlayer.oldNames.includes(existingPlayer.name)) {
                                            existingPlayer.oldNames.unshift(existingPlayer.name);
                                            if (existingPlayer.oldNames.length > 3) {
                                                existingPlayer.oldNames.pop();
                                            }
                                        }
                                        existingPlayer.name = playerName;
                                        console.log(
                                            `Player name updated. Old names for ${existingPlayer.uuid}:`,
                                            existingPlayer.oldNames,
                                        );
                                    }

                                    if (!existingPlayer.isOnline) {
                                        existingPlayer.isOnline = true;
                                        existingPlayer.join = timestamp; // joinの時間を更新
                                        isOnlineStatusChanged = true;
                                    } else {
                                        console.log('Existing player already online:', playerName);
                                    }

                                    // 既存プレイヤーのデータを更新
                                    playerData[uuid] = existingPlayer;
                                }

                                await this.savePlayerData(playerData);

                                // クライアントへの通知
                                if (isNewPlayer || isOnlineStatusChanged) {
                                    this.broadcastToClients({
                                        event: 'playerJoin',
                                        data: { name: playerName, uuid: uuid },
                                    });

                                    this.getWorld().triggerEvent('playerJoin', playerName);
                                }
                            } else {
                                console.error(
                                    `Failed to get UUID for player: ${playerName} after ${maxRetries} retries.`,
                                );
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error in playerJoin:', error);
                }
                break;
            case 'playerLeave':
                try {
                    setTimeout(async () => {
                        const playerName = Array.isArray(data.player) ? data.player[0] : data.player;
                        const playerData = await this.loadPlayerData();


                        let playerUUID: string | undefined | null;
                        let isTrulyOffline = false;
                        let retryCount = 0;
                        const maxRetries = 5; // 試行回数
                        const retryDelay = 1000; // ミリ秒単位の遅延

                        // オフライン確認のループ
                        while (!isTrulyOffline && retryCount < maxRetries) {
                            playerUUID = await this.getPlayerUUID(playerName);
                            if (playerUUID === null) {
                                isTrulyOffline = true;
                            } else {
                                retryCount++;
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                            }
                        }

                        if (isTrulyOffline) {
                            // console.log(`Confirmed offline: ${playerName}`);

                            // プレイヤーデータから UUID を取得
                            playerUUID = Object.keys(playerData).find((uuid) => playerData[uuid].name === playerName);

                            // UUIDが不明な場合は、プレイヤー名で仮のオブジェクトを作成
                            const playerLeave = {
                                name: playerName,
                                uuid: playerUUID ? playerUUID : null,
                            };

                            if (playerUUID && playerData[playerUUID]?.isOnline) {
                                console.log('Processing playerLeave for:', playerLeave.name);
                                const timestamp = this.formatTimestamp();
                                playerData[playerUUID].left = timestamp;
                                playerData[playerUUID].isOnline = false;

                                await this.savePlayerData(playerData);
                                this.broadcastToClients({ event: 'playerLeave', data: playerLeave });
                                this.getWorld().triggerEvent('playerLeave', playerName);
                            } else {
                                //console.log(`Player ${playerName} not found or was already offline.`);
                            }


                        } else {
                            //  console.log(`Player ${playerName} is still online after ${maxRetries} retries. Aborting playerLeave event.`);
                        }
                    }, 500); // 遅延を少し減らして500msに設定
                } catch (error) {
                    console.error('Error in playerLeave:', error);
                }
                break;

            case 'playerChat':
                const { sender, message, type, receiver } = data;
                if (sender !== 'External') this.onPlayerChat(sender, message, type, receiver);
                break;
            case 'serverShutdown':
                this.broadcastToClients({ event: 'serverShutdown', data });
                break;
            case 'commandResult':
                this.broadcastToClients({ event: 'commandResult', data });
                break;
            default:
                console.warn('Unknown event received:', event);
        }
    }

    // 汎用ワールドオブジェクトを取得する
    public getWorld(): World {
        return this.world;
    }

    // 全クライアントにデータをブロードキャストする (最適化)
    public broadcastToClients(data: any) {
        const message = JSON.stringify(data);
        for (const client of this.clients.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    private async getPlayerUUID(playerName: string): Promise<string | null> {
        const queryResult = await this.executeMinecraftCommand(`querytarget @a[name=${playerName}]`);
        if (queryResult && queryResult.statusCode === 0 && queryResult.details) {
            const playerData = JSON.parse(queryResult.details.replace(/\\/g, ''))[0];
            //console.log(JSON.stringify(playerData))
            if (playerData && playerData.uniqueId) {
                return playerData.uniqueId;
            }
        }
        return null;
    }

    // Minecraft サーバーにデータを送信する (最適化)
    public sendToMinecraft(data: any) {
        if (!this.minecraftClient || this.minecraftClient.readyState !== WebSocket.OPEN) {
            //   console.error('Minecraft server is not connected.');
            return;
        }
        try {
            this.minecraftClient.send(JSON.stringify(data));
        } catch (error) {
            console.error('Error sending data to Minecraft server:', error);
        }
    }

    /**
     * WebSocket サーバーを停止する。
     * 接続中の全ての WebSocket クライアントと Minecraft サーバーとの接続を閉じる。
     */
    public close() {
        // 全クライアントの接続を閉じる
        for (const client of this.clients.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        }
        this.clients.clear();

        // Minecraft サーバーとの接続を閉じる
        if (this.minecraftClient && this.minecraftClient.readyState === WebSocket.OPEN) {
            this.minecraftClient.close();
            this.minecraftClient = null;
        }

        // WebSocket サーバーを閉じる
        this.wss.close(() => {
            console.log('WebSocket server closed.');
        });
    }
}

// wsserver インスタンスをエクスポート
export const wsserver = new WsServer(19133);
// Export the generic world instance for use in other files
export const world = wsserver.getWorld();

// コマンド登録関数をエクスポート
export function registerCommand(command: Command) {
    wsserver.commands[command.name] = command;
}

process.on('SIGINT', () => {
    console.log('SIGINT signal received. Closing server...');
    wsserver.close();
    process.exit(0); // クリーンに終了
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing server...');
    wsserver.close();
    process.exit(0); // クリーンに終了
});

// 未処理の例外をハンドルする
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    wsserver.close();
    process.exit(1); // エラーコード 1 で終了
});

// 未処理の Promise 拒否をハンドルする
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    wsserver.close();
    process.exit(1); // エラーコード 1 で終了
});
