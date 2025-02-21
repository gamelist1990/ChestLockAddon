import { EntityHurtAfterEvent, Player, Vector3 } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
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
        const maxReach = 8.5;  // Minecraft Bedrockの通常の最大リーチ
        const distanceToTarget = calculateDistance(attackingPlayer.location, attackedEntity.location);
        return { isDetected: distanceToTarget > maxReach, distance: distanceToTarget };
    }

    private detectAimbot(attackingPlayer: Player, attackedEntity: Player): { isDetected: boolean; accuracy?: number } {
        const now = Date.now();
        const lastRotation = this.playerDataManager.getData(attackingPlayer, "lastRotation") ?? { x: 0, y: 0 };

        // プレイヤーの視線ベクトルを計算（正規化済み）
        const viewDirection = attackingPlayer.getViewDirection();
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
        const aimAccuracyReadings = this.playerDataManager.getData(attackingPlayer, "aimAccuracyReadings") ?? [];

        aimAccuracyReadings.push({ accuracy: aimAccuracy, time: now, deltaTime: now - (aimAccuracyReadings[aimAccuracyReadings.length - 1]?.time ?? now) });
        this.playerDataManager.updateData(attackingPlayer, "aimAccuracyReadings", aimAccuracyReadings);


        // データが十分な数になるまで処理
        if (aimAccuracyReadings.length < 10) { // データ数を調整
            return { isDetected: false };
        }

        // 古いデータを削除 (例: 過去1秒間のデータのみ保持)
        const timeThreshold = now - 1000;  // 1秒前の閾値
        const filteredAimAccuracyReadings = aimAccuracyReadings.filter(reading => reading.time > timeThreshold);
        this.playerDataManager.updateData(attackingPlayer, "aimAccuracyReadings", filteredAimAccuracyReadings);


        // スムージング (移動平均)
        const smoothingWindow = 3; // 移動平均のウィンドウサイズ
        let smoothedAccuracy = 0;
        if (filteredAimAccuracyReadings.length >= smoothingWindow) {
            for (let i = filteredAimAccuracyReadings.length - smoothingWindow; i < filteredAimAccuracyReadings.length; i++) {
                smoothedAccuracy += filteredAimAccuracyReadings[i].accuracy;
            }
            smoothedAccuracy /= smoothingWindow;
        } else {
            smoothedAccuracy = aimAccuracy; // データが少ない場合は現在の値を使用
        }


        // デルタ時間の加重平均を計算（ラグ補正）
        let weightedSum = 0;
        let weightSum = 0;
        for (const reading of filteredAimAccuracyReadings) {
            const weight = 1 / (reading.deltaTime + 1); // 時間差が小さいほど重みを大きく
            weightedSum += reading.accuracy * weight;
            weightSum += weight;
        }
        const weightedAverageAccuracy = weightedSum / weightSum;

        // 最終的なエイムボット判定 (加重平均とスムージングを使用)
        const aimbotThreshold = 0.98; // 閾値を調整 (高精度)

        let aimbotTicks = this.playerDataManager.getData(attackingPlayer, "aimbotTicks") ?? 0;
        if (weightedAverageAccuracy > aimbotThreshold && smoothedAccuracy > aimbotThreshold) {
            aimbotTicks++;
            if (aimbotTicks >= 3) { // 連続して疑わしい
                this.playerDataManager.updateData(attackingPlayer, "aimbotTicks", 0)
                return { isDetected: true, accuracy: weightedAverageAccuracy }; // エイムボットと判断
            }
        }
        else {
            this.playerDataManager.updateData(attackingPlayer, "aimbotTicks", 0)
        }
        this.playerDataManager.updateData(attackingPlayer, "aimbotTicks", aimbotTicks);

        // 角度変化の計算（ラジアン）
        const currentRotation = attackingPlayer.getRotation();
        const deltaX = Math.abs(currentRotation.x - lastRotation.x);


        // 急激な視点変更を検出 (例: 180度ターン)
        if (deltaX > 170 && deltaX < 190) {
            aimbotTicks++;
            if (aimbotTicks >= 5) { // 連続して疑わしい
                this.playerDataManager.updateData(attackingPlayer, "aimbotTicks", 0)
                return { isDetected: true, accuracy: weightedAverageAccuracy };
            }
        }
        else {
            this.playerDataManager.updateData(attackingPlayer, "aimbotTicks", 0)
        }
        this.playerDataManager.updateData(attackingPlayer, "aimbotTicks", aimbotTicks);

        return { isDetected: false };
    }

    private detectThroughBlock(attackingPlayer: Player, attackedEntity: Player): boolean {
        //tickごとに評価
        // 高速化のため、距離が近い場合のみレイキャストを実行
        const distanceToEntity = calculateDistance(attackingPlayer.location, attackedEntity.location);
        if (distanceToEntity > 3.5) { // 妥当なリーチ範囲外ならチェックしない
            return false;
        }
        const raycastResult = attackingPlayer.getBlockFromViewDirection({ maxDistance: distanceToEntity + 1 });

        let throughBlockCount = this.playerDataManager.getData(attackingPlayer, "throughBlockCount") ?? 0;

        // 壁越し攻撃の判定
        // 1 tick だけの壁貫通はラグの可能性があるので、複数tick連続して検出された場合のみtrue
        if (raycastResult && raycastResult.block && raycastResult.block.location && distanceToEntity > calculateDistance(attackingPlayer.location, raycastResult.block.location)) {
            throughBlockCount++;
            if (throughBlockCount >= 4) { // 連続して壁越し攻撃を検出
                this.playerDataManager.updateData(attackingPlayer, "throughBlockCount", 0); // カウンターリセット
                return true; // 壁越し攻撃と判断
            }
        } else {
            // 連続していない場合はカウンターリセット
            this.playerDataManager.updateData(attackingPlayer, "throughBlockCount", 0);
        }
        this.playerDataManager.updateData(attackingPlayer, "throughBlockCount", throughBlockCount);

        return false;
    }

    private detectAttackFrequency(attackingPlayer: Player): { isDetected: boolean; variance?: number } {
        // 攻撃間隔のチェック
        const currentTime = Date.now();
        const attackFrequency = this.playerDataManager.getData(attackingPlayer, "attackFrequency") ?? [];
        attackFrequency.push(currentTime);
        if (attackFrequency.length > 10) {
            attackFrequency.shift();
        }
        this.playerDataManager.updateData(attackingPlayer, "attackFrequency", attackFrequency)

        if (attackFrequency.length >= 5) {
            const attackIntervals: number[] = [];
            for (let i = 1; i < attackFrequency.length; i++) {
                const interval = attackFrequency[i] - attackFrequency[i - 1];
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

    private detectSpeedAndAttack(attackingPlayer: Player): boolean {
        // 速度と攻撃の同時発生をチェック（Speed HackとKill Auraの併用を想定）
        const currentSpeed = this.calculateVectorLength(attackingPlayer.getVelocity());
        const currentTime = Date.now();
        const lastAttackTime = this.playerDataManager.getData(attackingPlayer, "lastAttackTime") ?? 0;
        // 攻撃後、短い時間内に高い速度が出ている場合、Speed Hack + Kill Auraを検出
        if (currentSpeed > 0.3 && (currentTime - lastAttackTime) < 200) { // 閾値調整
            this.playerDataManager.updateData(attackingPlayer, "lastAttackTime", currentTime)
            return true; // Speed HackとKill Auraの併用と判断
        }
        this.playerDataManager.updateData(attackingPlayer, "lastAttackTime", currentTime)
        return false;
    }

    public detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, getPlayerCPS: (player: Player) => number): { cheatType: string; value?: string | number } | null {
        const attackedEntity = event.hurtEntity as Player;
       

        // 攻撃対象、攻撃者自身、エンティティ攻撃以外の場合は処理をスキップ
        if (!attackedEntity || attackingPlayer === attackedEntity || !(event.damageSource.cause === 'entityAttack')) return null;

        // プレイヤーデータ取得/初期化
        if (!this.playerDataManager.has(attackingPlayer)) this.playerDataManager.initialize(attackingPlayer)


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
        const aimbotResult = this.detectAimbot(attackingPlayer, attackedEntity);
        if (aimbotResult.isDetected) {
            return { cheatType: 'Kill Aura (Aimbot)', value: aimbotResult.accuracy };
        }

        // 壁越し攻撃検出
        if (this.detectThroughBlock(attackingPlayer, attackedEntity)) {
            return { cheatType: 'Kill Aura (Through-Block)' };
        }

        // 攻撃頻度検出
        const attackFrequencyResult = this.detectAttackFrequency(attackingPlayer);
        if (attackFrequencyResult.isDetected) {
            return { cheatType: 'Kill Aura (Attack Interval Consistent)', value: attackFrequencyResult.variance };
        }

        // Speed HackとKill Auraの併用検出
        if (this.detectSpeedAndAttack(attackingPlayer)) {
            return { cheatType: 'Kill Aura (Speed and Attack)' };
        }

        // 過去の位置情報を保存（使用例は省略）
        const now = Date.now();
        const pastPositions = this.playerDataManager.getData(attackingPlayer, "pastPositions") ?? [];
        pastPositions.push({ location: attackingPlayer.location, time: now });
        if (pastPositions.length > 10) {
            pastPositions.shift();
        }
        this.playerDataManager.updateData(attackingPlayer, "pastPositions", pastPositions)
        // プレイヤーデータ更新
        this.playerDataManager.updateData(attackingPlayer, "lastRotation", attackingPlayer.getRotation());

        return null;
    }
}

export function detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, playerDataManager: PlayerDataManager, getPlayerCPS: (player: Player) => number): { cheatType: string; value?: string | number } | null {
    const detector = new KillAuraDetector(playerDataManager);
    return detector.detectKillAura(attackingPlayer, event, getPlayerCPS);
}