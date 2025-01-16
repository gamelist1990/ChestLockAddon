import { WsServer, Player } from '../backend';

// ScoreboardObjective クラス
export class ScoreboardObjective {
    private world: World;
    public id: string;
    public displayName: string;

    constructor(world: World, id: string, displayName: string) {
        this.world = world;
        this.id = id;
        this.displayName = displayName;
    }

    // 修正後の getScore メソッド
    async getScore(playerName: string): Promise<number | null> {
        const res = await this.world.scoreboard.getScores(playerName);
        return res[this.id] !== undefined ? res[this.id] : null;

    }

    async setScore(playerName: string, score: number): Promise<void> {
        await this.world.runCommand(`scoreboard players set "${playerName}" "${this.id}" ${score}`);
    }

    async addScore(playerName: string, score: number): Promise<void> {
        await this.world.runCommand(`scoreboard players add "${playerName}" "${this.id}" ${score}`);
    }

    async removeScore(playerName: string, score: number): Promise<void> {
        await this.world.runCommand(`scoreboard players remove "${playerName}" "${this.id}" ${score}`);
    }

    async resetScore(playerName: string): Promise<void> {
        await this.world.runCommand(`scoreboard players reset "${playerName}" "${this.id}"`);
    }
}

export class World {
    public name: string;
    private eventListeners: { [event: string]: Function[] } = {};
    private wsServer: WsServer;
    public lastActivity: number;
    private playerCache: { [playerName: string]: Player | null } = {};
    public scoreboard: ScoreboardManager;


    constructor(name: string, wsServer: WsServer) {
        this.name = name;
        this.wsServer = wsServer;
        this.lastActivity = Date.now();
        this.scoreboard = new ScoreboardManager(this);
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


// ScoreboardManager クラス (World クラスの中に定義)
class ScoreboardManager {
    private world: World;
    private objectivesCache: { [objectiveName: string]: ScoreboardObjective | null } = {};

    constructor(world: World) {
        this.world = world;
    }

    public async getObjective(objectiveId: string): Promise<ScoreboardObjective | null> {
        // キャッシュにオブジェクトが存在するか確認
        if (this.objectivesCache.hasOwnProperty(objectiveId)) {
            return this.objectivesCache[objectiveId];
        }

        const objectives = await this.getObjectives();
        const objective = objectives.find(objective => objective.id === objectiveId);
        if (objective) {
            this.objectivesCache[objectiveId] = objective
            return objective;
        }
        this.objectivesCache[objectiveId] = null;
        return null;
    }

    public async getObjectives(): Promise<ScoreboardObjective[]> {
        // コマンド `scoreboard objectives list` を実行して、目的リストを取得します。
        const res = await this.world.runCommand('scoreboard objectives list');

        if (!res || res.statusCode !== 0 || !res.statusMessage) {
            return []; // コマンド実行エラー、またはレスポンスがない場合は空の配列を返す
        }


        const objectives = res.statusMessage.split('\n').slice(1).map(entry => {
            try {
                const [id, displayName] = [...entry.matchAll(/- (.*):.*?'(.*?)'.*/g)][0].slice(1, 3);
                return new ScoreboardObjective(this.world, id, displayName);
            } catch (e) {
                return null;
            }

        }).filter((v) => v) as ScoreboardObjective[];
        return objectives;

    }

    public async addObjective(objectiveName: string, displayName: string, criteria: string = 'dummy'): Promise<ScoreboardObjective | null> {
        const res = await this.world.runCommand(`scoreboard objectives add "${objectiveName}" ${criteria} "${displayName}"`)

        if (!res || res.statusCode !== 0) {
            return null; // コマンド実行エラー、またはレスポンスがない場合は null を返す
        }

        const newObjective = await this.getObjective(objectiveName);
        return newObjective;
    }

    public async removeObjective(objectiveId: string): Promise<boolean> {
        const objective = ScoreboardManager.resolveObjective(objectiveId);
        const res = await this.world.runCommand(`scoreboard objectives remove ${objective}`)
        if (!res || res.statusCode !== 0) {
            return false; // コマンド実行エラー、またはレスポンスがない場合は null を返す
        }
        if (this.objectivesCache.hasOwnProperty(objectiveId)) {
            this.objectivesCache[objectiveId] = null
        }
        return true;
    }

    // getScores メソッドを追加
    public async getScores(player: string): Promise<{ [objective: string]: number | null }> {
        const res = await this.world.runCommand(`scoreboard players list "${player}"`);
        try {
            return Object.fromEntries(
                [...res.statusMessage.matchAll(/: (-*\d*) \((.*?)\)/g)]
                    .map(data => [data[2], Number(data[1])])
            );
        } catch {
            return {};
        }
    }

    /**
     * Returns an objective id.
     * @param {string|ScoreboardObjective} objective Objective or its id to resolve.
     * @returns {string} objectiveId The id of the objective.
     */
    static resolveObjective(objective: string | ScoreboardObjective): string {
        return typeof objective === 'string' ? objective : objective.id;
    }
}