import { Player, InputButton } from '@minecraft/server';
import { PlayerDataManager } from '../PlayerData';
import { getGamemode } from '../../../../Modules/Util';

export function detectAirJump(player: Player, playerDataManager: PlayerDataManager): { cheatType: string } | null {

    // 無効化条件
    if (
        playerDataManager.getData(player, "isTeleporting") ||
        player.isGliding ||
        player.isInWater ||
        getGamemode(player.name) === 1 || // creative は除外
        getGamemode(player.name) === 3 || // spectator は除外
        player.isFlying ||
        playerDataManager.getData(player, "recentlyUsedEnderPearl")
    ) {
        return null;
    }

    const ticksToUse = 20;
    const positionHistory = playerDataManager.getData(player, "positionHistory") ?? [];
    if (positionHistory.length < ticksToUse + 1) return null;

    const pastPositions = positionHistory.slice(-ticksToUse - 1);
    let isJumping: any;

    try {
        isJumping = player.inputInfo.getButtonState(InputButton.Jump);
    } catch (error) {
        isJumping = player.isJumping;
    }
    const isOnGround = player.isOnGround;
    const currentPosition = player.location;
    let previousPosition = pastPositions[pastPositions.length - 2];

    if (isOnGround && isJumping) {
        playerDataManager.updateData(player, "isJumping", false);
        playerDataManager.updateData(player, "jumpCounter", 0); // 地面についたらリセット
        playerDataManager.updateData(player, "airJumpDetected", false);
        playerDataManager.updateData(player, "lastGroundY", currentPosition.y);
        playerDataManager.updateData(player, "lastOnGroundTime", Date.now());
        playerDataManager.updateData(player, "allowedJumps", 2); // 許容ジャンプ回数をリセット

    } else if (isJumping && !playerDataManager.getData(player, "isJumping")) {
        // ジャンプ開始時の処理
        let expectedYChange = 0;
        const lastOnGroundTime = playerDataManager.getData(player, "lastOnGroundTime") ?? 0;

        if (Date.now() - lastOnGroundTime > 250) { // 地面から離れて一定時間後にジャンプした場合
            expectedYChange = currentPosition.y - previousPosition.y
            playerDataManager.updateData(player, "isJumping", true);
            playerDataManager.updateData(player, "jumpStartTime", Date.now());
        } else {
            expectedYChange = currentPosition.y - previousPosition.y
            playerDataManager.updateData(player, "isJumping", true);
            playerDataManager.updateData(player, "jumpStartTime", Date.now());
        }

        // 空中ジャンプのカウント
        if (!isOnGround) {
            let allowedJumps = playerDataManager.getData(player, "allowedJumps") ?? 2;
            allowedJumps--; // 許容ジャンプ回数を減らす
            playerDataManager.updateData(player, "allowedJumps", allowedJumps);

            // Y座標の変化をチェック (上昇しているか)
            let jumpCounter = playerDataManager.getData(player, "jumpCounter") ?? 0;
            if (expectedYChange <= 0.001 && (Date.now() - lastOnGroundTime > 150)) {
                jumpCounter++; // 不正なジャンプとしてカウント
            }


            if (allowedJumps < 0) { // 許容ジャンプ回数を超えた場合
                jumpCounter++; // 不正なジャンプとしてカウント
                if (jumpCounter >= 3) { // 複数回の不正ジャンプで検知
                    playerDataManager.updateData(player, "jumpCounter", 0) //reset
                    console.warn(`AirJump detected for player: ${player.name}`);
                    return { cheatType: 'AirJump' };
                }

                playerDataManager.updateData(player, "jumpCounter", jumpCounter);
            }
        }
    } else if (playerDataManager.getData(player, "isJumping") && !isOnGround) {
        const lastOnGroundTime = playerDataManager.getData(player, "lastOnGroundTime") ?? 0;
        if (Date.now() - lastOnGroundTime < 150) return null;
    }

    return null;
}