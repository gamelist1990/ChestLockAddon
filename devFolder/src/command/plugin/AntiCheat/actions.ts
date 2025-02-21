import { Player, GameMode, world, system } from "@minecraft/server";
import { ServerReport } from "../../utility/report";
import { PlayerDataManager } from "./PlayerData";


export function executeRollback(player: Player, configs: any, playerDataManager: PlayerDataManager) {
    const positionHistory = playerDataManager.getData(player, "positionHistory") ?? [];

    const rollbackIndex = positionHistory.length - configs.antiCheat.rollbackTicks - 1;
    if (rollbackIndex >= 0) {
        system.runTimeout(() => {
            const rollbackPosition = positionHistory[rollbackIndex];
            player.teleport(rollbackPosition, { dimension: player.dimension });
            console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
        })

    }
    playerDataManager.reset(player); // ロールバック後にデータをリセット（必要に応じて調整）
}

export function executeFreeze(player: Player, configs: any, playerDataManager: PlayerDataManager) {
    if (!playerDataManager.has(player)) playerDataManager.initialize(player)

    playerDataManager.updateData(player, "isFrozen", true);
    playerDataManager.updateData(player, "freezeStartTime", Date.now());
    playerDataManager.updateData(player, "originalGamemode", player.getGameMode());

    player.setGameMode(GameMode.adventure);
    player.teleport(player.location, { dimension: player.dimension }); //念のため
    player.inputPermissions.movementEnabled = false;
    player.inputPermissions.cameraEnabled = false;
    player.addEffect("weakness", 50, { amplifier: 255, showParticles: false }); //移動不可



    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をフリーズしました`);
    player.sendMessage('異常な行動を検出したため、フリーズしました。');

    system.runTimeout(() => {
        unfreezePlayer(player, playerDataManager);
    }, configs.antiCheat.freezeDuration);
}

export function unfreezePlayer(player: Player, playerDataManager: PlayerDataManager) {
    const isFrozen = playerDataManager.getData(player, "isFrozen")

    if (isFrozen) {
        playerDataManager.updateData(player, "isFrozen", false);
        const originalGamemode = playerDataManager.getData(player, "originalGamemode") ?? GameMode.survival
        player.setGameMode(originalGamemode); // 元のゲームモードに戻す
        player.inputPermissions.movementEnabled = true;
        player.inputPermissions.cameraEnabled = true;
        player.removeEffect("weakness");
        console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のフリーズを解除しました`);
        player.sendMessage('フリーズを解除しました。');
        playerDataManager.reset(player)
        playerDataManager.updateData(player, "violationCount", 0)
    }
}

export function handleCheatDetection(player: Player, detection: { cheatType: string; value?: string | number }, configs: any, playerDataManager: PlayerDataManager): void {
    if (!playerDataManager.has(player)) playerDataManager.initialize(player)
    let violationCount = playerDataManager.getData(player, "violationCount") ?? 0;

    violationCount++; // violationCount をインクリメント
    playerDataManager.updateData(player, "violationCount", violationCount);




    let logMessage = `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;
    if (detection.value !== undefined) {
        logMessage += ` (値: ${detection.value})`;
    }
    console.warn(logMessage);
    world.sendMessage(logMessage);


    if (violationCount >= configs.antiCheat.detectionThreshold * 4) { // 複数回違反したらフリーズ
        executeFreeze(player, configs, playerDataManager);
        let reason = `§f§a(ID: ${player.id})§b \n(チートの種類: ${detection.cheatType} ) \n§f|§6 (x: ${Math.floor(player.location.x)}, y: ${Math.floor(
            player.location.y,
        )}, z: ${Math.floor(player.location.z)})`;
        ServerReport(player, reason);
    } else if (violationCount >= configs.antiCheat.detectionThreshold) { // 初回違反はロールバック
        executeRollback(player, configs, playerDataManager);
    }
}