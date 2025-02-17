import { WsServer, PlayerData, world } from '../backend';
import { createPlayerObject, Player } from './player';

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

    async getScore(playerName: string): Promise<number | null> {
        //console.debug(`[getScore] ${this.id} の ${playerName} のスコアを取得します。`);
        // 直接 /scoreboard players list <playerName> <objective> でスコアを取得する
        const scoreRes = await this.world.runCommand(`scoreboard players list "${playerName}"`);
        // console.debug(`[getScore] ${playerName} の ${this.id} スコア取得結果:`, scoreRes);

        if (scoreRes && scoreRes.statusCode === 0 && scoreRes.statusMessage) {
            const lines = scoreRes.statusMessage.split('\n');
            for (const line of lines) {
                // 正規表現でスコア情報を取得（変更）
                const scoreMatch = line.match(/^-.*: (\d+) \(/);
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1]);
                    //console.debug(`[getScore] ${playerName} の ${this.id} スコア: ${score}`);
                    return score;
                }
            }
        }

        // console.debug(`[getScore] ${playerName} の ${this.id} スコアが見つかりませんでした。`);
        return null;
    }

    private async runCommandWithPlayerCheck(commandTemplate: string, playerOrName: Player | string, score?: number): Promise<void> {
        let playerName: string;
        if (playerOrName) {
            playerName = typeof playerOrName === 'string' ? `"${playerOrName}"` : `@a[name="${playerOrName.name}"]`; // Player型ならセレクターを使用
        } else {
            playerName = `"${playerOrName}"`;
        }

        const command = commandTemplate
            .replace("{playerName}", playerName)
            .replace("{objectiveId}", this.id)
            .replace("{score}", score !== undefined ? score.toString() : "");

        await this.world.runCommand(command);
    }

    async setScore(playerOrName: Player | string, score: number): Promise<void> {
        await this.runCommandWithPlayerCheck(`scoreboard players set {playerName} {objectiveId} {score}`, playerOrName, score);
    }

    async addScore(playerOrName: Player | string, score: number): Promise<void> {
        await this.runCommandWithPlayerCheck(`scoreboard players add {playerName} {objectiveId} {score}`, playerOrName, score);
    }

    async removeScore(playerOrName: Player | string, score: number): Promise<void> {
        await this.runCommandWithPlayerCheck(`scoreboard players remove {playerName} {objectiveId} {score}`, playerOrName, score);
    }

    async resetScore(playerOrName: Player | string): Promise<void> {
        await this.runCommandWithPlayerCheck(`scoreboard players reset {playerName} {objectiveId}`, playerOrName);
    }

    async getScores(): Promise<{ participant: string, score: number }[]> {
        const listRes = await this.world.runCommand(`scoreboard players list *`);

        if (!listRes || listRes.statusCode !== 0 || !listRes.statusMessage) {
            return [];
        }

        const scores: { participant: string, score: number }[] = [];
        const lines = listRes.statusMessage.split("\n");
        let currentParticipant: string | null = null;

        for (const line of lines) {
            // プレイヤー名の取得 (パターン1: "§a選択された..." の行)
            const playerInfoRegex1 = /§a選択された \d+ 個のオブジェクトを (.*?) に表示:/;
            const playerMatch1 = playerInfoRegex1.exec(line);
            if (playerMatch1) {
                currentParticipant = playerMatch1[1].trim();
                continue;
            }

            // プレイヤー名の取得(パターン2: "プレイヤー XXX にはスコアの記録はありません")
            const playerInfoRegex2 = /プレイヤー (.*?) にはスコアの記録はありません/;
            const playerMatch2 = playerInfoRegex2.exec(line);
            if (playerMatch2) {
                currentParticipant = null; // スコアがないプレイヤーなのでnullにする
                continue;
            }


            // スコア情報の取得
            const scoreRegex = new RegExp(`- (.+?): (\\d+) \\((${this.id})\\)`);
            const scoreMatch = scoreRegex.exec(line);

            if (scoreMatch && scoreMatch[3] === this.id) {
                const score = parseInt(scoreMatch[2]);
                // currentParticipantがnullでないことを確認してからpush
                if (currentParticipant !== null) {
                    scores.push({ participant: currentParticipant, score: score });
                }

            }
        }

        return scores;
    }

    async removeParticipant(playerName: string): Promise<void> {
        await this.world.runCommand(`scoreboard players reset "${playerName}" "${this.id}"`);
    }
}

