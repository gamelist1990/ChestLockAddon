import { EntityHurtAfterEvent, Player, Vector2, Vector3 } from '@minecraft/server';
import { PlayerDataManager, PlayerData } from '../PlayerData';
import { calculateDistance } from '../utils';

// Vector3 の長さを手動で計算する関数
function calculateVectorLength(vector: Vector3): number {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

// 2点間のベクトルを計算する関数
function calculateVector(from: Vector3, to: Vector3): Vector3 {
    return {
        x: to.x - from.x,
        y: to.y - from.y,
        z: to.z - from.z,
    };
}

// ベクトルを加算する関数
function addVector(vec1: Vector3, vec2: Vector3): Vector3 {
    return {
        x: vec1.x + vec2.x,
        y: vec1.y + vec2.y,
        z: vec1.z + vec2.z,
    }
}


export function detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, playerDataManager: PlayerDataManager, getPlayerCPS: (player: Player) => number): { cheatType: string } | null {
    const attackedEntity = event.hurtEntity as Player;
    if (!attackedEntity || attackingPlayer === attackedEntity || !(event.damageSource.cause === 'entityAttack')) return null;

    const data = playerDataManager.get(attackingPlayer) ?? {
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

    const now = Date.now();
    //クッソ簡単なCPS20超えたら検知するだけのやつ
    const cps = getPlayerCPS(attackingPlayer);
    if (cps >= 20) {
        return { cheatType: 'Kill Aura (CPS20+)' };
    }


    // Reach Check (Lag Compensation)
    //通常のリーチは3.4block(動かない場合)
    //ラグで計算がずれる事を想定して6ぐらいにしとく
    const maxReach = 6;
    const pastPositions = data.pastPositions || [];

    // 移動ベクトルの算出と予測位置の計算
    let predictedPosition = attackingPlayer.location;
    if (pastPositions.length > 1) {
        const lastPosition = pastPositions[pastPositions.length - 1].location;
        const secondLastPosition = pastPositions[pastPositions.length - 2].location;
        const moveVector = calculateVector(secondLastPosition, lastPosition);
        predictedPosition = addVector(lastPosition, moveVector)
    }
    // 予測位置から攻撃対象までの距離を計算
    const distanceToTarget = calculateDistance(predictedPosition, attackedEntity.location)
    if (distanceToTarget > maxReach) {
        playerDataManager.update(attackingPlayer, { pastPositions: [] });
        return { cheatType: `Kill Aura (Reach|${maxReach})` };
    }


    // Aimbot Check
    const currentRotation: Vector2 = attackingPlayer.getRotation();
    const lastRotation = data.lastRotation ?? { x: 0, y: 0 };
    const rotationDiffX = Math.abs(currentRotation.x - lastRotation.x);
    const rotationDiffY = Math.abs(currentRotation.y - lastRotation.y);


    // 回転速度の変化を記録
    const rotationChangeX = currentRotation.x - lastRotation.x;
    const rotationChangeY = currentRotation.y - lastRotation.y;

    data.rotationChanges.push({ rotationChangeX, rotationChangeY, time: now });


    // 直近の数回の回転変化から回転速度の変化を計算
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


    // 回転速度の平均値を計算して、急激な変化がないかを確認
    if (data.rotationSpeedChanges.length > 2) {
        const averageSpeedChangeX = data.rotationSpeedChanges.reduce((sum, obj) => sum + obj.rotationSpeedChangeX, 0) / data.rotationSpeedChanges.length;
        const averageSpeedChangeY = data.rotationSpeedChanges.reduce((sum, obj) => sum + obj.rotationSpeedChangeY, 0) / data.rotationSpeedChanges.length;


        if (Math.abs(averageSpeedChangeX) > 50 || Math.abs(averageSpeedChangeY) > 50) {
            data.aimbotTicks++;
            if (data.aimbotTicks >= 3) {
                data.aimbotTicks = 0;
                playerDataManager.update(attackingPlayer, { lastRotation: currentRotation, aimbotTicks: data.aimbotTicks, rotationChanges: data.rotationChanges, rotationSpeedChanges: data.rotationSpeedChanges });
                return { cheatType: 'Kill Aura (Aimbot)' };
            }
        }
    }
    if ((rotationDiffX > 170 && rotationDiffX <= 190) || (rotationDiffY > 170 && rotationDiffY <= 190)) {
        data.aimbotTicks++;
        if (data.aimbotTicks >= 3) {
            data.aimbotTicks = 0;
            playerDataManager.update(attackingPlayer, { lastRotation: currentRotation, aimbotTicks: data.aimbotTicks, rotationChanges: data.rotationChanges, rotationSpeedChanges: data.rotationSpeedChanges });
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