import { WsServer, Player } from '../backend';

export class World {
    public name: string;
    private eventListeners: { [event: string]: Function[] } = {};
    private wsServer: WsServer;
    public lastActivity: number;
    private playerCache: { [playerName: string]: Player | null } = {};

    constructor(name: string, wsServer: WsServer) {
        this.name = name;
        this.wsServer = wsServer;
        this.lastActivity = Date.now();
    }

    // 外部からのイベントリスナー登録を可能にする on メソッドを保持
    public on(eventName: string, callback: Function): void {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    // 内部からイベントをトリガーするメソッドも保持
    public triggerEvent(eventName: string, ...args: any[]): void {
        this.lastActivity = Date.now();
        const listeners = this.eventListeners[eventName];
        if (listeners) {
            listeners.forEach((listener) => listener(...args));
        }
    }

    public sendMessage(message: string): void {
        this.wsServer.sendToMinecraft({ command: 'sendMessage', message: `${message}` });
    }

    public runCommand(command: string): Promise<any> {
        return this.wsServer.executeMinecraftCommand(command);
    }

    // プレイヤーを名前で検索するメソッド
    public async getEntityByName(playerName: string): Promise<Player | null> {
        // キャッシュにプレイヤーデータが存在するか確認
        if (this.playerCache.hasOwnProperty(playerName)) {
            return this.playerCache[playerName];
        }

        // プレイヤーオブジェクトを生成 (createPlayerObject は WsServer のメソッド)
        const player = await this.wsServer.createPlayerObject(playerName);

        // プレイヤーオブジェクトをキャッシュに保存
        this.playerCache[playerName] = player;

        return player;
    }

    // ワールドにいる全てのプレイヤーを取得するメソッド
    public async getPlayers(): Promise<Player[]> {
        const queryResult = await this.wsServer.executeMinecraftCommand(`list`);
        if (queryResult === null || queryResult.statusCode !== 0 || !queryResult.statusMessage) {
            return []; // エラーが発生した場合、または statusMessage がない場合は空の配列を返す
        }

        // ログのパターンに応じて処理を分岐
        const players: Player[] = [];

        if (queryResult.statusMessage.includes("オンラインです:")) {
            // "オンラインです:\n" 以降の文字列を取得
            const playerListString = queryResult.statusMessage.split("オンラインです:\n")[1];

            // プレイヤー名をカンマとスペースで分割して配列にする
            const playerNames = playerListString.split(", ");

            for (const name of playerNames) {
                const player = await this.getEntityByName(name.trim());
                if (player) {
                    players.push(player);
                }
            }
        }

        return players;
    }

    // 不完全な名前から完全な名前を取得するメソッド
    public async getName(partialName: string): Promise<Player | null> {
        const players = await this.getPlayers();

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            // partialName の中に player.name が含まれているかチェック(大文字小文字を区別しない)
            if (partialName.toLowerCase().includes(player.name.toLowerCase())) {
                return player;
            }
        }
        return null;
    }

    // プレイヤーが存在するかどうかを確認するメソッド
    public async isPlayer(playerName: string): Promise<boolean> {
        const player = await this.getEntityByName(playerName);
        return !!player; // player オブジェクトが存在すれば true, 存在しなければ false を返す
    }
}