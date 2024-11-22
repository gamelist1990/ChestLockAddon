//AntiCheat/detections/Speed.ts
import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { calculateHorizontalSpeed, hasEffect } from '../utils';
import { updatePlayerData } from '../DataUpdate';
import { getGamemode } from '../../../../Modules/Util';


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
    const checkInterval = 500; // チェック間隔 (ミリ秒)

    if (now - data.lastSpeedCheck < checkInterval) return null;


    const lastPosition = data.positionHistory[data.positionHistory.length - 2] || player.location;
    const distance = calculateHorizontalSpeed(player.location, lastPosition);
    const speed = distance * (1000 / checkInterval);


    const allowedSpeed = 4.0; // 通常のプレイヤーの最大速度は4.3block/s程度なので4.0に設定


    if (speed > allowedSpeed) {
        data.speedViolationCount++;
        if (data.speedViolationCount >= 2) {
            updatePlayerData(player, playerDataManager, { speedViolationCount: 0, lastSpeedCheck: now });//DataUpdate経由で更新
            return { cheatType: 'Speed', value: speed };
        }

    } else {
        updatePlayerData(player, playerDataManager, { speedViolationCount: 0, lastSpeedCheck: now });//DataUpdate経由で更新

    }

    return null;
}