export class World {
    public name: string;
    private eventListeners: { [event: string]: Function[] } = {};
    private wsServer: WsServer;
    public lastActivity: number;
    public scoreboard: ScoreboardManager;
    private tpsTicks: number = 0;
    private lastTpsUpdate: number = 0;
    private tps: number = 20;
    public World_player: number = 0;
    public Max_player: number = 0;

    constructor(name: string, wsServer: WsServer) {
        this.name = name;
        this.wsServer = wsServer;
        this.lastActivity = Date.now();
        this.scoreboard = new ScoreboardManager(this);

        // TPS計測用のイベントリスナーを登録
        this.on('tick', () => {
            this.tpsTicks++;
            const now = Date.now();
            if (now - this.lastTpsUpdate >= 1000) {
                this.tps = this.tpsTicks * 1000 / (now - this.lastTpsUpdate);
                this.tpsTicks = 0;
                this.lastTpsUpdate = now;
            }
        });
    }

    public getTPS(): number {
        return this.tps;
    }

    public on(eventName: string, callback: Function): void {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    public triggerEvent(eventName: string, ...args: any[]): void {
        this.lastActivity = Date.now();
        const listeners = this.eventListeners[eventName];
        if (listeners) {
            listeners.forEach((listener) => listener(...args));
        }
    }

    public async getPlayerData(): Promise<{ [key: string]: PlayerData }> {
        const playerDataArray = await this.wsServer.loadPlayerData();
        const playerDataObject: { [key: string]: PlayerData } = {};
        playerDataArray.forEach(playerData => {
            playerDataObject[playerData.name] = playerData;
        });
        return playerDataObject;
    }

    public sendMessage(message: string): void {
        this.wsServer.sendToMinecraft({ command: 'sendMessage', message: `${message}` });
    }

    public runCommand(command: string): Promise<any> {
        return this.wsServer.executeMinecraftCommand(command);
    }

    // プレイヤー情報を常に最新にするため、キャッシュを使用しないように変更
    public async getEntityByName(playerName: string): Promise<Player | null> {
        const player = await createPlayerObject(this.wsServer, playerName, world);
        return player;
    }

    /**
    * プレイヤーの表示名から実名（realname）を抽出し、Player オブジェクトを返します。
    * @param displayName プレイヤーの表示名
    * @returns プレイヤーの実名に対応する Player オブジェクト。見つからない場合は null。
    */
    public async getRealname(displayName: string): Promise<Player | null> {
        const players = await this.getPlayers();

        // プレイヤーリストをソートして効率化 (オプション)
        players.sort((a, b) => a.name.length - b.name.length);

        for (const player of players) {
            if (displayName) {
                try {
                    if (displayName.toLowerCase().includes(player.name.toLowerCase())) {
                        return player;
                    }
                } catch (error) {
                    //  console.error(`Error${error}`)
                }
            }
        }
        return null;
    }

    public async getPlayerNames(): Promise<string[]> {
        const queryResult = await this.wsServer.executeMinecraftCommand(`list`);
        if (queryResult === null || queryResult.statusCode !== 0 || !queryResult.statusMessage) {
            return [];
        }

        if (queryResult.statusMessage.includes("オンラインです:")) {
            const playerListString = queryResult.statusMessage.split("オンラインです:\n")[1];
            return playerListString.split(", ").map((name: string) => name.trim());
        } else {
            console.warn("Unknown log format:", queryResult.statusMessage);
            return [];
        }
    }

    public async getPlayers(): Promise<Player[]> {
        const queryResult = await this.wsServer.executeMinecraftCommand(`list`);
        if (queryResult === null || queryResult.statusCode !== 0 || !queryResult.statusMessage) {
            return [];
        }

        const players: Player[] = [];

        if (queryResult.statusMessage.includes("オンラインです:")) {
            const playerListString = queryResult.statusMessage.split("オンラインです:\n")[1];
            const playerNames = playerListString.split(", ");

            for (const name of playerNames) {
                // getEntityByNameを毎回呼び出して最新の情報を取得
                const player = await this.getEntityByName(name.trim());
                if (player) {
                    players.push(player);
                }
            }
        }

        return players;
    }

    public async getName(partialName: string): Promise<Player | null> {
        const players = await this.getPlayers();

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            if (partialName.toLowerCase().includes(player.name.toLowerCase())) {
                return player;
            }
        }
        return null;
    }

