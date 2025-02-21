import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';

export function detectEditionFake(player: Player, _playerDataManager: PlayerDataManager): { cheatType: string; details?: string } | null {
    const maxRenderDistance = player.clientSystemInfo.maxRenderDistance;
    let cheatType = 'EditionFake';
    let details = '';

    if (maxRenderDistance < 6 || maxRenderDistance > 96) {
        details = 'Invalid render distance on Client(描画距離が不正です)';
    }


    if (details) {
        return { cheatType, details };
    }

    return null;
}