import { EntityHurtAfterEvent, Player, Vector2, Vector3 } from '@minecraft/server';
import { PlayerDataManager, PlayerData } from '../PlayerData';
import { calculateDistance } from '../utils';

class KillAuraDetector {
    private playerDataManager: PlayerDataManager;

    constructor(playerDataManager: PlayerDataManager) {
        this.playerDataManager = playerDataManager;
    }

    private calculateVectorLength(vector: Vector3): number {
        return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    }

    private detectReach(attackingPlayer: Player, attackedEntity: Player): boolean {
        const maxReach = 7;
        const distanceToTarget = calculateDistance(attackingPlayer.location, attackedEntity.location);
        return distanceToTarget > maxReach;
    }

    private detectAimbot(data: PlayerData, currentRotation: Vector2): boolean {
        const now = Date.now();
        const lastRotation = data.lastRotation ?? { x: 0, y: 0 };
        const rotationDiffX = Math.abs(currentRotation.x - lastRotation.x);
        const rotationDiffY = Math.abs(currentRotation.y - lastRotation.y);

        const rotationChangeX = currentRotation.x - lastRotation.x;
        const rotationChangeY = currentRotation.y - lastRotation.y;

        data.rotationChanges.push({ rotationChangeX, rotationChangeY, time: now });

        if (data.rotationChanges.length > 2) {
            const diffX1 = data.rotationChanges[data.rotationChanges.length - 1].rotationChangeX - data.rotationChanges[data.rotationChanges.length - 2].rotationChangeX;
            const diffX2 = data.rotationChanges[data.rotationChanges.length - 2].rotationChangeX - data.rotationChanges[data.rotationChanges.length - 3].rotationChangeX;
            const diffY1 = data.rotationChanges[data.rotationChanges.length - 1].rotationChangeY - data.rotationChanges[data.rotationChanges.length - 2].rotationChangeY;
            const diffY2 = data.rotationChanges[data.rotationChanges.length - 2].rotationChangeY - data.rotationChanges[data.rotationChanges.length - 3].rotationChangeY;

            data.rotationSpeedChanges.push({ rotationSpeedChangeX: diffX1 - diffX2, rotationSpeedChangeY: diffY1 - diffY2, time: now });
            if (data.rotationSpeedChanges.length > 4) {
                data.rotationSpeedChanges.shift();
            }
        }

        if (data.rotationSpeedChanges.length > 2) {
            const averageSpeedChangeX = data.rotationSpeedChanges.reduce((sum, obj) => sum + obj.rotationSpeedChangeX, 0) / data.rotationSpeedChanges.length;
            const averageSpeedChangeY = data.rotationSpeedChanges.reduce((sum, obj) => sum + obj.rotationSpeedChangeY, 0) / data.rotationSpeedChanges.length;

            if (Math.abs(averageSpeedChangeX) > 50 || Math.abs(averageSpeedChangeY) > 50) {
                data.aimbotTicks++;
                if (data.aimbotTicks >= 3) {
                    data.aimbotTicks = 0;
                    return true;
                }
            }
        }

        if ((rotationDiffX > 170 && rotationDiffX <= 190) || (rotationDiffY > 170 && rotationDiffY <= 190)) {
            data.aimbotTicks++;
            if (data.aimbotTicks >= 3) {
                data.aimbotTicks = 0;
                return true;
            }
        } else {
            data.aimbotTicks = 0;
        }

        if (data.rotationChanges.length > 10) {
            data.rotationChanges.shift();
        }

        return false;
    }

    private detectThroughBlock(attackingPlayer: Player, attackedEntity: Player, data: PlayerData): boolean {
        const distanceToEntity = calculateDistance(attackingPlayer.location, attackedEntity.location);
        const raycastResult = attackingPlayer.getBlockFromViewDirection({ maxDistance: distanceToEntity });
        if (raycastResult && raycastResult.block && raycastResult.block.location && distanceToEntity > calculateDistance(attackingPlayer.location, raycastResult.block.location)) {
            data.throughBlockCount++;
            if (data.throughBlockCount > 1) {
                data.throughBlockCount = 0;
                return true;
            }
        } else {
            data.throughBlockCount = 0;
        }
        return false;
    }