    public async isPlayer(playerName: string): Promise<boolean> {
        const queryResult = await this.runCommand(`list`);
        if (queryResult === null || queryResult.statusCode !== 0 || !queryResult.statusMessage) {
            return false;
        }

        if (queryResult.statusMessage.includes('オンラインです:')) {
            const playerListString = queryResult.statusMessage.split('オンラインです:\n')[1];
            if (playerListString) {
                const playerNames = playerListString.split(', ');
                return playerNames.includes(playerName);
            } else {
                return false;
            }
        } else {
            //console.warn("Unknown log format:", queryResult.statusMessage);
            return false;
        }
    }

    public async getBlock(x: number, y: number, z: number): Promise<{ blockName: string, position: { x: number, y: number, z: number } } | null> {
        // 1. gettopsolidblock で直下の固体ブロックを取得
        const getTopSolidBlockRes = await this.runCommand(`gettopsolidblock ${x} ${y + 1} ${z}`);
        if (!getTopSolidBlockRes || getTopSolidBlockRes.statusCode !== 0) {
            if (getTopSolidBlockRes) {
                console.error(`Error getting top solid block at ${x} ${y} ${z}: ${getTopSolidBlockRes.statusMessage}`);
            }
            return null;
        }

        const topSolidBlockName = getTopSolidBlockRes.blockName;
        const topSolidBlockPos = { x: getTopSolidBlockRes.position.x, y: getTopSolidBlockRes.position.y, z: getTopSolidBlockRes.position.z };

        // 2. testforblock で、取得したブロックが指定座標に存在するか確認
        const testForBlockRes = await this.runCommand(`testforblock ${x} ${y} ${z} ${topSolidBlockName}`);
        if (testForBlockRes && testForBlockRes.statusCode === 0 && testForBlockRes.matches === true) {
            return {
                blockName: topSolidBlockName,
                position: topSolidBlockPos
            };
        } else {
            // エラーハンドリング: 必要に応じてログ出力やエラーメッセージの確認を行う
            if (testForBlockRes && testForBlockRes.statusCode !== 0) {
                console.error(`Error testing for block at ${x} ${y} ${z}: ${testForBlockRes.statusMessage}`);
            }
            return null;
        }
    }

    public async getBlocksInArea(x1: number, z1: number, x2?: number, z2?: number, y: number = 64): Promise<{ [key: string]: { id: string, blockName: string } }> {
        const startY = y + 100;
        const blocks: { [key: string]: { id: string, blockName: string } } = {};

        if (x2 !== undefined && z2 !== undefined) {
            // 範囲指定の場合
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
                    const res = await this.runCommand(`gettopsolidblock ${x} ${startY} ${z}`);
                    if (res && res.statusCode === 0) {
                        // /testforblock コマンドを使ってブロックIDも取得 (例: /testforblock ~ ~ ~ grass_block)
                        const testRes = await this.runCommand(`testforblock ${x} ${startY - 1} ${z} grass_block`);
                        const blockId = testRes.statusCode === 0 ? 'minecraft:grass_block' : (res.blockName || 'unknown'); // ブロックIDを判定 (一例)

                        blocks[`${x},${z}`] = { id: blockId, blockName: res.blockName }; // ブロック名に加えて、ブロックIDも格納
                    } else {
                        // console.warn(`Failed to get top solid block at ${x} ${startY} ${z}`);
                        blocks[`${x},${z}`] = { id: 'unknown', blockName: 'unknown' };
                    }
                }
            }
        } else {
            // 単一座標指定の場合 (x2, z2 が undefined)
            const res = await this.runCommand(`gettopsolidblock ${x1} ${startY} ${z1}`);
            if (res && res.statusCode === 0) {
                const testRes = await this.runCommand(`testforblock ${x1} ${startY - 1} ${z1} grass_block`);
                const blockId = testRes.statusCode === 0 ? 'minecraft:grass_block' : (res.blockName || 'unknown');

                blocks[`${x1},${z1}`] = { id: blockId, blockName: res.blockName };
            } else {
                // console.warn(`Failed to get top solid block at ${x1} ${startY} ${z1}`);
                blocks[`${x1},${z1}`] = { id: 'unknown', blockName: 'unknown' };
            }
        }

        return blocks;
    }

}

