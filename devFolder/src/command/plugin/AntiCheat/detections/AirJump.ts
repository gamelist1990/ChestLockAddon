import { Player } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { updatePlayerData } from '../DataUpdate';
import { getGamemode } from '../../../../Modules/Util';
import { InputButton } from '@minecraft/server';
import { isPlayerStuckToWall } from './physics';

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
    const isJumping = player.inputInfo.getButtonState(InputButton.Jump); 
    const isOnGround = player.isOnGround;
    const currentPosition = player.location;
    let previousPosition = pastPositions[pastPositions.length - 2];
    
    if (isOnGround && isJumping) {
        updatePlayerData(player, playerDataManager, {
            isJumping: false,
            jumpCounter: 0, // 地面についたらリセット
            airJumpDetected: false,
            lastGroundY: currentPosition.y,
            lastOnGroundTime: Date.now(),
            allowedJumps: 2, // 許容ジャンプ回数をリセット
        });
    } else if (isJumping && !data.isJumping) {
        // ジャンプ開始時の処理
        let expectedYChange = 0;

            if (Date.now() - data.lastOnGroundTime > 250) { // 地面から離れて一定時間後にジャンプした場合
                expectedYChange = currentPosition.y - previousPosition.y
                updatePlayerData(player, playerDataManager, { isJumping: true, jumpStartTime: Date.now() });
            } else {
                expectedYChange = currentPosition.y - previousPosition.y
                updatePlayerData(player, playerDataManager, { isJumping: true, jumpStartTime: Date.now() });
            }

            // 空中ジャンプのカウント
            if (!isOnGround) {
                data.allowedJumps--; // 許容ジャンプ回数を減らす
                updatePlayerData(player, playerDataManager, { allowedJumps: data.allowedJumps });
                // Y座標の変化をチェック (上昇しているか)
                if (expectedYChange <= 0.001 && (Date.now() - data.lastOnGroundTime > 150)) {
                    data.jumpCounter++; // 不正なジャンプとしてカウント

                }


                if (data.allowedJumps < 0) { // 許容ジャンプ回数を超えた場合
                    data.jumpCounter++; // 不正なジャンプとしてカウント
                    if (data.jumpCounter >= 3) { // 複数回の不正ジャンプで検知
                        updatePlayerData(player, playerDataManager, { jumpCounter: 0 })
                        console.warn(`AirJump detected for player: ${player.name}`);
                        return { cheatType: 'AirJump' };
                    }

                updatePlayerData(player, playerDataManager, { jumpCounter: data.jumpCounter });
            }
        }
    } else if (data.isJumping && !isOnGround) {
        if (Date.now() - data.lastOnGroundTime < 150) return null; 
    }

    return null;
}