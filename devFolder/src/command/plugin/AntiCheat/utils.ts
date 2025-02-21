import { Player, system } from "@minecraft/server";
import { PlayerDataManager } from "./PlayerData";

export function cleanupSuspiciousBlocks(player: Player, currentTime: number, playerDataManager: PlayerDataManager) {
    const suspiciousBlocks = playerDataManager.getData(player, "suspiciousBlocks") ?? {};

    for (const blockLocationString in suspiciousBlocks) {
        if (suspiciousBlocks.hasOwnProperty(blockLocationString)) {
            const suspiciousBlock = suspiciousBlocks[blockLocationString];
            if (currentTime - suspiciousBlock.timestamp >= 10000) {
                delete suspiciousBlocks[blockLocationString];
            }
        }
    }
    playerDataManager.updateData(player, "suspiciousBlocks", suspiciousBlocks);
}

export function updateEnderPearlInterval(player: Player, playerDataManager: PlayerDataManager) {
    let enderPearlInterval = playerDataManager.getData(player, "enderPearlInterval") ?? 0;

    if (enderPearlInterval > 0) { // enderPearlInterval が 0 より大きい場合のみ実行
        enderPearlInterval--;

        // 更新された data を playerDataManager に保存
        playerDataManager.updateData(player, "enderPearlInterval", enderPearlInterval);

        if (enderPearlInterval <= 0) {
            playerDataManager.updateData(player, "recentlyUsedEnderPearl", false);
            playerDataManager.updateData(player, "enderPearlInterval", 0);
        }
    }
}

export function addPositionHistory(player: Player, playerDataManager: PlayerDataManager) {
    if (!playerDataManager.has(player)) playerDataManager.initialize(player);

    let positionHistory = playerDataManager.getData(player, "positionHistory") ?? [];
    let isTeleporting = playerDataManager.getData(player, "isTeleporting") ?? false;
    const currentPosition = player.location;

    // isTeleporting状態の更新
    if (player.isGliding) {
        isTeleporting = true;
        system.runTimeout(() => {
            playerDataManager.updateData(player, "isTeleporting", false); // 非同期処理なので、ここで更新
        }, 3 * 20);
    } else {
        isTeleporting = false; // グライディング中でない場合はfalse
    }

    // 位置履歴の更新
    positionHistory.push(currentPosition);
    playerDataManager.updateData(player, "lastPosition", currentPosition)


    if (positionHistory.length > 61) { //3 * 20 + 1
        positionHistory.shift();
    }


    playerDataManager.updateData(player, "isTeleporting", isTeleporting);
    playerDataManager.updateData(player, "positionHistory", positionHistory); // positionHistory 

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
    return (currentPos.y - previousPos.y) / 0.05; // 50ms (1 tick) での速度変化、0除算を避けるため0.05
}