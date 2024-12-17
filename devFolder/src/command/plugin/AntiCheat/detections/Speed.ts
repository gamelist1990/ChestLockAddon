import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { hasEffect } from '../utils';
import { getGamemode } from '../../../../Modules/Util';

const checkInterval = 500;
const allowedSpeed = 4.0;
const violationThreshold = 2;

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
        const movementVector = player.inputInfo.getMovementVector();
        const speed = Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y) * (1000 / checkInterval) * 20 / 50;

        if (speed > allowedSpeed) {
            data.speedData.speedViolationCount++;
            if (data.speedData.speedViolationCount >= violationThreshold) {
                playerDataManager.update(player, { speedData: { speedViolationCount: 0, lastSpeedCheck: now } });
                return { cheatType: 'Speed', value: speed };
            }
        } else {
            playerDataManager.update(player, { speedData: { speedViolationCount: 0, lastSpeedCheck: now } });
        }

    } catch (error) {
        console.error("getMovementVectorでエラーが発生しました:", error);
        return null;
    }
    return null;
}