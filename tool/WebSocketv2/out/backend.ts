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


//Global

export const prefix = "#"

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

    // 並列処理対応のための追加プロパティ
    private isSaving: boolean = false;
    private playerDataCache: PlayerData[] | null = null;
    private saveQueue: PlayerData[] | null = null;

    constructor(port: number, commandPrefix: string = prefix) {
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
        this.wss.on('listening', async () => {
            console.log(`WebSocket server started on port ${this.port}`);

            const a = await import('./command/server');
            //load
            a;
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

            // 既存のデータがオブジェクトの場合、配列に変換
            if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
                const newJsonData: PlayerData[] = [];
                for (const uuid in jsonData) {
                    if (!jsonData[uuid].oldNames) {
                        jsonData[uuid].oldNames = [];
                    }
                    newJsonData.push(jsonData[uuid]);
                }
                await this.savePlayerData(newJsonData);
                console.log('Converted playerData.json from object to array format.');
            } else if (Array.isArray(jsonData)) {
                // 配列の場合、各プレイヤーに oldNames があるか確認し、なければ追加
                for (const player of jsonData) {
                    if (!player.oldNames) {
                        player.oldNames = [];
                    }
                }
                if (jsonData) {
                    await this.savePlayerData(jsonData);
                }
            } else {
                console.error('Error: playerData.json is not in the expected format.');
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // ファイルが存在しない場合は新規作成 (空の配列で初期化)
                await fsPromises.writeFile(this.playerDataFile, '[]');
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
            return null;
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

        // 変更点: 配列から該当プレイヤーを検索
        const playerIndex = Object.values(storedPlayerData).findIndex((p) => p.uuid === playerUUID);
        if (playerIndex !== -1) {
            storedPlayerData[playerIndex].position = {
                x: playerDataRaw.position.x,
                y: playerDataRaw.position.y - 2,
                z: playerDataRaw.position.z,
            };

            if (storedPlayerData) {
                await this.savePlayerData(storedPlayerData);
            }
        }

        return {
            name: playerName,
            uuid: playerDataRaw.uniqueId,
            id: playerDataRaw.id,
            dimension: playerDataRaw.dimension,
            ping: softData ? softData.ping || 0 : 0,
            position: {
                x: playerDataRaw.position.x,
                y: playerDataRaw.position.y - 2,
                z: playerDataRaw.position.z,
            },
            sendMessage: (message: string) =>
                this.sendToMinecraft({ command: `sendMessage`, message, playerName }),
            //player.runCommandは個人に対して行う為(execute,その他で自分自身にやる方法知らん..)
            runCommand: (command: string) => this.executeMinecraftCommand(`execute as @a[name=${playerName}] at @s run ${command}`),
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
            return null;
        }

        return new Promise((resolve, _reject) => {
            let timeoutId: NodeJS.Timeout | undefined; // タイムアウトIDを宣言
            const commandId = Math.random().toString(36).substring(2, 15);

            let resolved = false;
            const listener = (data: any) => {
                if (resolved) {
                    return;
                }

                try {
                    const message = JSON.parse(data);
                    if (message.event === 'commandResult' && message.data.commandId === commandId) {
                        resolved = true;

                        if (this.minecraftClient) {
                            this.minecraftClient.off('message', listener);
                        }

                        clearTimeout(timeoutId);

                        resolve(message.data.result);
                    }
                } catch (error) {
                    console.error('Error processing command result:', error);

                    resolved = true;

                    if (this.minecraftClient) {
                        this.minecraftClient.off('message', listener);
                    }

                    clearTimeout(timeoutId); // タイムアウトをクリア

                    return null
                }
            };

            if (this.minecraftClient) {
                this.minecraftClient.setMaxListeners(50);
                this.minecraftClient.on('message', listener);

                // タイムアウト処理を追加
                timeoutId = setTimeout(() => { // timeoutIdに代入
                    if (!resolved) {
                        resolved = true;
                        if (this.minecraftClient) {
                            this.minecraftClient.off('message', listener);
                        }
                        return null
                    }
                }, this.timeout);

                this.sendToMinecraft({ command, commandId });
            } else {
                return null
            }
        });
    }

    // プレイヤーのチャットを処理する (最適化: 引数の処理とコマンド処理を調整)
    public async onPlayerChat(sender: string, message: string, type: string, receiver: string) {
        let chatSender = sender;
        let chatMessage = message;

        // tellかつreceiverとsenderが同じ場合にのみJSON解析を試みる
        if (type === "tell" && receiver === sender) {
            try {
                let parsedMessage: any;

                try {
                    parsedMessage = JSON.parse(message);
                } catch (error) {
                    // JSON解析に失敗した場合、エラーログを出す
                    console.error("Invalid JSON:", message, error);
                }

                // rawtextプロパティがあるか確認
                if (parsedMessage && parsedMessage.rawtext && parsedMessage.rawtext.length > 0) {
                    const text = parsedMessage.rawtext[0].text;
                    const nameMatch = text.match(/<([^>]*)>/);
                    chatSender = nameMatch ? nameMatch[1] : sender;
                    chatMessage = text.replace(/<[^>]*>\s*/, '');
                }
            } catch (error) { }
        }

        if (chatMessage.startsWith(this.commandPrefix)) {
            const args = chatMessage
                .slice(this.commandPrefix.length)
                .replace('@', '')
                .match(/(".*?"|\S+)/g)
                ?.map((match: string) => match.replace(/"/g, ''));
            if (!args) return;

            const commandName = args.shift()!; // args[0] を取得し、args から削除
            const player = (await world.getEntityByName(chatSender)) as Player;

            if (!player) {
                console.error(`Player object not found for ${chatSender}`);
                return;
            }

            this.processCommand(player, commandName, args);
            return;
        }

        // 通常のチャット処理 (JSONから抽出されたか、元のチャットかに関わらず処理)
        this.world.triggerEvent('playerChat', chatSender, chatMessage, type, receiver);
        this.broadcastToClients({
            event: 'playerChat',
            data: { sender: chatSender, message: chatMessage, type, receiver },
        });
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

    // プレイヤーデータをファイルから読み込む
    public async loadPlayerData(): Promise<PlayerData[]> {
        // 書き込み中であれば待機
        while (this.isSaving) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // キャッシュがあればそれを返す
        if (this.playerDataCache) {
            return this.playerDataCache;
        }

        try {
            let data = await fsPromises.readFile(this.playerDataFile, 'utf8');

            // データの読み込みと修正の関数
            const loadAndFixData = async (rawData: string): Promise<PlayerData[]> => {
                if (rawData.trim() === '' || rawData.trim() === '[]') {
                    return [];
                }

                try {
                    let jsonData = JSON.parse(rawData);
                    if (!Array.isArray(jsonData)) {
                        jsonData = Object.values(jsonData);
                    }

                    const uniquePlayers: { [key: string]: PlayerData } = {};
                    for (const player of jsonData) {
                        if (player.name && player.uuid) {
                            const key = `${player.name}-${player.uuid}`;
                            uniquePlayers[key] = player;
                        }
                    }

                    const cleanedPlayerData: PlayerData[] = Object.values(uniquePlayers);
                    return cleanedPlayerData;
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        console.warn('Warning: Invalid JSON format detected. Attempting to fix...');
                        const fixedData = this.fixJson(rawData);

                        if (fixedData === '[]') {
                            console.log('Data is empty or fixed to "[]", returning empty array.');
                            return [];
                        }

                        try {
                            let fixedJsonData = JSON.parse(fixedData);

                            if (fixedData !== rawData) {
                                console.log('JSON data has been fixed.');
                            }

                            try {
                                await fsPromises.writeFile(this.playerDataFile, fixedData, 'utf8');
                                console.log('JSON data saved.');
                            } catch (writeError) {
                                console.error('Error writing fixed JSON data to file:', writeError);
                                return [];
                            }

                            if (!Array.isArray(fixedJsonData)) {
                                fixedJsonData = Object.values(fixedJsonData);
                            }

                            const uniquePlayersFixed: { [key: string]: PlayerData } = {};
                            for (const player of fixedJsonData) {
                                if (player.name && player.uuid) {
                                    const key = `${player.name}-${player.uuid}`;
                                    uniquePlayersFixed[key] = player;
                                }
                            }
                            const cleanedFixedPlayerData: PlayerData[] = Object.values(uniquePlayersFixed);

                            return cleanedFixedPlayerData;
                        } catch {
                            console.error('Fixed JSON data is not valid.');
                            return [];
                        }
                    } else {
                        console.error('Error loading player data:', error);
                        return [];
                    }
                }
            };

            const playerData = await loadAndFixData(data);
            this.playerDataCache = playerData; // キャッシュを更新
            return playerData;
        } catch (error) {
            console.error('Error reading player data file:', error);
            return [];
        }
    }

    // JSONの修正関数を宣言(loadPlayerDataの外に出す)
    private fixJson = (jsonString: string): string => {
        // 空もしくは'[]'なら空の配列で処理する
        if (jsonString.trim() === '' || jsonString.trim() === '[]') {
            return '[]';
        }
        // JSON文字列からコメントを削除
        jsonString = jsonString.replace(
            /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
            (match, group) => (group ? '' : match),
        );
        // JSON文字列の前後に不要な文字があれば削除
        jsonString = jsonString.trim().replace(/^[^\[\{]+|[^\]\}]+$/g, '');
        // オブジェクトの末尾にカンマが存在する場合は削除
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        // 不足している閉じ括弧を追加
        let openBraces = (jsonString.match(/\{/g) || []).length;
        let closeBraces = (jsonString.match(/\}/g) || []).length;
        while (openBraces > closeBraces) {
            jsonString += '}';
            closeBraces++;
        }
        let openBrackets = (jsonString.match(/\[/g) || []).length;
        let closeBrackets = (jsonString.match(/\]/g) || []).length;
        while (openBrackets > closeBrackets) {
            jsonString += ']';
            closeBrackets++;
        }
        // 再度JSONのパースを試みる
        try {
            JSON.parse(jsonString);
            return jsonString;
        } catch {
            // パースに失敗した場合は、修正を諦めて空の配列を返す
            console.error('Failed to fix JSON. Returning an empty array.');
            return '[]';
        }
    };

    // プレイヤーデータをファイルに書き込む
    private async savePlayerData(newPlayerData: PlayerData[]) {
        // 書き込み中ならキューに追加して待機
        if (this.isSaving) {
            this.saveQueue = newPlayerData;
            return;
        }

        this.isSaving = true;

        try {
            let existingData: PlayerData[] = [];
            try {
                const rawData = await fsPromises.readFile(this.playerDataFile, 'utf8');
                if (rawData.trim() !== '' && rawData.trim() !== '[]') {
                    if (!this.isValidJson(rawData)) {
                        const fixedData = this.fixJson(rawData);
                        await fsPromises.writeFile(this.playerDataFile, fixedData, 'utf8');
                        existingData = JSON.parse(fixedData);
                    } else {
                        existingData = JSON.parse(rawData);
                    }
                }
            } catch (readError) {
                console.warn('Warning: Could not read existing player data. Creating new data.');
                existingData = [];
            }

            if (!Array.isArray(existingData)) {
                existingData = Object.values(existingData);
            }

            const mergedData = this.mergePlayerData(existingData, newPlayerData);
            const validPlayerData = mergedData.filter((player) => player.name && player.uuid);
            const data = JSON.stringify(validPlayerData, null, 2);

            await fsPromises.writeFile(this.playerDataFile, data, 'utf8');
            this.playerDataCache = validPlayerData; // キャッシュを更新
        } catch (error) {
            console.error('Error saving player data:', error);
            console.error('Problematic player data:', newPlayerData);
        } finally {
            this.isSaving = false;
            if (this.saveQueue) {
                const queuedData = this.saveQueue;
                this.saveQueue = null;
                await this.savePlayerData(queuedData); // 再帰的に処理
            }
        }
    }

    // データをマージして、重複を排除するヘルパー関数
    private mergePlayerData(existingData: PlayerData[], newPlayerData: PlayerData[]): PlayerData[] {
        // nameとuuidをキーとして既存プレイヤーをマップ
        const playerMap: { [key: string]: PlayerData } = {};
        for (const player of existingData) {
            if (player.name && player.uuid) {
                const key = `${player.name}-${player.uuid}`;
                playerMap[key] = player;
            }
        }

        // 新しいプレイヤーデータを追加・更新
        for (const player of newPlayerData) {
            if (player.name && player.uuid) {
                const key = `${player.name}-${player.uuid}`;
                playerMap[key] = player; // 既存のプレイヤーは上書きされる
            }
        }

        // マップから配列に戻す
        return Object.values(playerMap);
    }

    // 有効なJSONか確認するヘルパー関数
    private isValidJson(jsonString: string): boolean {
        try {
            JSON.parse(jsonString);
            return true;
        } catch (e) {
            return false;
        }
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

            // プレイヤーデータに変更があったかどうかを追跡するフラグ
            let dataChanged = false;

            const updatedPlayerData = playerData.map((pData) => {
                const playerIsOnline = onlinePlayers.some((player) => player.uuid === pData.uuid);

                // プレイヤーのオンライン状態に変化がある場合のみ更新
                if (pData.isOnline !== playerIsOnline) {
                    dataChanged = true;

                    if (!playerIsOnline) {
                        console.log(`Player ${pData.name} marked as offline.`);
                        return { ...pData, isOnline: false, left: this.formatTimestamp() }; // オフライン時にタイムスタンプを記録
                    } else {
                        console.log(`Player ${pData.name} marked as online.`);
                        return { ...pData, isOnline: true, left: '' }; // オンライン時は left をクリア
                    }
                }

                return pData;
            });

            // 変更がある場合のみ保存処理を実行
            if (dataChanged) {
                await this.savePlayerData(updatedPlayerData);
            }
        } catch (error) {
            console.error('Error during checkOnlineStatus:', error);
        }
    }

    private async handleWorldRemoveEvent() {
        try {
            const playerData = await this.loadPlayerData();

            const updatedPlayerData = playerData.map((pData) => {
                if (pData.isOnline) {
                    console.log(`Player ${pData.name} marked as offline due to worldRemove event.`);
                    return { ...pData, isOnline: false, left: this.formatTimestamp() };
                }
                return pData;
            });

            await this.savePlayerData(updatedPlayerData);
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
                        const playerNames = Array.isArray(data.player) ? data.player[0] : data.player;
                        const playerName = await world
                            .getPlayers()
                            .then((players) => players.find((p) => p.name === playerNames)?.name);

                        if (!playerName) return;
                        if (playerName === undefined) return;
                        //console.log('playerJoin:', playerName);

                        const playerData = await this.loadPlayerData();
                        const timestamp = this.formatTimestamp();
                        let playerIndex = -1;
                        let uuid: string | null = null;
                        let isNewPlayer = false;
                        let isOnlineStatusChanged = false;

                        // UUID 取得とリトライ処理
                        let retryCount = 0;
                        const maxRetries = 10;
                        const retryInterval = 3000; // 3秒
                        while (!uuid && retryCount < maxRetries) {
                            uuid = await this.getPlayerUUID(playerName);
                            if (!uuid) {
                                retryCount++;
                                console.log(
                                    `UUID not found for player: ${playerName}, retrying in ${retryInterval / 1000} seconds... (${retryCount}/${maxRetries})`,
                                );
                                await new Promise((resolve) => setTimeout(resolve, retryInterval));
                            }
                        }

                        if (!uuid) {
                            console.error(
                                `Failed to get UUID for player: ${playerName} after ${maxRetries} retries.`,
                            );
                            return;
                        }

                        playerIndex = playerData.findIndex((p) => p.uuid === uuid);
                        if (playerIndex === -1) {
                            // 新規プレイヤー
                            playerData.push({
                                name: playerName,
                                oldNames: [],
                                uuid: uuid,
                                join: timestamp,
                                left: '',
                                isOnline: true,
                            });
                            console.log('New player added to playerData:', playerName);
                            isNewPlayer = true;
                        } else {
                            // 既存プレイヤー
                            const existingPlayer = playerData[playerIndex];
                            if (existingPlayer.name !== playerName) {
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
                                existingPlayer.join = timestamp;
                                isOnlineStatusChanged = true;
                            } else {
                                // console.log('Existing player already online:', playerName);
                            }

                            playerData[playerIndex] = existingPlayer;
                        }

                        if (playerData) {
                            await this.savePlayerData(playerData);
                        }
                        if (isNewPlayer || isOnlineStatusChanged) {
                            this.broadcastToClients({
                                event: 'playerJoin',
                                data: { name: playerName, uuid: uuid },
                            });
                            this.getWorld().triggerEvent('playerJoin', playerName);
                        }
                    }, 0);
                } catch (error) {
                    console.error('Error in playerJoin:', error);
                }
                break;
            case 'playerLeave':
                try {
                    setTimeout(async () => {
                        const playerName = Array.isArray(data.player) ? data.player[0] : data.player;
                        const playerData = await this.loadPlayerData();

                        let isTrulyOffline = false;
                        let retryCount = 0;
                        const maxRetries = 5; // 試行回数
                        const retryDelay = 1000; // ミリ秒単位の遅延

                        // オフライン確認のループ
                        while (!isTrulyOffline && retryCount < maxRetries) {
                            let playerUUID = await this.getPlayerUUID(playerName);
                            if (playerUUID === null) {
                                isTrulyOffline = true;
                            } else {
                                retryCount++;
                                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                            }
                        }

                        if (isTrulyOffline) {
                            let playerIndex = playerData.findIndex((p) => p.name === playerName);
                            if (playerIndex !== -1 && playerData[playerIndex]?.isOnline) {
                                console.log('Processing playerLeave for:', playerName);
                                const timestamp = this.formatTimestamp();
                                playerData[playerIndex].left = timestamp;
                                playerData[playerIndex].isOnline = false;
                                if (playerData) {
                                    await this.savePlayerData(playerData);
                                }
                                this.broadcastToClients({
                                    event: 'playerLeave',
                                    data: { name: playerName, uuid: playerData[playerIndex].uuid },
                                });
                                this.getWorld().triggerEvent('playerLeave', playerName);
                            }
                        }
                    }, 500);
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
