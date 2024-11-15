// Modules/AntiCheat/detections/AirJump.ts
import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { calculateVerticalVelocity } from '../utils';
import { updatePlayerData } from '../DataUpdate';
import { getGamemode } from '../../../../Modules/Util';


export function detectAirJump(player: Player, playerDataManager: PlayerDataManager): { cheatType: string } | null {
    const data = playerDataManager.get(player);
    if (!data) return null;

    // 無効化条件
    if (
        data.isTeleporting ||
        player.isGliding ||
        player.isInWater ||
        getGamemode(player.name) === 1 || // creative は除外
        getGamemode(player.name) === 3 || // spectator は除外
        player.isFlying ||
        data.recentlyUsedEnderPearl
    ) {
        return null;
    }

    const ticksToUse = 5;
    if (data.positionHistory.length < ticksToUse + 1) return null;

    const pastPositions = data.positionHistory.slice(-ticksToUse - 1);
    const isJumping = player.isJumping;
    const isOnGround = player.isOnGround;
    const currentPosition = player.location;


    if (isOnGround) {
        updatePlayerData(player, playerDataManager, {
            isJumping: false,
            jumpCounter: 0,
            airJumpDetected: false,
            lastGroundY: currentPosition.y,
            lastOnGroundTime: Date.now()
        });
    } else if (isJumping && !data.isJumping) {
        updatePlayerData(player, playerDataManager, { isJumping: true, jumpStartTime: Date.now() });
    } else if (data.isJumping && !isOnGround) {
        if (Date.now() - data.lastOnGroundTime < 250) return null;

        const jumpHeight = currentPosition.y - data.lastGroundY;
        const velocitiesY = pastPositions.slice(1).map((pos, i) => calculateVerticalVelocity(pos, pastPositions[i]));

        const invalidVerticalMovement = velocitiesY.some(vel => vel > 0.50 || vel < -0.50);

        if (invalidVerticalMovement || jumpHeight > 2.5) {
            data.jumpCounter++;
            if (data.jumpCounter >= 3) {
                updatePlayerData(player, playerDataManager, { jumpCounter: 0 });
                return { cheatType: 'AirJump' };
            }
            updatePlayerData(player, playerDataManager, { jumpCounter: data.jumpCounter })
        }
    }

    return null;
}



