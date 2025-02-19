// backend.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { promises as fsPromises } from 'fs';
import { World } from './module/world';
import { Player, createPlayerObject } from './module/player';




export interface CommandConfig {
    enabled: boolean;
    adminOnly: boolean;
    requireTag: string[];
}

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

export async function verifier(player: Player, config: CommandConfig): Promise<boolean> {
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

export const prefix = '-';


export class WsServer {
    private port: number;
    private wss: WebSocketServer;
    private clients: Map<string, WebSocket>;
    public commands: Record<string, Command>;
    private minecraftClient: WebSocket | null;
    private commandPrefix: string;
    private world: World;
    private playerDataFile: string = 'playerData.json';
    private timeout: number = 5000;
    private activePlayers: Map<string, Player> = new Map();
    private isSaving: boolean = false;
    private saveQueue: PlayerData[] | null = null;
    constructor(port: number, commandPrefix: string = prefix) {
        this.port = port;
        this.clients = new Map<string, WebSocket>();
        this.commands = {};
        this.minecraftClient = null;
        this.commandPrefix = commandPrefix;

        this.world = new World('all', this);

        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('listening', async () => {
            console.log(`WebSocket server started on port ${this.port}`);
            const a = await import('./command/server');
            a; // Load commands
            this.initPlayerData(); // Initialize or load player data
            setInterval(() => {
                this.checkOnlineStatus();
            }, 10000);
        });
    }

    private async initPlayerData() {
        try {
            await fsPromises.access(this.playerDataFile);
            const data = await fsPromises.readFile(this.playerDataFile, 'utf-8');
            const jsonData = JSON.parse(data);

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
                await fsPromises.writeFile(this.playerDataFile, '[]');
                console.log('playerData.json created.');
            } else {
                console.error('Error initializing player data:', error);
            }
        }
    }

    private async handleMinecraftConnection(ws: WebSocket) {
        console.log('Minecraft server connected.');
        const load = await import('./import');
        load; // Load other modules
        this.minecraftClient = ws;
        ws.on('message', this.handleMinecraftMessage.bind(this));
        ws.on('close', this.handleMinecraftClose.bind(this));
        ws.on('error', this.handleMinecraftError.bind(this));
    }

    private handleMinecraftMessage(data: any) {
        try {
            const message = JSON.parse(data);
            this.handleMinecraftServerData(message.event, message.data);
        } catch (error) {
            console.error('Error processing message from Minecraft server:', error);
        }
    }

    private handleMinecraftClose() {
        console.log('Minecraft server disconnected.');
        this.minecraftClient = null;
    }

    private handleMinecraftError(error: any) {
        console.error('Error with Minecraft server connection:', error);
    }

    private handleConnection(ws: WebSocket, req: IncomingMessage) {
        const url = new URL(req.url!, `wss://${req.headers.host}`);
        if (url.pathname === '/minecraft') {
            this.handleMinecraftConnection(ws);
        } else if (url.pathname === '/isOnline') {
            ws.on('message', (data: any) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'isOnline') {
                    ws.send(JSON.stringify({ status: 'online' }));
                } else {
                    console.warn(`Received unknown request type: ${message.type} on path: ${url.pathname}`);
                }
            });
            ws.on('close', () => console.log('isOnline check connection closed.'));
            ws.on('error', (error) => console.error(`WebSocket error: ${error}`));
        } else {
            ws.close();
        }
    }


    public async executeMinecraftCommand(command: string): Promise<any> {
        if (!this.minecraftClient || this.minecraftClient.readyState !== WebSocket.OPEN) {
            return null;
        }

        return new Promise((resolve) => {
            const commandId = Math.random().toString(36).substring(2, 15);
            let resolved = false;
            let timeoutId: NodeJS.Timer;

            const listener = (data: any) => {
                if (resolved) return;
                const message = JSON.parse(data);
                if (message.event === 'commandResult' && message.data.commandId === commandId) {
                    resolved = true;
                    this.minecraftClient?.off('message', listener);
                    //@ts-ignore
                    clearTimeout(timeoutId);
                    resolve(message.data.result);
                }
            };

            this.minecraftClient?.setMaxListeners(0)
            this.minecraftClient?.on('message', listener);
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.minecraftClient?.off('message', listener);
                    resolve(null); // Resolve with null on timeout
                }
            }, this.timeout);

            this.sendToMinecraft({ command, commandId });
        });
    }

    private recentChatMessages: {
        sender: string;
        message: string;
        type: string;
        receiver: string;
        timestamp: number;
    }[] = [];
    private readonly chatRetention = 5000; // メッセージ履歴保持時間(ms)
    private readonly chatSpamThreshold = 1000; // 同じ送信者からのメッセージを拒否する期間(ms)

    // receiver のデフォルト値を "all" に設定
    public async onPlayerChat(
        sender: string,
        message: string,
        type: string,
        receiver: string = 'all',
    ) {
        let chatSender = sender;
        let chatMessage = message;

        // tell で自分自身に送る特殊な形式のメッセージの処理
        if (type === 'tell' && receiver === sender) {
            try {
                const parsedMessage = JSON.parse(message);
                if (parsedMessage?.rawtext?.[0]?.text) {
                    const text = parsedMessage.rawtext[0].text;
                    const nameMatch = text.match(/<([^>]*)>/);
                    chatSender = nameMatch ? nameMatch[1] : sender;
                    chatMessage = text.replace(/<[^>]*>\s*/, '');
                }
            } catch (error) { }
        }

        // スパムチェック (短期間に同じsenderからのメッセージを拒否)
        const now = Date.now();
        //@ts-ignore
        const lastMessageFromSender = this.recentChatMessages.findLast(
            (msg) => msg.sender === chatSender,
        );

        if (lastMessageFromSender && now - lastMessageFromSender.timestamp < this.chatSpamThreshold) {
            //console.warn(`[Spam Detected] Message from ${chatSender} was blocked due to rate limiting.`);
            return;
        }
        // 過去のメッセージ履歴は削除(chatRetentionより古いものを削除)
        this.recentChatMessages = this.recentChatMessages.filter(
            (msg) => now - msg.timestamp < this.chatRetention,
        );

        // メイン処理 (type === "chat")
        if (type === 'chat') {
            this.recentChatMessages.push({
                sender: chatSender,
                message: chatMessage,
                type,
                receiver,
                timestamp: now,
            });
            this.world.triggerEvent('playerChat', chatSender, chatMessage, type, receiver);
            if (chatMessage.startsWith(this.commandPrefix)) {
                const args = chatMessage
                    .slice(this.commandPrefix.length)
                    .replace('@', '')
                    .match(/(".*?"|\S+)/g)
                    ?.map((match: string) => match.replace(/"/g, ''));
                if (!args) return;
                const commandName = args.shift()!;
                const player = (await world.getEntityByName(chatSender)) as Player;
                if (!player) {
                    return;
                }
                this.processCommand(player, commandName, args);
                return;
            }
            this.broadcastToClients({
                event: 'playerChat',
                data: { sender: chatSender, message: chatMessage, type, receiver },
            });
            return;
        }

        // スコアボードチャットの処理 (type === "scoreboard")
        if (type === 'scoreboard') {
            // recentChatMessages 配列をチェック。"chat" が先に来ていれば処理しない
            const duplicateChat = this.recentChatMessages.find(
                (msg) =>
                    msg.sender === chatSender &&
                    msg.message === chatMessage &&
                    msg.type === 'chat' &&
                    msg.receiver === receiver,
            );

            if (duplicateChat) {
                // console.warn("Scoreboard event skipped because chat event was already processed.", duplicateChat);
                return;
            }

            if (chatMessage.startsWith(this.commandPrefix)) {
                const args = chatMessage
                    .slice(this.commandPrefix.length)
                    .replace('@', '')
                    .match(/(".*?"|\S+)/g)
                    ?.map((match: string) => match.replace(/"/g, ''));
                if (!args) return;
                const commandName = args.shift()!;
                const player = (await world.getEntityByName(chatSender)) as Player;
                if (!player) {
                    return;
                }
                this.processCommand(player, commandName, args);
                return;
            }
            // "chat" イベントがない場合のみ、"scoreboard" イベントを処理
            this.recentChatMessages.push({
                sender: chatSender,
                message: chatMessage,
                type,
                receiver,
                timestamp: now,
            });
            this.world.triggerEvent('playerChat', chatSender, chatMessage, type, receiver);
            this.broadcastToClients({
                event: 'playerChat',
                data: { sender: chatSender, message: chatMessage, type, receiver },
            });
        }
    }

    private async processCommand(player: Player, commandName: string, args: string[]) {
        const command = this.commands[commandName];
        if (!command) {
            player.sendMessage(`不明なコマンドです: ${commandName}`);
            return;
        }

        const hasPermission = await verifier(player, command.config);
        if (!hasPermission) return;

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

    public async loadPlayerData(): Promise<PlayerData[]> {
        while (this.isSaving) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        try {
            let data = await fsPromises.readFile(this.playerDataFile, 'utf8');

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
            return playerData;
        } catch (error) {
            console.error('Error reading player data file:', error);
            return [];
        }
    }

    private fixJson = (jsonString: string): string => {
        if (jsonString.trim() === '' || jsonString.trim() === '[]') {
            return '[]';
        }

        jsonString = jsonString.replace(
            /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
            (match, group) => (group ? '' : match),
        );
        jsonString = jsonString.trim().replace(/^[^\[\{]+|[^\]\}]+$/g, '');
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

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

        try {
            JSON.parse(jsonString);
            return jsonString;
        } catch {
            console.error('Failed to fix JSON. Returning an empty array.');
            return '[]';
        }
    };

    public async savePlayerData(newPlayerData: PlayerData[]) {
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

            // マージと重複削除、古いデータの削除を統合
            const mergedData = this.mergeAndCleanPlayerData(existingData, newPlayerData);

            const validPlayerData = mergedData.filter((player) => player.name && player.uuid);
            const data = JSON.stringify(validPlayerData, null, 2);
            await fsPromises.writeFile(this.playerDataFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving player data:', error);
        } finally {
            this.isSaving = false;
            if (this.saveQueue) {
                const queuedData = this.saveQueue;
                this.saveQueue = null;
                await this.savePlayerData(queuedData);
            }
        }
    }

    private mergeAndCleanPlayerData(existingData: PlayerData[], newPlayerData: PlayerData[]): PlayerData[] {
        const playerMap: { [uuid: string]: PlayerData } = {};

        // 既存データを処理
        for (const player of existingData) {
            if (player.uuid) {
                playerMap[player.uuid] = player;
            }
        }

        // 新しいデータで上書き/追加
        for (const player of newPlayerData) {
            if (player.uuid) {
                playerMap[player.uuid] = player;
            }
        }

        // 重複していないかチェックしマージされたデータを返す
        const mergedData: PlayerData[] = [];

        for (const uuid in playerMap) {
            if (playerMap.hasOwnProperty(uuid)) {
                mergedData.push(playerMap[uuid])
            }
        }

        return mergedData
    }


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

    // New getPlayers that uses cached data
    public async getPlayers(): Promise<Player[]> {
        return Array.from(this.activePlayers.values());
    }


    private onlinePlayerNamesCache: string[] = [];
    private currentOnlineCache: number = 0;
    private maxOnlineCache: number = 0;

    private async checkOnlineStatus() {
        try {
            // 1. list コマンドを実行
            const listResult = await this.executeMinecraftCommand('list');
            let playerData = await this.loadPlayerData();

            if (listResult?.statusCode === 0 && listResult?.players && listResult?.statusMessage) {
                // 人数情報を取得 (既存のコード)
                const countParts = listResult.statusMessage.split(' ');
                if (countParts.length > 1) {
                    const counts = countParts[0].split('/');
                    if (counts.length === 2) {
                        this.currentOnlineCache = parseInt(counts[0]);
                        this.maxOnlineCache = parseInt(counts[1]);
                        this.world.World_player = this.currentOnlineCache;
                        this.world.Max_player = this.maxOnlineCache;
                    }
                }

                // statusMessage の \n 以降の文字列からプレイヤー名を抽出 (既存のコード)
                const statusMessagePlayers = listResult.statusMessage.split('\n')[1] || '';
                const playerCandidates = statusMessagePlayers
                    .split(/[, ]*\s*[, ]+/)
                    .map(name => name.trim())
                    .filter(name => name !== "");

                // players の情報を使って、候補を検証・修正 (nameTag の不整合対策) (既存のコード)
                const playersTagInfo = listResult.players
                    .split(/[, ]*\s*[, ]+/)
                    .map(name => name.trim())
                    .filter(name => name !== "");

                this.onlinePlayerNamesCache = playerCandidates.filter(candidate => {
                    return playersTagInfo.some(tag => tag === candidate);
                });



                // 2. 参加処理 (既存のコード + 名前変更処理の統合)
                for (const playerName of this.onlinePlayerNamesCache) {
                    if (!this.activePlayers.has(playerName)) {
                        // 新規参加または再参加
                        const player = await createPlayerObject(this, playerName, this.world);
                        if (player) {
                            this.activePlayers.set(playerName, player);

                            // playerData.json の更新
                            let playerIndex = playerData.findIndex((p) => p.uuid === player.uuid); // UUIDで検索
                            if (playerIndex === -1) {
                                // 新規プレイヤー
                                playerData.push({
                                    name: playerName,
                                    oldNames: [],
                                    uuid: player.uuid,
                                    join: this.formatTimestamp(),
                                    left: '',
                                    isOnline: true,
                                });
                                console.log(
                                    `New player joined: ${playerName} - World: ${this.currentOnlineCache} / ${this.maxOnlineCache}`,
                                );
                            } else {
                                // 既存プレイヤー (再参加 または 名前変更)
                                const existingPlayer = playerData[playerIndex];

                                // 名前変更処理
                                if (existingPlayer.name !== playerName) {
                                    if (!existingPlayer.oldNames.includes(existingPlayer.name)) {
                                        existingPlayer.oldNames.unshift(existingPlayer.name);
                                        if (existingPlayer.oldNames.length > 3) {
                                            existingPlayer.oldNames.pop();
                                        }
                                    }
                                    console.log(`Player ${existingPlayer.name} name changed: ${playerName}`);
                                    this.broadcastToClients({
                                        event: 'playerNameChange',
                                        data: { oldName: existingPlayer.name, newName: playerName, uuid: existingPlayer.uuid },
                                    });
                                    existingPlayer.name = playerName; // 名前を更新

                                }

                                existingPlayer.join = this.formatTimestamp();
                                existingPlayer.isOnline = true;
                                // existingPlayer.uuid = player.uuid; // UUIDは変わらないので更新不要 (必要ならコメントアウトを外す)
                                playerData[playerIndex] = existingPlayer;  // 更新したデータを保存
                                console.log(
                                    `Player re-joined/updated: ${playerName} - World: ${this.currentOnlineCache} / ${this.maxOnlineCache}`,
                                );
                            }

                            this.broadcastToClients({
                                event: 'playerJoin',
                                data: { name: playerName, uuid: player.uuid },
                            });
                            this.getWorld().triggerEvent('playerJoin', playerName);
                        }
                    }
                    else {
                        // 4.  すでにアクティブなプレイヤーの名前変更処理 (UUID を使用するように変更)
                        const existingPlayer = this.activePlayers.get(playerName)!;
                        let playerIndex = playerData.findIndex((p) => p.uuid === existingPlayer.uuid);
                        if (playerIndex !== -1) {
                            const p = playerData[playerIndex];
                            if (p.name !== playerName) {
                                if (!p.oldNames.includes(p.name)) {
                                    p.oldNames.unshift(p.name);
                                    if (p.oldNames.length > 3) {
                                        p.oldNames.pop();
                                    }
                                }
                                console.log(`Player ${p.name} name changed: ${playerName}`);
                                this.broadcastToClients({
                                    event: 'playerNameChange',
                                    data: { oldName: p.name, newName: playerName, uuid: existingPlayer.uuid },
                                });
                                p.name = playerName; // 名前を更新
                                playerData[playerIndex] = p;

                            }
                        }
                    }
                }

                // 3. 退出処理 (既存のコード)
                const leftPlayers: string[] = [];
                for (const [playerName, player] of this.activePlayers) {
                    if (!this.onlinePlayerNamesCache.includes(playerName)) {
                        this.activePlayers.delete(playerName);
                        let playerIndex = playerData.findIndex((p) => p.uuid === player.uuid); // UUID で検索
                        if (playerIndex !== -1) {
                            playerData[playerIndex].isOnline = false;
                            playerData[playerIndex].left = this.formatTimestamp();
                        }
                        console.log(
                            `Player left: ${playerName} - World: ${this.currentOnlineCache} / ${this.maxOnlineCache}`,
                        );
                        this.broadcastToClients({
                            event: 'playerLeave',
                            data: { name: playerName, uuid: player.uuid },
                        });
                        this.getWorld().triggerEvent('playerLeave', playerName);
                        leftPlayers.push(playerName); //データ整合性チェックには不要なので削除可能
                    }
                }

            } else {
                // list コマンド失敗時、または必要なキーがない場合 (既存のコード + UUID で検索)
                for (const [playerName, player] of this.activePlayers) {
                    this.activePlayers.delete(playerName);
                    let playerIndex = playerData.findIndex((p) => p.uuid === player.uuid); // UUID で検索
                    if (playerIndex !== -1) {
                        playerData[playerIndex].isOnline = false;
                        playerData[playerIndex].left = this.formatTimestamp();
                        console.log(`Player left (list failed): ${playerName}`);
                        this.broadcastToClients({
                            event: 'playerLeave',
                            data: { name: playerName, uuid: player.uuid },
                        });
                        this.getWorld().triggerEvent('playerLeave', playerName);
                    }
                }
                // 全員をオフラインにする(playerData.json)
                for (const player of playerData) {
                    if (player.isOnline) {
                        player.isOnline = false;
                        player.left = this.formatTimestamp();
                    }
                }
            }

            // 5. データ整合性チェック (最終的なデータ修正, UUID を使うように修正)
            for (const player of playerData) {
                // UUID を持つプレイヤーのみ処理 (重要: UUID が無いと正しく判定できない)
                if (player.uuid) {
                    const onlinePlayer = Array.from(this.activePlayers.values()).find(p => p.uuid === player.uuid);
                    const isOnline = !!onlinePlayer; // onlinePlayer が存在すれば true

                    if (player.isOnline !== isOnline) {
                        player.isOnline = isOnline;
                        if (!isOnline) {
                            player.left = this.formatTimestamp();
                        }
                        console.log(`Data fixed: Player ${player.name} isOnline status corrected to ${isOnline}.`);
                    }
                    // 名前が一致しない場合も修正
                    if (isOnline && onlinePlayer.name !== player.name) {
                        if (!player.oldNames.includes(player.name)) {
                            player.oldNames.unshift(player.name);
                            if (player.oldNames.length > 3) {
                                player.oldNames.pop();
                            }

                        }
                        console.log(`Data fixed and Player ${player.name} name changed: ${onlinePlayer.name}`);
                        this.broadcastToClients({
                            event: 'playerNameChange',
                            data: { oldName: player.name, newName: onlinePlayer.name, uuid: player.uuid },
                        });
                        player.name = onlinePlayer.name;
                    }
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
            case 'playerChat': // Only handle chat
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
            // console.warn('Unknown event received:', event); // Less verbose
        }
    }

    public getWorld(): World {
        return this.world;
    }

    public broadcastToClients(data: any) {
        const message = JSON.stringify(data);
        for (const client of this.clients.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    public sendToMinecraft(data: any) {
        if (!this.minecraftClient || this.minecraftClient.readyState !== WebSocket.OPEN) {
            return;
        }
        try {
            this.minecraftClient.send(JSON.stringify(data));
        } catch (error) {
            console.error('Error sending data to Minecraft server:', error);
        }
    }

    public close() {
        for (const client of this.clients.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        }
        this.clients.clear();

        if (this.minecraftClient && this.minecraftClient.readyState === WebSocket.OPEN) {
            this.minecraftClient.close();
            this.minecraftClient = null;
        }

        this.wss.close(() => {
            console.log('WebSocket server closed.');
        });
    }
}


export const wsserver = new WsServer(19133);
export const world = wsserver.getWorld();

export function registerCommand(command: Command) {
    wsserver.commands[command.name] = command;
}


export function removeCommand(name: string) {
    if (typeof wsserver !== 'undefined' && wsserver.commands && wsserver.commands[name]) {
        delete wsserver.commands[name];
        console.log(`[CommandManager] Command '${name}' removed.`);
    } else {
        console.warn(`[CommandManager] Command '${name}' not found or wsserver.commands is not accessible.`);
    }
}

process.on('SIGINT', () => {
    console.log('SIGINT signal received. Closing server...');
    wsserver.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing server...');
    wsserver.close();
})