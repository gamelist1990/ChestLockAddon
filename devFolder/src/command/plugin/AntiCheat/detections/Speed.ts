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
function getMaxAllowedSpeed(player: Player, _data: any, horizontal: boolean): number {
    let baseSpeed = 4.3; // 通常の歩行速度 (m/s)

    if (player.isSprinting) {
        baseSpeed *= 1.3; // ダッシュ時の速度倍率
    }

    if (hasEffect(player, "speed",3)) {
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
        const data = this.playerDataManager.get(player);
        if (!data) return null;
        // 除外条件のチェック
        if (
            data.isTeleporting ||
            player.isGliding ||
            player.isInWater ||  // 水中判定は複雑なので一旦除外
            player.isFalling || // 落下判定は垂直速度でチェック
            hasEffect(player, "speed", 3) || // スピード効果は getMaxAllowedSpeed で考慮
            hasEffect(player, "jump_boost", 3) || // ジャンプブーストは垂直速度で考慮
            hasEffect(player, "levitation", 1) ||
            hasEffect(player, "slow_falling", 1) ||
            player.isFlying ||
            getGamemode(player.name) === 1 || // クリエイティブ
            getGamemode(player.name) === 3 ||  // スペクテイター
            data.recentlyUsedEnderPearl
        ) {
            // 速度違反カウントをリセット
            this.playerDataManager.update(player, { speedData: { ...data.speedData, horizontalViolationCount: 0, verticalViolationCount: 0 } });
            return null;
        }

        const now = Date.now();
        if (now - data.speedData.lastSpeedCheck < checkInterval) {
            return null; // チェック間隔内はスキップ
        }

        try {
            const prevPos = data.speedData.lastPosition;
            const currentPos = player.location;

            // 最初の位置情報を保存
            if (!prevPos) {
                this.playerDataManager.update(player, { speedData: { ...data.speedData, lastSpeedCheck: now, lastPosition: currentPos, horizontalViolationCount: 0, verticalViolationCount: 0 } });
                return null;
            }

            const deltaTime = now - data.speedData.lastSpeedCheck;

            // 水平方向と垂直方向の速度を計算
            const horizontalSpeed = calculateHorizontalSpeed(prevPos, currentPos, deltaTime);
            const verticalSpeed = calculateVerticalSpeed(prevPos, currentPos, deltaTime);

            // 水平方向の最大許容速度
            const maxHorizontalSpeed = getMaxAllowedSpeed(player, data, true);
            // 垂直方向の最大許容速度
            const maxVerticalSpeed = getMaxAllowedSpeed(player, data, false);  // 垂直方向はより厳しく

            let violation = false;
            let cheatType = "Speed";


            // 水平方向の速度違反をチェック
            if (horizontalSpeed > maxHorizontalSpeed) {
                data.speedData.horizontalViolationCount++;
                if (data.speedData.horizontalViolationCount >= violationThreshold) {
                    violation = true;
                    cheatType = 'Speed (Horizontal)';

                }
            } else {
                data.speedData.horizontalViolationCount = Math.max(0, data.speedData.horizontalViolationCount - 1); // 違反していない場合は徐々にカウントを減らす
            }

            // 垂直方向の速度違反をチェック
            if (verticalSpeed > maxVerticalSpeed) {
                data.speedData.verticalViolationCount++;
                if (data.speedData.verticalViolationCount >= violationThreshold) {
                    violation = true;
                    cheatType = 'Speed (Vertical)';
                }
            } else {
                data.speedData.verticalViolationCount = Math.max(0, data.speedData.verticalViolationCount - 1);
            }

            // 最終的な速度違反判定
            if (violation) {
                this.playerDataManager.update(player, { speedData: {
                    horizontalViolationCount: 0, verticalViolationCount: 0, lastSpeedCheck: now, lastPosition: currentPos,
                    speedViolationCount: 0,
                    violationCount: 0
                } });
                return { cheatType, horizontalSpeed, verticalSpeed }; // 詳細な速度情報を返す

            }
            // データを更新
            this.playerDataManager.update(player, { speedData: { ...data.speedData, lastSpeedCheck: now, lastPosition: currentPos } });


        } catch (error) {
            console.error("速度計算でエラーが発生しました:", error);
            // エラー発生時は速度違反カウントをリセット
            this.playerDataManager.update(player, { speedData: { ...data.speedData, horizontalViolationCount: 0, verticalViolationCount: 0 } });
            return null;
        }
        return null;
    }
}

export function detectSpeed(player: Player, playerDataManager: PlayerDataManager): { cheatType: string; horizontalSpeed?: number; verticalSpeed?: number } | null {
    const speedDetector = new SpeedDetector(playerDataManager);
    return speedDetector.detectSpeed(player);
}