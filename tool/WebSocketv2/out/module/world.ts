import { WsServer, Player, PlayerData } from '../backend';

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
        const scores = await this.getScores();
        const playerScore = scores.find(score => score.participant === playerName);
        return playerScore ? playerScore.score : null;
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

    async getScores(): Promise<{ participant: string, score: number }[]> {
        const res = await this.world.runCommand(`scoreboard players list`);
        if (!res || res.statusCode !== 0) {
            return [];
        }

        const scores: { participant: string, score: number }[] = [];
        const lines = res.statusMessage.split('\n');
        for (const line of lines) {
            const match = line.match(/^(.*?)\s+のスコアは\s+(-?\d+)/);
            if (match) {
                const participant = match[1];
                const score = parseInt(match[2]);
                scores.push({ participant, score });
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
    private playerCache: { [playerName: string]: Player | null } = {};
    public scoreboard: ScoreboardManager;

    constructor(name: string, wsServer: WsServer) {
        this.name = name;
        this.wsServer = wsServer;
        this.lastActivity = Date.now();
        this.scoreboard = new ScoreboardManager(this);
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
        return this.wsServer.loadPlayerData();
    }

    public sendMessage(message: string): void {
        this.wsServer.sendToMinecraft({ command: 'sendMessage', message: `${message}` });
    }

    public runCommand(command: string): Promise<any> {
        return this.wsServer.executeMinecraftCommand(command);
    }

    public async getEntityByName(playerName: string): Promise<Player | null> {
        if (this.playerCache.hasOwnProperty(playerName)) {
            return this.playerCache[playerName];
        }

        const player = await this.wsServer.createPlayerObject(playerName);

        this.playerCache[playerName] = player;
        return player;
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
        const player = await this.getEntityByName(playerName);
        return !!player;
    }

    public async getBlock(x: number, y: number, z: number): Promise<{ blockName: string, position: { x: number, y: number, z: number } } | null> {
        // 1. gettopsolidblock で直下の固体ブロックを取得
        const getTopSolidBlockRes = await this.runCommand(`gettopsolidblock ${x} ${y+1} ${z}`);
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


    public async getBlocksInArea(x1: number, z1: number, x2?: number, z2?: number, y: number = 64): Promise<{ [key: string]: string }> {
        const startY = y + 100;
        const blocks: { [key: string]: string } = {};

        if (x2 !== undefined && z2 !== undefined) {
            // 範囲指定の場合
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
                for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
                    const res = await this.runCommand(`gettopsolidblock ${x} ${startY} ${z}`);
                    if (res && res.statusCode === 0) {
                        blocks[`${x},${z}`] = res.blockName;
                    } else {
                        console.warn(`Failed to get top solid block at ${x} ${startY} ${z}`);
                        blocks[`${x},${z}`] = "unknown";
                    }
                }
            }
        } else {
            // 単一座標指定の場合 (x2, z2 が undefined)
            const res = await this.runCommand(`gettopsolidblock ${x1} ${startY} ${z1}`);
            if (res && res.statusCode === 0) {
                blocks[`${x1},${z1}`] = res.blockName;
            } else {
                console.warn(`Failed to get top solid block at ${x1} ${startY} ${z1}`);
                blocks[`${x1},${z1}`] = "unknown";
            }
        }

        return blocks;
    }
    
}

// ScoreboardManager クラス
class ScoreboardManager {
    private world: World;
    private objectivesCache: { [objectiveName: string]: ScoreboardObjective | null } = {};

    constructor(world: World) {
        this.world = world;
    }

    public async getObjective(objectiveId: string): Promise<ScoreboardObjective | null> {
        if (this.objectivesCache.hasOwnProperty(objectiveId)) {
            return this.objectivesCache[objectiveId];
        }

        const objectives = await this.getObjectives();
        const objective = objectives.find(objective => objective.id === objectiveId);
        if (objective) {
            this.objectivesCache[objectiveId] = objective;
            return objective;
        }
        this.objectivesCache[objectiveId] = null;
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
            this.objectivesCache[objectiveName] = newObjective;
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
        if (this.objectivesCache.hasOwnProperty(objectiveId)) {
            this.objectivesCache[objectiveId] = null;
        }
        return true;
    }

    static resolveObjective(objective: string | ScoreboardObjective): string {
        return typeof objective === 'string' ? objective : objective.id;
    }
}