// ScoreboardManager クラス
class ScoreboardManager {
    private world: World;

    constructor(world: World) {
        this.world = world;
    }

    public async getObjective(objectiveId: string): Promise<ScoreboardObjective | null> {
        //  console.log(`[getObjective] objectiveId: ${objectiveId} を取得試行`);
        //  console.log(`[getObjective] getObjectives() を呼び出します。`);

        const objectives = await this.getObjectives();
        const objective = objectives.find(objective => objective.id === objectiveId);

        if (objective) {
            // console.log(`[getObjective] objectiveId: ${objectiveId} が見つかりました。`);
            //console.log(`[getObjective] objectiveId: ${objective.id} を返します。`);
            return objective;
        }

        //console.log(`[getObjective] objectiveId: ${objectiveId} は見つかりませんでした。`);
        //console.log(`[getObjective] null を返します。`);
        return null;
    }

    public async getObjectives(): Promise<ScoreboardObjective[]> {
        const res = await this.world.runCommand('scoreboard objectives list');

        if (!res || res.statusCode !== 0 || !res.statusMessage) {
            return [];
        }

        const objectives = res.statusMessage.split('\n').slice(1).map(entry => {
            try {
                const match = entry.match(/- (.*?): '(.*?)' と表示され、型は '(.*?)' です$/);
                if (match) {
                    const [, id, displayName, criteria] = match;
                    return new ScoreboardObjective(this.world, id, displayName);
                } else {
                    return null;
                }
            } catch (e) {
                return null;
            }
        }).filter((v) => v) as ScoreboardObjective[];

        return objectives;
    }

    public async addObjective(objectiveName: string, displayName: string, criteria: string = 'dummy'): Promise<ScoreboardObjective | null> {
        const command = `scoreboard objectives add "${objectiveName}" ${criteria} "${displayName}"`;

        try {
            const res = await this.world.runCommand(command);

            if (!res || res.statusCode !== 0) {
                if (res && res.statusMessage && res.statusMessage.includes('というオブジェクトは既に存在します')) {
                    return await this.getObjective(objectiveName);
                } else {
                    return null;
                }
            }

            const newObjective = new ScoreboardObjective(this.world, objectiveName, displayName);
            // キャッシュに保存しないように変更
            // this.objectivesCache[objectiveName] = newObjective;
            return newObjective;

        } catch (error) {
            return null;
        }
    }

    public async removeObjective(objectiveId: string): Promise<boolean> {
        const objective = ScoreboardManager.resolveObjective(objectiveId);
        const res = await this.world.runCommand(`scoreboard objectives remove ${objective}`);
        if (!res || res.statusCode !== 0) {
            return false;
        }
        // キャッシュから削除しないように変更
        // if (this.objectivesCache.hasOwnProperty(objectiveId)) {
        //     this.objectivesCache[objectiveId] = null;
        // }
        return true;
    }

    static resolveObjective(objective: string | ScoreboardObjective): string {
        return typeof objective === 'string' ? objective : objective.id;
    }


}