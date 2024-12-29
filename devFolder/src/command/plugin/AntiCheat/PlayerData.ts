import { Player, Vector3, GameMode, Vector2 } from '@minecraft/server';

// 速度検出用のインターフェース
interface SpeedData {
    lastSpeedCheck: number;
    speedViolationCount: number;
    lastPosition: Vector3 | null;
    violationCount: number;
}

// プレイヤーの回転変化を記録するインターフェース
interface RotationChange {
    rotationChangeX: number;
    rotationChangeY: number;
    time: number;
}

// プレイヤーの回転速度変化を記録するインターフェース
interface RotationSpeedChange {
    rotationSpeedChangeX: number;
    rotationSpeedChangeY: number;
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
    lastRotation: Vector2 | null;
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
    private playerDataMap: Map<string, PlayerData> = new Map();

    initialize(player: Player): void {
        this.playerDataMap.set(player.name, {
            // Speed Module
            speedData: {
                lastSpeedCheck: 0,
                speedViolationCount: 0,
                lastPosition:null,
                violationCount:0,
            },
            // KillAura Module
            lastRotation: null,
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
        });
    }

    get(player: Player): PlayerData | undefined {
        return this.playerDataMap.get(player.name);
    }

    update(player: Player, newData: Partial<PlayerData>): void {
        const existingData = this.playerDataMap.get(player.name) || {
            // Speed Module
            speedData: {
                lastSpeedCheck: 0,
                speedViolationCount: 0,
                lastPosition:null,
                violationCount:0,
            },
            // KillAura Module
            lastRotation: null,
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
        const updatedData = { ...existingData, ...newData };
        this.playerDataMap.set(player.name, updatedData);
    }

    reset(player: Player): void {
        this.playerDataMap.delete(player.name);
    }

    remove(player: Player): void {
        this.playerDataMap.delete(player.name);
    }

    has(player: Player): boolean {
        return this.playerDataMap.has(player.name);
    }
}