    private detectAttackFrequency(data: PlayerData): boolean {
        const currentTime = Date.now();
        data.attackFrequency.push(currentTime);
        if (data.attackFrequency.length > 10) {
            data.attackFrequency.shift();
        }
        if (data.attackFrequency.length >= 5) {
            const attackIntervals: number[] = [];
            for (let i = 1; i < data.attackFrequency.length; i++) {
                const interval = data.attackFrequency[i] - data.attackFrequency[i - 1];
                attackIntervals.push(interval);
            }

            const averageInterval = attackIntervals.reduce((sum, interval) => sum + interval, 0) / attackIntervals.length;
            const variance = attackIntervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / attackIntervals.length;

            if (variance < 15) {
                return true;
            }
        }
        return false;
    }

    private detectSpeedAndAttack(attackingPlayer: Player, data: PlayerData): boolean {
        const currentSpeed = this.calculateVectorLength(attackingPlayer.getVelocity());
        const currentTime = Date.now();
        if (currentSpeed > 0.1 && (currentTime - data.lastAttackTime) < 100) {
            data.lastAttackTime = currentTime;
            return true;
        }
        return false;
    }

    public detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, getPlayerCPS: (player: Player) => number): { cheatType: string } | null {
        const attackedEntity = event.hurtEntity as Player;
        if (!attackedEntity || attackingPlayer === attackedEntity || !(event.damageSource.cause === 'entityAttack')) return null;

        const data = this.playerDataManager.get(attackingPlayer) ?? {
            lastRotation: { x: 0, y: 0 },
            aimbotTicks: 0,
            throughBlockCount: 0,
            attackFrequency: [],
            pastPositions: [],
            lastAttackTime: 0,
            rotationChanges: [],
            rotationSpeedChanges: [],
        } as unknown as PlayerData;

        if (!data) return null;

        const currentRotation: Vector2 = attackingPlayer.getRotation();
        const now = Date.now();

        const cps = getPlayerCPS(attackingPlayer);
        if (cps >= 20) {
            return { cheatType: 'Kill Aura (CPS20+)' };
        }

        if (this.detectReach(attackingPlayer, attackedEntity)) {
            return { cheatType: 'Kill Aura (Reach)' };
        }

        if (this.detectAimbot(data, currentRotation)) {
            return { cheatType: 'Kill Aura (Aimbot)' };
        }

        if (this.detectThroughBlock(attackingPlayer, attackedEntity, data)) {
            return { cheatType: 'Kill Aura (Through-Block)' };
        }

        if (this.detectAttackFrequency(data)) {
            return { cheatType: 'Kill Aura (Attack Interval Consistent)' };
        }

        if (this.detectSpeedAndAttack(attackingPlayer, data)) {
            return { cheatType: 'Kill Aura (Speed and Attack)' };
        }

        data.pastPositions.push({ location: attackingPlayer.location, time: now });
        if (data.pastPositions.length > 10) {
            data.pastPositions.shift();
        }

        this.playerDataManager.update(attackingPlayer, {
            lastRotation: currentRotation,
            aimbotTicks: data.aimbotTicks,
            throughBlockCount: data.throughBlockCount,
            attackFrequency: data.attackFrequency,
            pastPositions: data.pastPositions,
            lastAttackTime: data.lastAttackTime,
            rotationChanges: data.rotationChanges,
            rotationSpeedChanges: data.rotationSpeedChanges,
        });

        return null;
    }
}

export function detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, playerDataManager: PlayerDataManager, getPlayerCPS: (player: Player) => number): { cheatType: string } | null {
    const detector = new KillAuraDetector(playerDataManager);
    return detector.detectKillAura(attackingPlayer, event, getPlayerCPS);
}