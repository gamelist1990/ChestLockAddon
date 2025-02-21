import { Player } from '@minecraft/server';
import { PlayerDataManager } from './PlayerData';

export function updatePlayerData(player: Player, playerDataManager: PlayerDataManager, newData: Record<string, any>): void {
    // プレイヤーデータが存在しない場合は初期化
    if (!playerDataManager.has(player)) {
        playerDataManager.initialize(player);
    }

    // newData の各キーと値についてループ処理
    for (const key in newData) {
        if (newData.hasOwnProperty(key)) {
            playerDataManager.updateData(player, key, newData[key]);
        }
    }
}