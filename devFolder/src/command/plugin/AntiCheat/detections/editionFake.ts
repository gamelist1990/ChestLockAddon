
import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { clientdevice, InputType, getMemoryTier } from '../../../../Modules/Util';

export function detectEditionFake(player: Player, playerDataManager: PlayerDataManager): { cheatType: string; details?: string } | null {
    const data = playerDataManager.get(player);
    if (!data) return null;

    const device = clientdevice(player);
    const input = InputType(player);
    const memoryTier = getMemoryTier(player);
    const maxRenderDistance = player.clientSystemInfo.maxRenderDistance;
    let cheatType = 'EditionFake';
    let details = '';

    if (device === 0) { // Desktop (PC)
        if (input === 1) return null; // gamepadだけは除外

        if (input !== 0 && input !== 3 && input !== 2) {
            details = 'Invalid input type on PC';
        } else if (maxRenderDistance < 6 || maxRenderDistance > 96) {
            details = 'Invalid render distance on Client';
        } else {
            return null; // PCで有効な入力と描画距離の場合
        }

    } else if (device === 1) { // Mobile
        if (input !== 3 && input !== 1) { // Touch と Gamepad以外
            details = 'Invalid input type on Mobile';
        } else if (maxRenderDistance < 6 || maxRenderDistance > 27) {
            details = 'Invalid render distance on Client';
        } else {
            return null; // モバイルで有効な入力と描画距離の場合
        }

    } else if (device === 2) { // Console
        if (memoryTier <= 2) { // Switch
            if (input !== 1) { // コントローラー以外
                details = 'Invalid input type on Switch';
            } else if (maxRenderDistance > 14) {
                details = 'Invalid render distance on Switch';
            } else {
                return null; // Switchで有効な入力と描画距離の場合
            }
        } else { // PS4/PS5, Xbox/Xbox Series S/X
            if (input !== 1 && input !== 0) { // コントローラーとキーボード以外
                details = 'Invalid input type on PS/Xbox';
            } else if (maxRenderDistance > 28) {
                details = 'Invalid render distance on PS/Xbox';
            } else {
                return null; // PS/Xboxで有効な入力と描画距離の場合
            }
        }
    }

    if (details) {
        return { cheatType, details };
    }

    return null;
}