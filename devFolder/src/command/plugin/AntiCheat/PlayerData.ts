//AntiCheat/PlayerData.ts
import { Player, Vector3, GameMode } from '@minecraft/server';

interface XrayData {
    suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number } };
}


interface PlayerData {
    lastGroundY: number;
    originalGamemode: GameMode;
    lastFallDistance: number;
    airJumpDetected: boolean;
    jumpStartTime: number;
    positionHistory: Vector3[];
    lastTime: number;
    violationCount: number;
    lastBlinkCheck: number;
    isTeleporting: boolean;
    lastTeleportTime: number;
    isFrozen: boolean;
    freezeStartTime: number;
    isJumping: boolean;
    jumpCounter: number;
    recentlyUsedEnderPearl: boolean;
    enderPearlInterval: any;
    lastPosition: Vector3 | null;
    xrayData: XrayData;
    lastSpeedCheck: number;
    speedViolationCount: number;
    lastRotationY: number;
    boundaryCenter: Vector3;
    boundaryRadius: number;
    lastDamageTime: number | null;
    lastBreakBlockTime: number | null;
    beingHit: boolean;
    lastAttackTime: number;
    attackFrequency: number[];
    lastAttackedEntity: any | null;
    aimbotTicks: number;
    blinkCount: number;
    throughBlockHits: { [targetId: string]: number };
    flyHackCount: number;
    lastVelocity: { vertical: number; horizontal: number } | null;
    lastAttackedEntities: any[];
    lastMessages: string[];
    lastMessageTimes: number[];
    mutedUntil?: number;
    lastOnGroundTime: number;
    badWordCount: Number;
    throughBlockCount: number;
}

export class PlayerDataManager {
    private playerData: { [playerId: string]: PlayerData } = {};

    initialize(player: Player): void {
        this.playerData[player.id] = {
            lastGroundY: 0,
            originalGamemode: GameMode.survival,
            lastFallDistance: 0,
            positionHistory: [player.location],
            lastTime: Date.now(),
            violationCount: 0,
            isTeleporting: false,
            lastBlinkCheck: 0,
            lastTeleportTime: 0,
            jumpStartTime: 0,
            lastSpeedCheck: 0,
            speedViolationCount: 0,
            isFrozen: false,
            airJumpDetected: false,
            freezeStartTime: 0,
            isJumping: false,
            jumpCounter: 0,
            enderPearlInterval: null,
            recentlyUsedEnderPearl: false,
            lastRotationY: 0,
            boundaryCenter: player.location,
            boundaryRadius: 10,
            beingHit: false,
            xrayData: {
                suspiciousBlocks: {},
            },
            lastDamageTime: null,
            lastBreakBlockTime: null,

            lastAttackTime: 0,
            blinkCount: 0,
            attackFrequency: [],
            lastAttackedEntity: null,
            aimbotTicks: 0,
            throughBlockHits: {},
            flyHackCount: 0,
            lastAttackedEntities: [],
            lastMessages: [],
            lastVelocity: {
                vertical: 0,
                horizontal: 0,
            },
            lastMessageTimes: [],
            mutedUntil: 0,
            lastOnGroundTime: 0,
            lastPosition: player.location,
            badWordCount: 0,
            throughBlockCount: 0,
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
            data.lastTeleportTime = 0;
        }
    }

    remove(player: Player): void {
        delete this.playerData[player.id];
    }

    has(player: Player): boolean {
        return this.playerData[player.id] !== undefined;
    }
}