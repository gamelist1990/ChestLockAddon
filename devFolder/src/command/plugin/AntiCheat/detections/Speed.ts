import { Player, Vector3 } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { hasEffect } from '../utils';
import { getGamemode } from '../../../../Modules/Util';

const checkInterval = 500;
const allowedSpeed = 15;
const violationThreshold = 2;

function calculateSpeed(prevPos: Vector3, currentPos: Vector3, deltaTime: number): number {
    const dx = currentPos.x - prevPos.x;
    const dy = currentPos.y - prevPos.y;
    const dz = currentPos.z - prevPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance / (deltaTime / 1000); // m/s
}


export function detectSpeed(player: Player, playerDataManager: PlayerDataManager): { cheatType: string; value?: number } | null {
    const data = playerDataManager.get(player);
    if (!data) return null;

    // 無効化条件
    if (
        data.isTeleporting ||
        player.isGliding ||
        player.isInWater ||
        player.isFalling ||
        hasEffect(player, "speed", 3) ||
        hasEffect(player, "jump_boost", 3) ||
        hasEffect(player, "levitation", 1) ||
        hasEffect(player, "slow_falling", 1) ||
        player.isFlying ||
        getGamemode(player.name) === 1 ||
        getGamemode(player.name) === 3 ||
        data.recentlyUsedEnderPearl
    ) {
        return null;
    }

    const now = Date.now();
    if (now - data.speedData.lastSpeedCheck < checkInterval) return null;


    try {
        const prevPos = data.speedData.lastPosition;
        const currentPos = player.location;
        if (!prevPos) {
            playerDataManager.update(player, { speedData: { ...data.speedData, lastSpeedCheck: now, lastPosition: currentPos } });
            return null;
        }


        const deltaTime = now - data.speedData.lastSpeedCheck;
        const speed = calculateSpeed(prevPos, currentPos, deltaTime);


        if (speed > allowedSpeed) {
            data.speedData.speedViolationCount++;
            if (data.speedData.speedViolationCount >= violationThreshold) {
                playerDataManager.update(player, { speedData: { speedViolationCount: 0, lastSpeedCheck: now, lastPosition: currentPos } });
                return { cheatType: 'Speed', value: speed };
            }
        } else {

            playerDataManager.update(player, { speedData: { speedViolationCount: 0, lastSpeedCheck: now, lastPosition: currentPos } });
        }

    } catch (error) {
        console.error("速度計算でエラーが発生しました:", error);
        return null;
    }
    return null;
}