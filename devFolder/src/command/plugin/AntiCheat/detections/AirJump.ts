//AntiCheat/detections/AirJump.ts
import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { calculateVerticalVelocity } from '../utils';
import { updatePlayerData } from '../DataUpdate';
import { getGamemode } from '../../../../Modules/Util';
import { InputButton, ButtonState } from '@minecraft/server';


export function detectAirJump(player: Player, playerDataManager: PlayerDataManager): { cheatType: string } | null {
    const data = playerDataManager.get(player);
    if (!data) return null;

    // 無効化条件
    if (
        data.isTeleporting ||
        player.isGliding ||
        player.isInWater ||
        getGamemode(player.name) === 1 || // creative は除外
        getGamemode(player.name) === 3 || // spectator は除外
        player.isFlying ||
        data.recentlyUsedEnderPearl
    ) {
        return null;
    }

    const ticksToUse = 20;
    if (data.positionHistory.length < ticksToUse + 1) return null;

    const pastPositions = data.positionHistory.slice(-ticksToUse - 1);
    const isJumping = player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed; // Input APIを使用
    const isOnGround = player.isOnGround;
    const currentPosition = player.location;


    if (isOnGround) {
        updatePlayerData(player, playerDataManager, {
            isJumping: false,
            jumpCounter: 0,
            airJumpDetected: false,
            lastGroundY: currentPosition.y,
            lastOnGroundTime: Date.now()
        });
    } else if (isJumping && !data.isJumping) {
        // ジャンプ開始時の処理を強化
        if (Date.now() - data.lastOnGroundTime > 250) { // 地面から離れて一定時間後にジャンプした場合
            updatePlayerData(player, playerDataManager, { isJumping: true, jumpStartTime: Date.now() });

        } else {
            updatePlayerData(player, playerDataManager, { isJumping: true, jumpStartTime: Date.now() });
        }
    } else if (data.isJumping && !isOnGround) {
        if (Date.now() - data.lastOnGroundTime < 150) return null; // 直前の接地からの時間チェックを短縮 (値は調整してください)



        const jumpHeight = currentPosition.y - data.lastGroundY;
        const velocitiesY = pastPositions.slice(1).map((pos, i) => calculateVerticalVelocity(pos, pastPositions[i]));

        // 不正な垂直移動のしきい値を調整 (値は調整してください)
        const invalidVerticalMovement = velocitiesY.some(vel => vel > 0.48 || vel < -0.52);

        if (invalidVerticalMovement || jumpHeight > 2.5) {
            if (Date.now() - data.jumpStartTime > 100 && player.inputInfo.getButtonState(InputButton.Jump) !== ButtonState.Pressed) {

                data.jumpCounter++;
                if (data.jumpCounter >= 3) {  // jumpCounter のしきい値を下げる (値は調整してください)
                    updatePlayerData(player, playerDataManager, { jumpCounter: 0 });
                    return { cheatType: 'AirJump' };
                }
                updatePlayerData(player, playerDataManager, { jumpCounter: data.jumpCounter })
            }
        }


    }

    return null;
}