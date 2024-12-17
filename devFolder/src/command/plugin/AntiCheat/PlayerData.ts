import { Player, Vector3, GameMode } from '@minecraft/server';

// 速度検出用のインターフェース
interface SpeedData {
    lastSpeedCheck: number;
    speedViolationCount: number;
}

// プレイヤーの回転変化を記録するインターフェース
interface RotationChange {
    rotationChange: number;
    time: number;
}

// プレイヤーの回転速度変化を記録するインターフェース
interface RotationSpeedChange {
    rotationSpeedChange: number;
    time: number;
}

// 過去の位置情報を記録するインターフェース
interface PastPosition {
    location: Vector3;
    time: number;
}
// X線透視(Xray)検出用データ
interface XrayData {
    suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number } };
}

// プレイヤーデータ
export interface PlayerData {
    speedData: SpeedData;
    isTeleporting: boolean;
    recentlyUsedEnderPearl: boolean;
    lastPosition: Vector3 | null;
    lastTime: number;
    mutedUntil?: number;
    lastMessages: string[];
    lastMessageTimes: number[];
    badWordCount: number;
    lastRotationY: number;
    aimbotTicks: number;
    throughBlockCount: number;
    attackFrequency: number[];
    pastPositions: PastPosition[];
    lastAttackTime: number;
    rotationChanges: RotationChange[];
    rotationSpeedChanges: RotationSpeedChange[];
    xrayData: XrayData;
    lastGroundY: number;
    airJumpDetected: boolean;
    jumpStartTime: number;
    positionHistory: Vector3[];
    isJumping: boolean;
    jumpCounter: number;
    lastOnGroundTime: number;
    violationCount: number;
    originalGamemode: GameMode;
    isFrozen: boolean;
    freezeStartTime: number;
    enderPearlInterval: number;
}

export class PlayerDataManager {
    private playerData: { [playerId: string]: PlayerData } = {};

    initialize(player: Player): void {
        this.playerData[player.id] = {
            // Speed Module
            speedData: {
                lastSpeedCheck: 0,
                speedViolationCount: 0,
            },
            // KillAura Module
            lastRotationY: 0,
            aimbotTicks: 0,
            throughBlockCount: 0,
            attackFrequency: [],
            pastPositions: [],
            lastAttackTime: 0,
            rotationChanges: [],
            rotationSpeedChanges: [],
            // Xray Module
            xrayData: {
                suspiciousBlocks: {},
            },
            // AirJump Module
            lastGroundY: 0,
            airJumpDetected: false,
            jumpStartTime: 0,
            positionHistory: [player.location],
            isJumping: false,
            jumpCounter: 0,
            lastOnGroundTime: 0,
            // Spam Module
            mutedUntil: 0,
            lastMessages: [],
            lastMessageTimes: [],
            badWordCount: 0,
            // Common
            isTeleporting: false,
            recentlyUsedEnderPearl: false,
            lastPosition: player.location,
            lastTime: Date.now(),
            violationCount: 0,
            originalGamemode: GameMode.survival,
            isFrozen: false,
            freezeStartTime: 0,
            enderPearlInterval: 0,
        };
    }

    getPlayerData(): { [playerId: string]: PlayerData } {
        return this.playerData;
    }

    get(player: Player): PlayerData | undefined {
        return this.playerData[player.id];
    }

    update(player: Player, newData: Partial<PlayerData>): void {
        const data = this.get(player);
        if (data) {
            Object.assign(data, newData);
        }
    }

    reset(player: Player): void {
        const data = this.get(player);
        if (data) {
            data.positionHistory = [player.location];
            data.lastTime = Date.now();
        }
    }

    remove(player: Player): void {
        delete this.playerData[player.id];
    }

    has(player: Player): boolean {
        return this.playerData[player.id] !== undefined;
    }
}