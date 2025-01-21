import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { World } from './module/world';
import { promises as fsPromises } from 'fs';

// プレイヤー情報を表すインターフェース (最適化: 不要なプロパティを削除)
export interface Player {
    name: string;
    uuid: string;
    id: number;
    dimension: number;
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
    join: string; // 参加時刻を文字列で保存
    left: string; // 退出時刻を文字列で保存
    isOnline: boolean;
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
        setInterval(() => this.getPlayers(), 1);
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
        // console.log('Minecraft server connected.');

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
        } else if (url.pathname === '/client') {
            this.handleClientConnection(ws, this.generateClientId());
        } else {
            ws.close();
        }
    }

    // クライアント接続の処理 (最適化)
    private async handleClientConnection(ws: WebSocket, clientId: string) {
        this.clients.set(clientId, ws);
        console.log(`Client connected: ${clientId}`);
        // クライアントへの初期メッセージ送信を削除

        ws.on('message', async (data: any) => {
            console.log(`Received message from client ${clientId}: ${data}`);
            try {
                const message = JSON.parse(data);
                if (message.command) {
                    const player = await this.createPlayerObject(clientId);
                    if (player) {
                        this.handleCommand(player, message.command, message.args || []);
                    } else {
                        console.error(`Player object not found for ${clientId}`);
                    }
                }
            } catch (error) {
                console.error('Error processing message from client:', error);
            }
        });

        ws.on('close', () => {
            this.clients.delete(clientId);
            console.log(`Client disconnected: ${clientId}`);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
        });
    }

    // クライアントIDを生成する (軽量化)
    private generateClientId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    // プレイヤー名から`Player`オブジェクトを生成する (最適化・軽量化)
    public async createPlayerObject(playerName: string): Promise<Player | null> {
        const queryResult = await this.executeMinecraftCommand(`querytarget @a[name=${playerName}]`);

        // queryResult が null の場合は null を返す
        if (queryResult === null) {
            return null;
        }

        if (queryResult.statusCode !== 0 || !queryResult.details) return null;

        const playerData = JSON.parse(queryResult.details.replace(/\\/g, ''))[0];
        if (!playerData || !playerData.uniqueId) return null;

        return {
            name: playerName,
            uuid: playerData.uniqueId,
            id: playerData.id,
            dimension: playerData.dimension,
            position: { x: playerData.position.x, y: playerData.position.y - 2, z: playerData.position.z },
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

        return new Promise((resolve) => {
            const commandId = Math.random().toString(36).substring(2, 15);

            // リスナー関数内で `resolve` を確実に一度だけ呼び出すための変数
            let resolved = false;
            const listener = (data: any) => {
                if (resolved) {
                    return;
                }

                try {
                    const message = JSON.parse(data);
                    if (message.event === 'commandResult' && message.data.commandId === commandId) {
                        resolved = true; // フラグを立てる

                        if (this.minecraftClient) {
                            this.minecraftClient.off('message', listener);
                        }

                        resolve(message.data.result);
                    }
                } catch (error) {
                    console.error('Error processing command result:', error);

                    resolved = true;
                    if (this.minecraftClient) {
                        this.minecraftClient.off('message', listener);
                    }
                    resolve(null);
                }
            };

            if (this.minecraftClient) {
                this.minecraftClient.on('message', listener);
            } else {
                resolve(null);
                return;
            }

            this.sendToMinecraft({ command, commandId });
        });
    }

    // プレイヤーのチャットを処理する (最適化: 引数の処理とコマンド処理を調整)
    public async onPlayerChat(sender: string, message: string, type: string, receiver: string) {
        if (message.startsWith(this.commandPrefix)) {
            const args = message
                .slice(this.commandPrefix.length)
                .replace('@', '')
                .match(/(".*?"|\S+)/g)
                ?.map((match: string) => match.replace(/"/g, ''));
            if (!args) return;

            const commandName = args.shift()!; // args[0] を取得し、args から削除
            const player = await this.createPlayerObject(sender);

            if (!player) {
                console.error(`Player object not found for ${sender}`);
                return;
            }

            this.processCommand(player, commandName, args);
        } else {
            this.world.triggerEvent('playerChat', sender, message, type, receiver);
            this.broadcastToClients({ event: 'playerChat', data: { sender, message, type, receiver } });
        }
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
        const data = JSON.stringify(playerData, null, 2);
        await fsPromises.writeFile(this.playerDataFile, data, 'utf8');
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
            console.error('Error in checkOnlineStatus:', error);
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
                        const playerName = Array.isArray(data.player) ? data.player[0] : data.player;

                        // プレイヤーデータとフラグを初期化
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
                                        console.log(
                                            'Existing player updated in playerData:',
                                            playerName,
                                            'Join time updated.',
                                        );
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

                                    this.getWorld().triggerEvent('playerJoin', playerName, uuid);
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
                        const maxRetries = 3; // 試行回数
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
                            console.log(`Confirmed offline: ${playerName}`);

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
                                console.log(`Player ${playerName} not found or was already offline.`);
                            }


                        } else {
                            console.log(`Player ${playerName} is still online after ${maxRetries} retries. Aborting playerLeave event.`);
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
            case 'PlayerDied':
                this.broadcastToClients({ event: 'PlayerDied', data });
                this.world.triggerEvent('PlayerDied', data);
                break;
            case 'ItemUsed':
                this.broadcastToClients({ event: 'ItemUsed', data });
                this.world.triggerEvent('ItemUsed', data);
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
        this.minecraftClient.send(JSON.stringify(data));
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
