import { WsServer } from '../backend';
import { getData } from './Data';
import { World } from './world';

export interface Player {
    name: string;
    uuid: string;
    id: number;
    dimension: number;
    ping: number;
    bps: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    onScreenDisplay: ScreenDisplay;
    sendMessage: (message: string) => void;
    runCommand: (command: string) => Promise<any>;
    hasTag: (tag: string) => Promise<boolean>;
    getTags: () => Promise<string[]>;
    getXp: () => Promise<number>;
    isPermissionCategoryEnabled(permissionCategory: string): Promise<boolean>;
    setPermissionCategory(permissionCategory: string, isEnabled: boolean): Promise<void>;
    getGameMode(): Promise<GameMode>;
}

export interface ScreenDisplay {
    setActionBar: (text: string[] | string) => Promise<void>;
    setTitle: (text: string[] | string) => Promise<void>;
}

export interface InputPermissionCategory {
    camera: string;
    sneak: string;
    jump: string;
    dismount: string;
    lateral_movement: string;
    mount: string;
    move_backward: string;
    move_forward: string;
    move_left: string;
    move_right: string;
    movement: string;
}

export const InputPermissionCategories: InputPermissionCategory = {
    camera: "camera",
    sneak: "sneak",
    jump: "jump",
    dismount: "dismount",
    lateral_movement: "lateral_movement",
    mount: "mount",
    move_backward: "move_backward",
    move_forward: "move_forward",
    move_left: "move_left",
    move_right: "move_right",
    movement: "movement",
} as const;


export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator';

export class PlayerImpl implements Player {
    constructor(
        public name: string,
        public uuid: string,
        public id: number,
        public dimension: number,
        public ping: number,
        public bps: number,
        public position: { x: number; y: number; z: number },
        private server: WsServer,
        private world: World,
    ) { }
    onScreenDisplay: ScreenDisplay = {
        setActionBar: async (text: string[] | string): Promise<void> => {
            const textJson =
                typeof text === 'string'
                    ? `{"rawtext":[{"text":"${text}"}]}`
                    : JSON.stringify({ rawtext: text.map((t) => ({ text: t })) });
            const command = `/titleraw ${this.name} actionbar ${textJson}`;
            const result = await this.server.executeMinecraftCommand(command);
            if (!result || result.statusCode !== 0) {
                //console.error(`Failed to set action bar for ${playerName}: ${result?.statusMessage || 'Unknown error'}`);
                throw new Error(`Failed to set action bar for ${this.name}`);
            }
        },
        setTitle: async (text: string[] | string): Promise<void> => {
            const textJson =
                typeof text === 'string'
                    ? `{"rawtext":[{"text":"${text}"}]}`
                    : JSON.stringify({ rawtext: text.map((t) => ({ text: t })) });
            const command = `/titleraw ${this.name} title ${textJson}`;
            const result = await this.server.executeMinecraftCommand(command);
            if (!result || result.statusCode !== 0) {
                // console.error(`Failed to set Title for ${playerName}: ${result?.statusMessage || 'Unknown error'}`);
                throw new Error(`Failed to set Title for ${this.name}`);
            }
        },
    };
    sendMessage(message: string) {
        this.server.sendToMinecraft({ command: `sendMessage`, message, playerName: this.name });
    }

    async runCommand(command: string): Promise<any> {
        return this.server.executeMinecraftCommand(
            `execute as @a[name=${this.name}] at @s run ${command}`,
        );
    }

    async hasTag(tag: string): Promise<boolean> {
        const result = await this.server.executeMinecraftCommand(`tag ${this.name} list`);
        return result?.statusMessage?.includes(`§a${tag}§r`) ?? false;
    }

    async getTags(): Promise<string[]> {
        const result = await this.server.executeMinecraftCommand(`tag ${this.name} list`);
        if (!result?.statusMessage) return [];
        const tagRegex = /§a([\w\d]+)§r/g;
        const tags: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = tagRegex.exec(result.statusMessage)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    }
    async getXp(): Promise<number> {
        const resonse = await this.server.executeMinecraftCommand(`xp 0 ${this.name}`);
        if (!resonse || resonse.statusCode !== 0 || !resonse.level) {
            return Number(0);
        }
        return Number(resonse.level);
    }

    async isPermissionCategoryEnabled(permissionCategory: string): Promise<boolean> {
        const command = `inputpermission query ${this.name} ${permissionCategory}`;
        const result = await this.server.executeMinecraftCommand(command);

        if (result && result.statusCode === 0 && result.statusMessage) {
            const regex = /:\s*(\d)\s*オン.*?(\d)\s*オフ/;
            const match = result.statusMessage.match(regex);
            if (match) {
                const [_, onValue, offValue] = match;
                if (onValue === '1') {
                    return true;
                } else if (offValue === '1') {
                    return false;
                }
            }
        }
        return false;
    }

    async setPermissionCategory(permissionCategory: string, isEnabled: boolean): Promise<void> {
        const state = isEnabled ? 'enabled' : 'disabled';
        const command = `inputpermission set ${this.name} ${permissionCategory} ${state}`;
        const result = await this.server.executeMinecraftCommand(command);

        if (!result || result.statusCode !== 0) {
            throw new Error(`Failed to set ${permissionCategory} permission for ${this.name}`);
        }
    }

    async getGameMode(): Promise<GameMode> {
        const gameModes: GameMode[] = ['survival', 'creative', 'adventure', 'spectator'];
        for (const gameMode of gameModes) {
            const command = `/testfor @a[name=${this.name},m=${gameMode}]`;
            const result = await this.server.executeMinecraftCommand(command);
            if (
                result &&
                result.statusCode === 0 &&
                result.statusMessage &&
                result.statusMessage.includes('が見つかりました')
            ) {
                return gameMode;
            }
        }
        return 'survival';
    }
}

export async function createPlayerObject(
    server: WsServer,
    playerName: string,
    world: World,
): Promise<Player | null> {
    if (world) {
        const isplayer = await world.isPlayer(playerName);
        if (!isplayer) {
            return null;
        }
    } else {
        return null;
    }

    const queryResult = await server.executeMinecraftCommand(`querytarget @a[name=${playerName}]`);
    const softData = await getData(playerName);

    if (
        queryResult === null ||
        softData === null ||
        queryResult.statusCode !== 0 ||
        !queryResult.details
    ) {
        return null;
    }

    let playerDataRaw: any;
    try {
        playerDataRaw = JSON.parse(queryResult.details.replace(/\\/g, ''))[0];
    } catch (error) {
        return null;
    }

    if (!playerDataRaw || !playerDataRaw.uniqueId) return null;
    const storedPlayerData = await server.loadPlayerData();
    const playerUUID = playerDataRaw.uniqueId;
    const playerIndex = Object.values(storedPlayerData).findIndex((p) => p.uuid === playerUUID);

    if (playerIndex !== -1) {
        storedPlayerData[playerIndex].position = {
            x: playerDataRaw.position.x,
            y: playerDataRaw.position.y - 2,
            z: playerDataRaw.position.z,
        };
    }

    if (storedPlayerData) {
        await server.savePlayerData(storedPlayerData);
    }

    return new PlayerImpl(
        playerName,
        playerDataRaw.uniqueId,
        playerDataRaw.id,
        playerDataRaw.dimension,
        softData?.ping ?? 0,
        softData?.maxbps ?? 0,
        {
            x: playerDataRaw.position.x,
            y: playerDataRaw.position.y - 2,
            z: playerDataRaw.position.z,
        },
        server,
        world,
    );
}
