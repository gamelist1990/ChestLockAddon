//AntiCheat/actions.ts
import { Player, GameMode, world, system } from "@minecraft/server";
import { ServerReport } from "../../utility/report";
import { PlayerDataManager } from "./PlayerData";


export function executeRollback(player: Player, configs: any, playerDataManager: PlayerDataManager) {
    const data = playerDataManager.get(player);
    if (!data) return;

    const rollbackIndex = data.positionHistory.length - configs.antiCheat.rollbackTicks - 1;
    if (rollbackIndex >= 0) {
        system.runTimeout(() => {
            const rollbackPosition = data.positionHistory[rollbackIndex];
            player.teleport(rollbackPosition, { dimension: player.dimension });
            console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
        })

    }

    playerDataManager.reset(player);
}

export function executeFreeze(player: Player, configs: any, playerDataManager: PlayerDataManager) {
    const data = playerDataManager.get(player);
    if (!data) return;

    playerDataManager.update(player, { isFrozen: true, freezeStartTime: Date.now(), originalGamemode: player.getGameMode() });
    player.setGameMode(GameMode.adventure); // フリーズ中はアドベンチャーモードに設定
    player.teleport(player.location, { dimension: player.dimension });
    player.inputPermissions.movementEnabled = false;
    player.inputPermissions.cameraEnabled = false;
    player.addEffect("weakness", 50, { amplifier: 255, showParticles: false });



    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をフリーズしました`);
    player.sendMessage('異常な行動を検出したため、フリーズしました。');

    system.runTimeout(() => {
        unfreezePlayer(player, playerDataManager);
    }, configs.antiCheat.freezeDuration);
}

export function unfreezePlayer(player: Player, playerDataManager: PlayerDataManager) {
    const data = playerDataManager.get(player);
    if (data && data.isFrozen) {
        playerDataManager.update(player, { isFrozen: false });
        player.setGameMode(data.originalGamemode); // 元のゲームモードに戻す
        player.inputPermissions.movementEnabled = true;
        player.inputPermissions.cameraEnabled = true;
        player.removeEffect("weakness");
        console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のフリーズを解除しました`);
        player.sendMessage('フリーズを解除しました。');
        playerDataManager.reset(player);
        playerDataManager.update(player, { violationCount: 0 });
    }
}

export function handleCheatDetection(player: Player, detection: { cheatType: string; value?: string | number }, configs: any, playerDataManager: PlayerDataManager): void {
    const data = playerDataManager.get(player);
    if (!data) return;

    const detectionThreshold = configs.antiCheat.detectionThreshold;

    data.violationCount++; // violationCount をインクリメント
    playerDataManager.update(player, { violationCount: data.violationCount });



    let logMessage = `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;
    if (detection.value !== undefined) {
        logMessage += ` (値: ${detection.value})`;
    }
    console.warn(logMessage);
    world.sendMessage(logMessage);


    if (data.violationCount >= detectionThreshold * 4) { // 複数回違反したらフリーズ
        executeFreeze(player, configs, playerDataManager);
        let reason = `§f§a(ID: ${player.id})§b \n(チートの種類: ${detection.cheatType} ) \n§f|§6 (x: ${Math.floor(player.location.x)}, y: ${Math.floor(
            player.location.y,
        )}, z: ${Math.floor(player.location.z)})`;
        ServerReport(player, reason);
    } else if (data.violationCount >= detectionThreshold) { // 初回違反はロールバック
        executeRollback(player, configs, playerDataManager);
    }
}