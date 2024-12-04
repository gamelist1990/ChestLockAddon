//AntiCheat/index.ts
import { world, system, Player, EntityHurtAfterEvent, GameMode } from '@minecraft/server';
import { config } from '../../../Modules/Util';
import { verifier } from '../../../Modules/Handler';
import { registerCommand } from '../../../Modules/Handler';
import * as AirJump from './detections/AirJump';
import * as Speed from './detections/Speed';
import * as KillAura from './detections/KillAura';
import * as Xray from './detections/Xray';
import * as Spam from './detections/Spam';
import { PlayerDataManager } from './PlayerData';
import { handleCheatDetection, unfreezePlayer } from './actions';
import { addPositionHistory, cleanupSuspiciousBlocks, updateEnderPearlInterval } from './utils';
import { getPlayerCPS } from '../tag';



// 設定 (必要に応じて調整)
const configs = {
    debugMode: false,
    antiCheat: {
        enabled: true, 
        detectionThreshold: 2,
        rollbackTicks: 20 * 3,
        freezeDuration: 20 * 10,
        xrayDetectionDistance: 10,
        modules: { 
            airJump: false,
            speed: false,
            killAura: false,
            xray: false,
            spam: true
        }
    },
};

const playerDataManager = new PlayerDataManager();
let monitoring = false;
let currentTick = 0;

function runTick(): void {
    currentTick++;
    if (!monitoring) return;

    

    const currentTime = Date.now();

    for (const player of world.getPlayers()) {
        if (!playerDataManager.has(player) || player.hasTag("bypass")) continue; 

        const data = playerDataManager.get(player);
        if (!data) continue;
        if (!configs.antiCheat.enabled) return;
        addPositionHistory(player, playerDataManager, configs);

        if (data.isFrozen) {
            //フリーズ中はプレイヤーを同じ場所にテレポートし続けることで移動を制限
            player.teleport(player.location, { dimension: player.dimension });
        } else {
            // 各モジュールの実行
            if (configs.antiCheat.modules.xray) { // xray モジュールが有効な場合のみ実行
                Xray.detectXrayOnSight(player, configs, playerDataManager);
            }

            if (configs.antiCheat.modules.airJump) { // airJump モジュールが有効な場合のみ実行
                const airJumpResult = AirJump.detectAirJump(player, playerDataManager);
                if (airJumpResult) handleCheatDetection(player, airJumpResult, configs, playerDataManager);
            }

            if (configs.antiCheat.modules.speed) { // speed モジュールが有効な場合のみ実行
                const speedResult = Speed.detectSpeed(player, playerDataManager);
                if (speedResult) handleCheatDetection(player, speedResult, configs, playerDataManager);
            }

            cleanupSuspiciousBlocks(data, currentTime);
            updateEnderPearlInterval(player, playerDataManager);
        }
    }
}




// イベントリスナー (entityHurt, playerBreakBlock, chatSend)
world.afterEvents.entityHurt.subscribe((event: EntityHurtAfterEvent) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.killAura) return;

    const hurtEntity = event.hurtEntity;
    if (hurtEntity instanceof Player) {
        const data = playerDataManager.get(hurtEntity);
        if (data) {
            data.recentlyUsedEnderPearl = true;
            data.enderPearlInterval = 80; 
            playerDataManager.update(hurtEntity, data);
        }
    }


    const attackingPlayer = event.damageSource.damagingEntity as Player;
    if (attackingPlayer && event.hurtEntity instanceof Player) {
        if (event.damageSource.cause === 'entityAttack') {
            const killAuraResult = KillAura.detectKillAura(attackingPlayer, event, playerDataManager, getPlayerCPS);
            if (killAuraResult) handleCheatDetection(attackingPlayer, killAuraResult, configs, playerDataManager);
        }
    }
});

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source as Player; // Player型にキャスト
    const item = event.itemStack;

    if (player && item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
        const data = playerDataManager.get(player);
        if (!data) {
            playerDataManager.initialize(player);
            return; // 初期化直後は return
        }


        playerDataManager.update(player, { recentlyUsedEnderPearl: true, enderPearlInterval: 20*9 }); // 4秒に設定
    }
});


world.beforeEvents.playerBreakBlock.subscribe((event: any) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.xray) return; 
    Xray.handleBlockBreak(event, playerDataManager, configs);
});

world.beforeEvents.chatSend.subscribe((event: any) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.spam) return;
    Spam.detectSpam(event, playerDataManager, configs);
});




export function AddNewPlayers(): void {
    if (monitoring) {
        world.getPlayers().forEach((p) => {
            if (!playerDataManager.get(p)) {
                playerDataManager.initialize(p);
            }
        });
    }
    system.runTimeout(AddNewPlayers, 20 * 60);
}


function freezePlayer(player: Player): void {
    const data = playerDataManager.get(player);
    if (!data) return;

    playerDataManager.update(player, { isFrozen: true, originalGamemode: player.getGameMode() });
    player.setGameMode(GameMode.adventure);
    player.teleport(player.location, { dimension: player.dimension });

    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をフリーズさせました`);
}



// コマンド登録
registerCommand({
    name: 'anticheat',
    description: 'チート対策を有効/無効にします',
    parent: false,
    maxArgs: 2,
    minArgs: 1,
    require: (player: Player) => verifier(player, config().commands['anticheat']),
    executor: (player: Player, args: string[]) => {
        switch (args[0]) {
            case 'on':
                initializeAntiCheat();
                AddNewPlayers();
                player.sendMessage('チート対策を有効にしました');
                break;
            case 'off':
                monitoring = false;
                player.sendMessage('チート対策を無効にしました');
                break;
            case 'unfreeze':
                if (args.length === 2) {
                    const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
                    if (targetPlayer) {
                        unfreezePlayer(targetPlayer, playerDataManager);
                        player.sendMessage(`プレイヤー ${targetPlayer.name} のフリーズを解除しました`);
                    } else {
                        player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
                    }
                } else {
                    player.sendMessage('無効な引数です。unfreeze <プレイヤー名> を指定してください');
                }
                break;

            case 'freeze':
                if (args.length === 2) {
                    const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
                    if (targetPlayer) {
                        freezePlayer(targetPlayer);
                        player.sendMessage(`プレイヤー ${targetPlayer.name} をフリーズさせました`);
                    } else {
                        player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
                    }
                } else {
                    player.sendMessage('無効な引数です。freeze <プレイヤー名> を指定してください');
                }
                break;
            case 'toggle':
                if (args.length === 2) {
                    const moduleName = args[1].toLowerCase() as keyof typeof configs.antiCheat.modules;
                    if (moduleName in configs.antiCheat.modules) {
                        configs.antiCheat.modules[moduleName] = !configs.antiCheat.modules[moduleName];
                        player.sendMessage(`モジュール ${moduleName} を ${configs.antiCheat.modules[moduleName] ? '有効' : '無効'} にしました`);
                    } else {
                        player.sendMessage('無効なモジュール名です。');
                    }
                } else {
                    player.sendMessage('モジュール名を指定してください。');
                }
                break;
            default:
                player.sendMessage('無効な引数です。on, off, unfreeze <プレイヤー名>, freeze <プレイヤー名>, toggle <モジュール名> を指定してください');

        }
    }
});



// 初期化関数
export function initializeAntiCheat(): void {
    world.getPlayers().forEach(player => playerDataManager.initialize(player));
    monitoring = true;
    system.runInterval(runTick, 1);
    console.warn('AntiCheat initialized.');
}