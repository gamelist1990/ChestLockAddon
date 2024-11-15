// Modules/AntiCheat/detections/KillAura.ts
import { EntityHurtAfterEvent, Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { calculateDistance } from '../utils';

export function detectKillAura(attackingPlayer: Player, event: EntityHurtAfterEvent, playerDataManager: PlayerDataManager, getPlayerCPS: (player: Player) => number): { cheatType: string } | null {
    const attackedEntity = event.hurtEntity as Player; // 攻撃対象がプレイヤーであることを確認
    if (!attackedEntity || attackingPlayer === attackedEntity || !(event.damageSource.cause === 'entityAttack')) return null;

    const data = playerDataManager.get(attackingPlayer);
    if (!data) return null;


    // CPS チェック
    const cps = getPlayerCPS(attackingPlayer);
    if (cps >= 20) {
        return { cheatType: 'Kill Aura (Attack Speed)' };
    }

    // Reach チェック
    const maxReach = 6; // 通常のリーチ + 1 として設定 (調整可能)
    const distanceToEntity = calculateDistance(attackingPlayer.location, attackedEntity.location);
    if (distanceToEntity > maxReach) {
        return { cheatType: 'Kill Aura (Reach)' };
    }


    // Aimbot チェック (180度回転)
    const currentRotation = attackingPlayer.getRotation().y;
    const lastRotation = data.lastRotationY;
    const rotationDiff = Math.abs(currentRotation - lastRotation);

    if (rotationDiff > 170 && rotationDiff <= 190) {
        data.aimbotTicks++;
        if (data.aimbotTicks >= 3) {
            data.aimbotTicks = 0;
            playerDataManager.update(attackingPlayer, { lastRotationY: currentRotation, aimbotTicks: data.aimbotTicks });
            return { cheatType: 'Kill Aura (Aimbot)' };
        }
    } else {
        data.aimbotTicks = 0;
    }
    playerDataManager.update(attackingPlayer, { lastRotationY: currentRotation, aimbotTicks: data.aimbotTicks });



    // Through-Block チェック (ブロック貫通攻撃)
    const raycastResult = attackingPlayer.getBlockFromViewDirection({ maxDistance: distanceToEntity });
    if (raycastResult && raycastResult.block && raycastResult.block.location && distanceToEntity > calculateDistance(attackingPlayer.location, raycastResult.block.location)) {
        return { cheatType: 'Kill Aura (Through-Block)' };
    }




    return null;
}