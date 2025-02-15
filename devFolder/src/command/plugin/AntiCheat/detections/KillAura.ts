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

    private detectReach(attackingPlayer: Player, attackedEntity: Player): { isDetected: boolean; distance: number } {
        const maxReach = 8.2; // 妥当なリーチ範囲に調整
        const distanceToTarget = calculateDistance(attackingPlayer.location, attackedEntity.location);
        return { isDetected: distanceToTarget > maxReach, distance: distanceToTarget };
    }

    private detectAimbot(data: PlayerData, currentRotation: Vector2, attackingPlayer: Player, attackedEntity: Player): { isDetected: boolean; accuracy?: number } {
        const now = Date.now();
        const lastRotation = data.lastRotation ?? { x: 0, y: 0 };

        // プレイヤーの視線ベクトルを計算（正規化済み）
        const viewDirection = attackingPlayer.getViewDirection();

        // 攻撃対象へのベクトルを計算（高さ補正、正規化）
        let vectorToTarget = {
            x: attackedEntity.location.x - attackingPlayer.location.x,
            y: (attackedEntity.location.y + attackedEntity.getHeadLocation().y) / 2 - (attackingPlayer.location.y + attackingPlayer.getHeadLocation().y) / 2, // 中間の高さ
            z: attackedEntity.location.z - attackingPlayer.location.z,
        };
        const length = Math.sqrt(vectorToTarget.x * vectorToTarget.x + vectorToTarget.y * vectorToTarget.y + vectorToTarget.z * vectorToTarget.z);
        vectorToTarget = {
            x: vectorToTarget.x / length,
            y: vectorToTarget.y / length,
            z: vectorToTarget.z / length,
        };

        // 視線ベクトルとターゲットへのベクトルの内積（類似度）を計算
        const dotProduct = viewDirection.x * vectorToTarget.x + viewDirection.y * vectorToTarget.y + viewDirection.z * vectorToTarget.z;
        const aimAccuracy = dotProduct;

        // 過去のエイム精度と時間差を保存
        // aimAccuracyReadings が undefined の場合は空の配列で初期化
        if (!data.aimAccuracyReadings) {
            data.aimAccuracyReadings = [];
        }
        data.aimAccuracyReadings.push({ accuracy: aimAccuracy, time: now, deltaTime: now - (data.aimAccuracyReadings[data.aimAccuracyReadings.length - 1]?.time ?? now) });

        // データが十分な数になるまで処理
        if (data.aimAccuracyReadings.length < 10) { // データ数を調整
            return { isDetected: false };
        }

        // 古いデータを削除 (例: 過去1秒間のデータのみ保持)
        const timeThreshold = now - 1000;  // 1秒前の閾値
        data.aimAccuracyReadings = data.aimAccuracyReadings.filter(reading => reading.time > timeThreshold);


        // スムージング (移動平均)
        const smoothingWindow = 3; // 移動平均のウィンドウサイズ
        let smoothedAccuracy = 0;
        if (data.aimAccuracyReadings.length >= smoothingWindow) {
            for (let i = data.aimAccuracyReadings.length - smoothingWindow; i < data.aimAccuracyReadings.length; i++) {
                smoothedAccuracy += data.aimAccuracyReadings[i].accuracy;
            }
            smoothedAccuracy /= smoothingWindow;
        } else {
            smoothedAccuracy = aimAccuracy; // データが少ない場合は現在の値を使用
        }


        // デルタ時間の加重平均を計算（ラグ補正）
        let weightedSum = 0;
        let weightSum = 0;
        for (const reading of data.aimAccuracyReadings) {
            const weight = 1 / (reading.deltaTime + 1); // 時間差が小さいほど重みを大きく
            weightedSum += reading.accuracy * weight;
            weightSum += weight;
        }
        const weightedAverageAccuracy = weightedSum / weightSum;

        // 最終的なエイムボット判定 (加重平均とスムージングを使用)
        const aimbotThreshold = 0.98; // 閾値を調整 (高精度)

        if (weightedAverageAccuracy > aimbotThreshold && smoothedAccuracy > aimbotThreshold) {
            data.aimbotTicks++;
            if (data.aimbotTicks >= 3) { // 連続して疑わしい
                data.aimbotTicks = 0;
                return { isDetected: true, accuracy: weightedAverageAccuracy }; // エイムボットと判断
            }
        }
        else {
            data.aimbotTicks = 0;
        }

        // 角度変化の計算（ラジアン）
        const deltaX = Math.abs(currentRotation.x - lastRotation.x);


        // 急激な視点変更を検出 (例: 180度ターン)
        if (deltaX > 170 && deltaX < 190) {
            data.aimbotTicks++;
            if (data.aimbotTicks >= 5) { // 連続して疑わしい
                data.aimbotTicks = 0;
                return { isDetected: true, accuracy: weightedAverageAccuracy };
            }
        }
        else {
            data.aimbotTicks = 0
        }

        return { isDetected: false };
    }

    private detectThroughBlock(attackingPlayer: Player, attackedEntity: Player, data: PlayerData): boolean {
        //tickごとに評価
        // 高速化のため、距離が近い場合のみレイキャストを実行
        const distanceToEntity = calculateDistance(attackingPlayer.location, attackedEntity.location);
        if (distanceToEntity > 3.5) { // 妥当なリーチ範囲外ならチェックしない
            return false;
        }
        const raycastResult = attackingPlayer.getBlockFromViewDirection({ maxDistance: distanceToEntity + 1 });

        // 壁越し攻撃の判定
        // 1 tick だけの壁貫通はラグの可能性があるので、複数tick連続して検出された場合のみtrue
        if (raycastResult && raycastResult.block && raycastResult.block.location && distanceToEntity > calculateDistance(attackingPlayer.location, raycastResult.block.location)) {
            data.throughBlockCount++;
            if (data.throughBlockCount >= 4) { // 連続して壁越し攻撃を検出
                data.throughBlockCount = 0; // カウンターリセット
                return true; // 壁越し攻撃と判断
            }
        } else {
            // 連続していない場合はカウンターリセット
            data.throughBlockCount = 0;
        }
        return false;
    }

    private detectAttackFrequency(data: PlayerData): { isDetected: boolean; variance?: number } {
        // 攻撃間隔のチェック
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

            // 分散が非常に小さい（攻撃間隔が一定）場合に検知
            if (variance < 10) { // 閾値を調整
                return { isDetected: true, variance: variance }; // 不自然な攻撃間隔と判断
            }
        }

        return { isDetected: false };
    }

    private detectSpeedAndAttack(attackingPlayer: Player, data: PlayerData): boolean {
        // 速度と攻撃の同時発生をチェック（Speed HackとKill Auraの併用を想定）
        const currentSpeed = this.calculateVectorLength(attackingPlayer.getVelocity());
        const currentTime = Date.now();

        // 攻撃後、短い時間内に高い速度が出ている場合、Speed Hack + Kill Auraを検出
        if (currentSpeed > 0.3 && (currentTime - data.lastAttackTime) < 200) { // 閾値調整
            data.lastAttackTime = currentTime; // 最終攻撃時間を更新（誤検知防止）
            return true; // Speed HackとKill Auraの併用と判断
        }

        return false;
    }

    public detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, getPlayerCPS: (player: Player) => number): { cheatType: string; value?: string | number } | null {
        const attackedEntity = event.hurtEntity as Player;

        // 攻撃対象、攻撃者自身、エンティティ攻撃以外の場合は処理をスキップ
        if (!attackedEntity || attackingPlayer === attackedEntity || !(event.damageSource.cause === 'entityAttack')) return null;

        // プレイヤーデータ取得/初期化
        const data = this.playerDataManager.get(attackingPlayer) ?? (this.playerDataManager.initialize(attackingPlayer), this.playerDataManager.get(attackingPlayer)) ?? null;
        if (!data) return null;

        // CPSが高すぎる場合は即時検出
        const cps = getPlayerCPS(attackingPlayer);
        if (cps >= 20) { // CPS閾値調整
            return { cheatType: 'Kill Aura (CPS)', value: cps };
        }
        // Reach検出
        const reachResult = this.detectReach(attackingPlayer, attackedEntity);
        if (reachResult.isDetected) {
            return { cheatType: 'Kill Aura (Reach)', value: reachResult.distance };
        }

        // Aimbot検出
        const aimbotResult = this.detectAimbot(data, attackingPlayer.getRotation(), attackingPlayer, attackedEntity);
        if (aimbotResult.isDetected) {
            return { cheatType: 'Kill Aura (Aimbot)', value: aimbotResult.accuracy };
        }

        // 壁越し攻撃検出
        if (this.detectThroughBlock(attackingPlayer, attackedEntity, data)) {
            return { cheatType: 'Kill Aura (Through-Block)' };
        }

        // 攻撃頻度検出
        const attackFrequencyResult = this.detectAttackFrequency(data);
        if (attackFrequencyResult.isDetected) {
            return { cheatType: 'Kill Aura (Attack Interval Consistent)', value: attackFrequencyResult.variance };
        }

        // Speed HackとKill Auraの併用検出
        if (this.detectSpeedAndAttack(attackingPlayer, data)) {
            return { cheatType: 'Kill Aura (Speed and Attack)' };
        }

        // 過去の位置情報を保存（使用例は省略）
        const now = Date.now();
        data.pastPositions.push({ location: attackingPlayer.location, time: now });
        if (data.pastPositions.length > 10) {
            data.pastPositions.shift();
        }

        // プレイヤーデータ更新
        this.playerDataManager.update(attackingPlayer, {
            ...data, // スプレッド構文で既存データを展開
            lastRotation: attackingPlayer.getRotation(), // lastRotationを更新
        });

        return null;
    }
}

export function detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, playerDataManager: PlayerDataManager, getPlayerCPS: (player: Player) => number): { cheatType: string; value?: string | number } | null {
    const detector = new KillAuraDetector(playerDataManager);
    return detector.detectKillAura(attackingPlayer, event, getPlayerCPS);
}