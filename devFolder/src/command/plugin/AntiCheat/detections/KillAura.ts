import { EntityHurtAfterEvent, Player, Vector3 } from '@minecraft/server';
import { PlayerDataManager, PlayerData } from '../PlayerData';
import { calculateDistance } from '../utils';


// Vector3 の長さを手動で計算する関数
function calculateVectorLength(vector: Vector3): number {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

export function detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, playerDataManager: PlayerDataManager, getPlayerCPS: (player: Player) => number): { cheatType: string } | null {
    const attackedEntity = event.hurtEntity as Player;
    if (!attackedEntity || attackingPlayer === attackedEntity || !(event.damageSource.cause === 'entityAttack')) return null;

    const data = playerDataManager.get(attackingPlayer) ?? {
        lastRotationY: 0,
        aimbotTicks: 0,
        throughBlockCount: 0,
        attackFrequency: [],
        pastPositions: [],
        lastAttackTime: 0,
        rotationChanges: [],
        rotationSpeedChanges: [],
    } as unknown as PlayerData;

    if (!data) return null;

    const now = Date.now();
    const cps = getPlayerCPS(attackingPlayer);
    if (cps >= 20) {
        return { cheatType: 'Kill Aura (CPS20+)' };
    }


    // Reach Check (Lag Compensation)
    const maxReach = 7;
    const pastPositions = data.pastPositions || [];

    // サーバー側のラグ補正（過去の位置データから最大距離を計算）
    let maxDistance = 0;
    for (const pastPosition of pastPositions) {
        const distance = calculateDistance(pastPosition.location, attackedEntity.location);
        maxDistance = Math.max(maxDistance, distance);
    }


    if (maxDistance > maxReach) {
        playerDataManager.update(attackingPlayer, { pastPositions: [] });
        return { cheatType: `Kill Aura (Reach|${maxReach})` };
    }


    // Aimbot Check
    const currentRotation = attackingPlayer.getRotation().y;
    const lastRotation = data.lastRotationY;
    const rotationDiff = Math.abs(currentRotation - lastRotation);

    // 回転速度の変化を記録
    const rotationChange = currentRotation - lastRotation;
    data.rotationChanges.push({ rotationChange, time: now });

    // 直近の数回の回転変化から回転速度の変化を計算
    if (data.rotationChanges.length > 2) {
        const diff1 = data.rotationChanges[data.rotationChanges.length - 1].rotationChange - data.rotationChanges[data.rotationChanges.length - 2].rotationChange;
        const diff2 = data.rotationChanges[data.rotationChanges.length - 2].rotationChange - data.rotationChanges[data.rotationChanges.length - 3].rotationChange;

        data.rotationSpeedChanges.push({ rotationSpeedChange: diff1 - diff2, time: now });
        if (data.rotationSpeedChanges.length > 4) {
            data.rotationSpeedChanges.shift();
        }
    }
    // 回転速度の平均値を計算して、急激な変化がないかを確認
    if (data.rotationSpeedChanges.length > 2) {
        const averageSpeedChange = data.rotationSpeedChanges.reduce((sum, obj) => sum + obj.rotationSpeedChange, 0) / data.rotationSpeedChanges.length;

        if (Math.abs(averageSpeedChange) > 50) {
            data.aimbotTicks++;
            if (data.aimbotTicks >= 3) {
                data.aimbotTicks = 0;
                playerDataManager.update(attackingPlayer, { lastRotationY: currentRotation, aimbotTicks: data.aimbotTicks, rotationChanges: data.rotationChanges, rotationSpeedChanges: data.rotationSpeedChanges });
                return { cheatType: 'Kill Aura (Aimbot)' };
            }
        }
    }
    if (rotationDiff > 170 && rotationDiff <= 190) {
        data.aimbotTicks++;
        if (data.aimbotTicks >= 3) {
            data.aimbotTicks = 0;
            playerDataManager.update(attackingPlayer, { lastRotationY: currentRotation, aimbotTicks: data.aimbotTicks, rotationChanges: data.rotationChanges, rotationSpeedChanges: data.rotationSpeedChanges });
            return { cheatType: 'Kill Aura (Aimbot)' };
        }
    } else {
        data.aimbotTicks = 0;
    }
    if (data.rotationChanges.length > 10) {
        data.rotationChanges.shift();
    }


    // Through-Block Check
    const distanceToEntity = calculateDistance(attackingPlayer.location, attackedEntity.location);
    const raycastResult = attackingPlayer.getBlockFromViewDirection({ maxDistance: distanceToEntity });
    if (raycastResult && raycastResult.block && raycastResult.block.location && distanceToEntity > calculateDistance(attackingPlayer.location, raycastResult.block.location)) {
        data.throughBlockCount++;
        if (data.throughBlockCount > 1) {
            data.throughBlockCount = 0;
            playerDataManager.update(attackingPlayer, { throughBlockCount: data.throughBlockCount });
            return { cheatType: 'Kill Aura (Through-Block)' };
        }
    } else {
        data.throughBlockCount = 0;
    }


    // Attack Frequency and Consistency
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

        //攻撃間隔の分散を計算
        const averageInterval = attackIntervals.reduce((sum, interval) => sum + interval, 0) / attackIntervals.length;
        const variance = attackIntervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / attackIntervals.length;

        if (variance < 15) {
            playerDataManager.update(attackingPlayer, { attackFrequency: data.attackFrequency });
            return { cheatType: 'Kill Aura (Attack Interval Consistent)' };
        }
    }

    // 移動速度と攻撃速度の関連性
    const currentSpeed = calculateVectorLength(attackingPlayer.getVelocity());
    if (currentSpeed > 0.1 && (currentTime - data.lastAttackTime) < 100) {
        playerDataManager.update(attackingPlayer, { lastAttackTime: currentTime });
        return { cheatType: 'Kill Aura (Speed and Attack)' };
    }


    // 過去のプレイヤー位置を記録
    data.pastPositions.push({ location: attackingPlayer.location, time: now });
    if (data.pastPositions.length > 10) {
        data.pastPositions.shift(); // 古い位置情報を削除
    }

    playerDataManager.update(attackingPlayer, {
        lastRotationY: currentRotation,
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