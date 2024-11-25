//AntiCheat/detections/KillAura.ts
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
        return { cheatType: 'Kill Aura (CPS20+)' };
    }

    // Reach チェック
    const maxReach = 6.7; 
    const distanceToEntity = calculateDistance(attackingPlayer.location, attackedEntity.location);
    if (distanceToEntity > maxReach) {
        return { cheatType: `Kill Aura (Reach|${maxReach})` };
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



    const raycastResult = attackingPlayer.getBlockFromViewDirection({ maxDistance: distanceToEntity });
    if (raycastResult && raycastResult.block && raycastResult.block.location && distanceToEntity > calculateDistance(attackingPlayer.location, raycastResult.block.location)) {
        data.throughBlockCount++;
        if (data.throughBlockCount > 1) { // 2回目以降（3回目以上）で検知
            data.throughBlockCount = 0; // カウンターをリセット
            playerDataManager.update(attackingPlayer, { throughBlockCount: data.throughBlockCount }); // データを更新
            return { cheatType: 'Kill Aura (Through-Block)' };
        }
    } else {
        data.throughBlockCount = 0; // ブロック貫通が検知されなかった場合はリセット
    }
    playerDataManager.update(attackingPlayer, { throughBlockCount: data.throughBlockCount }); 




    return null;
}