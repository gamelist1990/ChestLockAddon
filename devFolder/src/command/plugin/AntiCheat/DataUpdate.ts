//AntiCheat/DataUpdate.ts
import { Player } from '@minecraft/server';
import { PlayerDataManager } from './PlayerData';

export function updatePlayerData(player: Player, playerDataManager: PlayerDataManager, newData: Partial<any>): void {
    const data = playerDataManager.get(player);
    if (!data) return;

    playerDataManager.update(player, newData);
}