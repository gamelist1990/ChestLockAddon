import { world, system, Player, EntityHurtAfterEvent, GameMode } from '@minecraft/server';
import { config } from '../../../Modules/Util';
import { verifier, registerCommand } from '../../../Modules/Handler';
import * as AirJump from './detections/AirJump';
import * as Speed from './detections/Speed';
import * as KillAura from './detections/KillAura';
import * as Xray from './detections/Xray';
import * as Spam from './detections/Spam';
import * as editionFake from './detections/editionFake';
import { PlayerDataManager } from './PlayerData';
import { handleCheatDetection, unfreezePlayer } from './actions';
import { addPositionHistory, cleanupSuspiciousBlocks, updateEnderPearlInterval } from './utils';
import { getPlayerCPS } from '../tag';
import { tps } from '../../utility/server';

const configs = {
    debugMode: false,
    ver: 0.4,
    antiCheat: {
        enabled: true,
        detectionThreshold: 2,
        rollbackTicks: 20 * 3,
        freezeDuration: 20 * 10,
        xrayDetectionDistance: 10,
        enderPearlCooldown: 80,
        modules: {
            airJump: false,
            speed: false,
            killAura: true,
            xray: true,
            spam: true,
            editionFake: true
        }
    },
};

const playerDataManager = new PlayerDataManager();
let monitoring = false;
let currentTick = 0;
let lastTpsCheck = 0;
const tpsCheckInterval = 20 * 5;
let disabledModules: (keyof typeof configs.antiCheat.modules)[] = [];

function runTick(): void {
    currentTick++;
    if (!monitoring) return;

    const currentTime = Date.now();

    if (currentTick - lastTpsCheck >= tpsCheckInterval) {
        lastTpsCheck = currentTick;
        checkTpsAndDisableModules();
    }

    for (const player of world.getPlayers()) {
        if (!playerDataManager.has(player) || player.hasTag("bypass")) continue;

        const data = playerDataManager.get(player);
        if (!data) continue;
        if (!configs.antiCheat.enabled) return;

        addPositionHistory(player, playerDataManager, configs);

        if (data.isFrozen) {
            player.teleport(player.location, { dimension: player.dimension });
        } else {
            if (configs.antiCheat.modules.xray && !disabledModules.includes("xray")) {
                Xray.detectXrayOnSight(player, configs, playerDataManager);
            }
            if (configs.antiCheat.modules.airJump && !disabledModules.includes("airJump")) {
                const airJumpResult = AirJump.detectAirJump(player, playerDataManager);
                if (airJumpResult) handleCheatDetection(player, airJumpResult, configs, playerDataManager);
            }
            if (configs.antiCheat.modules.speed && !disabledModules.includes("speed")) {
                const speedResult = Speed.detectSpeed(player, playerDataManager);
                if (speedResult) handleCheatDetection(player, speedResult, configs, playerDataManager);
            }
            if (configs.antiCheat.modules.editionFake && !disabledModules.includes("editionFake")) {
                const response = editionFake.detectEditionFake(player, playerDataManager);
                if (response) handleCheatDetection(player, response, configs, playerDataManager);
            }

            cleanupSuspiciousBlocks(data, currentTime);
            updateEnderPearlInterval(player, playerDataManager);
        }
    }
}

function checkTpsAndDisableModules(): void {
    if (tps < 10) {
        const modulesToDisable: (keyof typeof configs.antiCheat.modules)[] = [];
        if (configs.antiCheat.modules.killAura && !disabledModules.includes("killAura")) {
            modulesToDisable.push("killAura");
        }
        if (configs.antiCheat.modules.xray && !disabledModules.includes("xray")) {
            modulesToDisable.push("xray");
        }
        if (configs.antiCheat.modules.speed && !disabledModules.includes("speed")) {
            modulesToDisable.push("speed");
        }
        if (configs.antiCheat.modules.airJump && !disabledModules.includes("airJump")) {
            modulesToDisable.push("airJump");
        }
        if (configs.antiCheat.modules.editionFake && !disabledModules.includes("editionFake")) {
            modulesToDisable.push("editionFake");
        }


        if (modulesToDisable.length > 0) {
            disabledModules.push(...modulesToDisable);
            world.sendMessage(`§c現在ワールドのTPSが${tps}の為緊急停止し\nモジュール ${modulesToDisable.join(", ")} を一時的に無効化しました。`);
        }

    } else if (tps >= 15) {
        if (disabledModules.length > 0) {
            const modulesToEnable = [...disabledModules];
            disabledModules = [];
            world.sendMessage(`§aワールドのTPSが回復した為、モジュール ${modulesToEnable.join(", ")} を再度有効化しました。`);
        }
    }
}


world.afterEvents.entityHurt.subscribe((event: EntityHurtAfterEvent) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.killAura || disabledModules.includes("killAura")) return;

    const hurtEntity = event.hurtEntity;
    if (hurtEntity instanceof Player) {
        const data = playerDataManager.get(hurtEntity);
        if (data) {
            data.recentlyUsedEnderPearl = true;
            data.enderPearlInterval = configs.antiCheat.enderPearlCooldown;
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
    const player = event.source as Player;
    const item = event.itemStack;

    if (player && item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
        const data = playerDataManager.get(player);
        if (!data) {
            playerDataManager.initialize(player);
            return;
        }

        playerDataManager.update(player, { recentlyUsedEnderPearl: true, enderPearlInterval: 20 * 9 });
    }
});

world.beforeEvents.playerBreakBlock.subscribe((event: any) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.xray || disabledModules.includes("xray")) return;
    Xray.handleBlockBreak(event, playerDataManager, configs);
});

world.beforeEvents.chatSend.subscribe((event: any) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.spam || disabledModules.includes("spam")) return;
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
            case 'list':
                let moduleList = "有効なモジュール:\n";
                for (const moduleName in configs.antiCheat.modules) {
                    if (configs.antiCheat.modules.hasOwnProperty(moduleName)) {
                        moduleList += `- ${moduleName}: ${configs.antiCheat.modules[moduleName] ? "§a有効" : "§c無効"}\n`;
                    }
                }
                player.sendMessage(moduleList);
                break;
            default:
                player.sendMessage('無効な引数です。on, off, unfreeze <プレイヤー名>, freeze <プレイヤー名>, toggle <モジュール名>, list を指定してください');
        }
    }
});

export function initializeAntiCheat(): void {
    world.getPlayers().forEach(player => playerDataManager.initialize(player));
    monitoring = true;
    system.runInterval(runTick, 1);
    console.warn('AntiCheat initialized.');
}