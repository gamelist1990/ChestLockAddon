import { Player, Vector3 } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { hasEffect } from '../utils';
import { getGamemode } from '../../../../Modules/Util';

const checkInterval = 100; // チェック間隔を短縮 (100ms)
const violationThreshold = 8; // 違反閾値を調整

// 速度計算を水平方向と垂直方向に分離
function calculateHorizontalSpeed(prevPos: Vector3, currentPos: Vector3, deltaTime: number): number {
    const dx = currentPos.x - prevPos.x;
    const dz = currentPos.z - prevPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance / (deltaTime / 1000);
}

function calculateVerticalSpeed(prevPos: Vector3, currentPos: Vector3, deltaTime: number): number {
    const dy = currentPos.y - prevPos.y;
    return Math.abs(dy) / (deltaTime / 1000);
}
// プレイヤーの状態を考慮した最大許容速度を計算
function getMaxAllowedSpeed(player: Player, horizontal: boolean): number {
    let baseSpeed = 4.3; // 通常の歩行速度 (m/s)

    if (player.isSprinting) {
        baseSpeed *= 1.3; // ダッシュ時の速度倍率
    }

    if (hasEffect(player, "speed", 3)) {
        const amplifier = player.getEffect("speed")?.amplifier ?? 0
        baseSpeed *= (1 + (0.2 * (amplifier + 1)))
    }

    // 水平方向と垂直方向で異なる係数を適用
    const speedMultiplier = horizontal ? 1.15 : 2.5; // 水平方向は緩め、垂直方向は厳しめ

    let maxSpeed = baseSpeed * speedMultiplier;


    return maxSpeed;
}

class SpeedDetector {
    private playerDataManager: PlayerDataManager;

    constructor(playerDataManager: PlayerDataManager) {
        this.playerDataManager = playerDataManager;
    }

    public detectSpeed(player: Player): { cheatType: string; horizontalSpeed?: number; verticalSpeed?: number } | null {
        // データ取得と初期化
        if (!this.playerDataManager.has(player)) this.playerDataManager.initialize(player);
        const lastPosition = this.playerDataManager.getData(player, "lastPosition");
        const lastSpeedCheck = this.playerDataManager.getData(player, "lastSpeedCheck") ?? 0;
        let horizontalViolationCount = this.playerDataManager.getData(player, "horizontalViolationCount") ?? 0;
        let verticalViolationCount = this.playerDataManager.getData(player, "verticalViolationCount") ?? 0;


        if (
            this.playerDataManager.getData(player, "isTeleporting") ||
            player.isGliding ||
            player.isInWater ||
            player.isFalling ||
            hasEffect(player, "speed", 3) || // スピード効果は getMaxAllowedSpeed で考慮
            hasEffect(player, "jump_boost", 3) || // ジャンプブーストは垂直速度で考慮
            hasEffect(player, "levitation", 1) ||
            hasEffect(player, "slow_falling", 1) ||
            player.isFlying ||
            getGamemode(player.name) === 1 || // クリエイティブ
            getGamemode(player.name) === 3 ||  // スペクテイター
            this.playerDataManager.getData(player, "recentlyUsedEnderPearl")
        ) {
            // 速度違反カウントをリセット
            this.playerDataManager.updateData(player, "horizontalViolationCount", 0);
            this.playerDataManager.updateData(player, "verticalViolationCount", 0);

            return null;
        }

        const now = Date.now();
        if (now - lastSpeedCheck < checkInterval) {
            return null; // チェック間隔内はスキップ
        }

        try {
            const prevPos = lastPosition;
            const currentPos = player.location;

            // 最初の位置情報を保存
            if (!prevPos) {
                this.playerDataManager.updateData(player, "lastSpeedCheck", now);
                this.playerDataManager.updateData(player, "lastPosition", currentPos);
                this.playerDataManager.updateData(player, "horizontalViolationCount", 0);
                this.playerDataManager.updateData(player, "verticalViolationCount", 0);
                return null;
            }

            const deltaTime = now - lastSpeedCheck;

            // 水平方向と垂直方向の速度を計算
            const horizontalSpeed = calculateHorizontalSpeed(prevPos, currentPos, deltaTime);
            const verticalSpeed = calculateVerticalSpeed(prevPos, currentPos, deltaTime);

            // 水平方向の最大許容速度
            const maxHorizontalSpeed = getMaxAllowedSpeed(player, true);
            // 垂直方向の最大許容速度
            const maxVerticalSpeed = getMaxAllowedSpeed(player, false);  // 垂直方向はより厳しく

            let violation = false;
            let cheatType = "Speed";


            // 水平方向の速度違反をチェック
            if (horizontalSpeed > maxHorizontalSpeed) {
                horizontalViolationCount++;
                if (horizontalViolationCount >= violationThreshold) {
                    violation = true;
                    cheatType = 'Speed (Horizontal)';

                }
            } else {
                horizontalViolationCount = Math.max(0, horizontalViolationCount - 1); // 違反していない場合は徐々にカウントを減らす
            }

            // 垂直方向の速度違反をチェック
            if (verticalSpeed > maxVerticalSpeed) {
                verticalViolationCount++;
                if (verticalViolationCount >= violationThreshold) {
                    violation = true;
                    cheatType = 'Speed (Vertical)';
                }
            } else {
                verticalViolationCount = Math.max(0, verticalViolationCount - 1);
            }

            // 最終的な速度違反判定
            if (violation) {
                //リセット
                this.playerDataManager.updateData(player, "horizontalViolationCount", 0);
                this.playerDataManager.updateData(player, "verticalViolationCount", 0);
                this.playerDataManager.updateData(player, "lastSpeedCheck", now);
                this.playerDataManager.updateData(player, "lastPosition", currentPos);

                return { cheatType, horizontalSpeed, verticalSpeed }; // 詳細な速度情報を返す

            }
            // データを更新
            this.playerDataManager.updateData(player, "lastSpeedCheck", now);
            this.playerDataManager.updateData(player, "lastPosition", currentPos);
            this.playerDataManager.updateData(player, "horizontalViolationCount", horizontalViolationCount);  // 違反カウントを更新
            this.playerDataManager.updateData(player, "verticalViolationCount", verticalViolationCount);    // 違反カウントを更新


        } catch (error) {
            console.error("速度計算でエラーが発生しました:", error);
            this.playerDataManager.updateData(player, "horizontalViolationCount", 0);
            this.playerDataManager.updateData(player, "verticalViolationCount", 0);

            return null;
        }
        return null;
    }
}

export function detectSpeed(player: Player, playerDataManager: PlayerDataManager): { cheatType: string; horizontalSpeed?: number; verticalSpeed?: number } | null {
    const speedDetector = new SpeedDetector(playerDataManager);
    return speedDetector.detectSpeed(player);
}