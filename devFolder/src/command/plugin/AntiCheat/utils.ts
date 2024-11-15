// Modules/AntiCheat/utils.ts
import { Player, system } from "@minecraft/server";
import { PlayerDataManager } from "./PlayerData";

export function cleanupSuspiciousBlocks(data: any, currentTime: number) {
    for (const blockLocationString in data.xrayData.suspiciousBlocks) {
        const suspiciousBlock = data.xrayData.suspiciousBlocks[blockLocationString];
        if (currentTime - suspiciousBlock.timestamp >= 10000) {
            delete data.xrayData.suspiciousBlocks[blockLocationString];
        }
    }
}

export function updateEnderPearlInterval(player: Player, playerDataManager: PlayerDataManager) {
    const data = playerDataManager.get(player);

    if (data && data.enderPearlInterval > 0) { // enderPearlInterval が 0 より大きい場合のみ実行
        data.enderPearlInterval--;

        // 更新された data を playerDataManager に保存
        playerDataManager.update(player, { enderPearlInterval: data.enderPearlInterval });

        if (data.enderPearlInterval <= 0) {
            playerDataManager.update(player, { recentlyUsedEnderPearl: false, enderPearlInterval: null });
        }
    }
}

export function addPositionHistory(player: Player, playerDataManager: PlayerDataManager, configs: any) {
    const data = playerDataManager.get(player);
    if (!data) return;

    const currentPosition = player.location;

    // isTeleporting状態の更新
    if (player.isGliding) {
        data.isTeleporting = true;
        system.runTimeout(() => {
            data.isTeleporting = false;
            playerDataManager.update(player, { isTeleporting: false }); // 非同期処理なので、ここで更新
        }, 3 * 20);
    } else {
        data.isTeleporting = false; // グライディング中でない場合はfalse
    }

    // 位置履歴の更新
    data.positionHistory.push(currentPosition);
    data.lastPosition = currentPosition;


    if (data.positionHistory.length > configs.antiCheat.rollbackTicks + 1) {
        data.positionHistory.shift();
    }


    playerDataManager.update(player, {
        isTeleporting: data.isTeleporting, // isTeleporting の更新
        positionHistory: data.positionHistory, // positionHistory の更新
        lastPosition: data.lastPosition // lastPosition の更新
    });

}

export function calculateHorizontalSpeed(pos1: Vector3, pos2: Vector3) {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2);
}


export function calculateDistance(pos1: Vector3, pos2: Vector3): number {
    return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2 + (pos2.z - pos1.z) ** 2);
}

export function hasEffect(player: Player, effectName: any, level: number): boolean {
    try {
        const effect = player.getEffect(effectName);
        return effect !== undefined && effect.amplifier >= level - 1;
    } catch (error) {
        return false;
    }
}

import { Vector3 } from '@minecraft/server';

export function calculateVerticalVelocity(currentPos: Vector3, previousPos: Vector3): number {
    return (currentPos.y - previousPos.y) / 50; // 50ms (1 tick) での速度変化
}