import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';

export function detectEditionFake(player: Player, playerDataManager: PlayerDataManager): { cheatType: string; details?: string } | null {
    const data = playerDataManager.get(player);
    if (!data) return null;
    const maxRenderDistance = player.clientSystemInfo.maxRenderDistance;
    let cheatType = 'EditionFake';
    let details = '';


    if (maxRenderDistance < 6 || maxRenderDistance > 96) {
        details = 'Invalid render distance on Client';
    }


    if (details) {
        return { cheatType, details };
    }

    return null;
}