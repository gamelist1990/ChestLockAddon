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
    ver: 0.5,
    antiCheat: {
        enabled: true,
        detectionThreshold: 2,
        rollbackTicks: 20 * 3,
        freezeDuration: 20 * 10,
        xrayDetectionDistance: 10,
        enderPearlCooldown: 80,
        modules: {
            airJump: true,
            speed: false,
            killAura: true,
            xray: false,
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

// イベントハンドラの登録と解除を管理するオブジェクト
const eventHandlers: { [moduleName: string]: { [eventName: string]: any } } = {};


/**
 * モジュールを登録し、関連するイベントハンドラを登録します。
 * @param {keyof typeof configs.antiCheat.modules} moduleName モジュール名
 * @param {{ [eventName: string]: (event: any) => void }} handlers イベントハンドラのオブジェクト
 */
export function registerModule(moduleName: keyof typeof configs.antiCheat.modules, handlers: { [eventName: string]: (event: any) => void }): void {
    if (!eventHandlers[moduleName]) {
        eventHandlers[moduleName] = {};
    }

    for (const eventName in handlers) {
        if (handlers.hasOwnProperty(eventName)) {
            //ここでは何もしない
        }
    }
}
/**
 * 指定されたモジュールのイベントハンドラを登録解除します。
 * @param {keyof typeof configs.antiCheat.modules} moduleName モジュール名
 */

export function unregisterModule(moduleName: keyof typeof configs.antiCheat.modules): void {
    if (eventHandlers[moduleName]) {
        for (const eventName in eventHandlers[moduleName]) {
            if (eventHandlers[moduleName].hasOwnProperty(eventName)) {
                //ここでは何もしない
            }
        }
        // モジュールのハンドラ情報を削除
        delete eventHandlers[moduleName];
    }
}


function runTick(): void {
    currentTick++;
    if (!monitoring) return;


    if (currentTick - lastTpsCheck >= tpsCheckInterval) {
        lastTpsCheck = currentTick;
        checkTpsAndDisableModules();
    }

    for (const player of world.getPlayers()) {
        if (!playerDataManager.has(player) || player.hasTag("bypass")) continue;

        addPositionHistory(player, playerDataManager);

        if (playerDataManager.getData(player, "isFrozen")) {
            player.teleport(player.location, { dimension: player.dimension });
        } else {
            // 各モジュールの検出関数を呼び出す
            executeDetectionModules(player);
        }
    }
}
/**
 * 有効な各モジュールの検出関数を実行する
 * @param {Player} player
 */
function executeDetectionModules(player: Player): void {
    const currentTime = Date.now();

    if (configs.antiCheat.modules.xray && !disabledModules.includes("xray")) {
        Xray.detectXrayOnSight(player, configs, playerDataManager);
        cleanupSuspiciousBlocks(player, currentTime, playerDataManager); // Xrayが有効な時だけクリーンアップ
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
    updateEnderPearlInterval(player, playerDataManager)
}

function checkTpsAndDisableModules(): void {
    if (tps < 10) {
        const modulesToDisable: (keyof typeof configs.antiCheat.modules)[] = [];

        // 各モジュールについて、無効化が必要かどうかをチェックし、必要なら配列に追加
        for (const moduleName in configs.antiCheat.modules) {
            if (configs.antiCheat.modules.hasOwnProperty(moduleName)) {
                const typedModuleName = moduleName as keyof typeof configs.antiCheat.modules;
                if (configs.antiCheat.modules[typedModuleName] && !disabledModules.includes(typedModuleName)) {
                    modulesToDisable.push(typedModuleName);
                }
            }
        }

        if (modulesToDisable.length > 0) {
            disabledModules.push(...modulesToDisable);
            world.sendMessage(`§c現在ワールドのTPSが${tps}の為緊急停止し\nモジュール ${modulesToDisable.join(", ")} を一時的に無効化しました。`);
            // モジュールを無効化（イベントハンドラの登録解除）
            modulesToDisable.forEach(module => unregisterModule(module));
            modulesToDisable.forEach(module => {
                if (module === "killAura") {
                    world.afterEvents.entityHurt.unsubscribe(handleEntityHurt);
                } else if (module === "xray") {
                    world.beforeEvents.playerBreakBlock.unsubscribe(handlePlayerBreakBlock);
                } else if (module === "spam") {
                    world.beforeEvents.chatSend.unsubscribe(handleChatSend);
                }
            })
        }

    } else if (tps >= 15) {
        if (disabledModules.length > 0) {
            const modulesToEnable = [...disabledModules];
            disabledModules = [];
            world.sendMessage(`§aワールドのTPSが回復した為、モジュール ${modulesToEnable.join(", ")} を再度有効化しました。`);
            // モジュールを有効化（イベントハンドラの再登録）
            modulesToEnable.forEach(module => {
                // ここで、モジュールを再度初期化（イベントハンドラを登録）
                initializeModule(module);
            });
        }
    }
}


// 各モジュールの初期化関数

const handleEntityHurt = (event: EntityHurtAfterEvent) => {
    if (!configs.antiCheat.enabled) return;

    const hurtEntity = event.hurtEntity;
    if (hurtEntity instanceof Player) {
        if (!playerDataManager.has(hurtEntity)) playerDataManager.initialize(hurtEntity);
        playerDataManager.updateData(hurtEntity, "recentlyUsedEnderPearl", true);
        playerDataManager.updateData(hurtEntity, "enderPearlInterval", configs.antiCheat.enderPearlCooldown);
    }

    const attackingPlayer = event.damageSource.damagingEntity as Player;
    if (attackingPlayer && event.hurtEntity instanceof Player && event.damageSource.cause === 'entityAttack') {
        const killAuraResult = KillAura.detectKillAura(attackingPlayer, event, playerDataManager, getPlayerCPS);
        if (killAuraResult) handleCheatDetection(attackingPlayer, killAuraResult, configs, playerDataManager);
    }
}

function initializeKillAura(): void {
    registerModule("killAura", {
        afterEntityHurt: handleEntityHurt
    });
    eventHandlers["killAura"]["afterEntityHurt"] = world.afterEvents.entityHurt.subscribe(handleEntityHurt);
}

const handlePlayerBreakBlock = (event: any) => {
    if (!configs.antiCheat.enabled) return;
    Xray.handleBlockBreak(event, playerDataManager, configs);
}

function initializeXray(): void {
    registerModule("xray", {
        beforePlayerBreakBlock: handlePlayerBreakBlock
    });
    eventHandlers["xray"]["beforePlayerBreakBlock"] = world.beforeEvents.playerBreakBlock.subscribe(handlePlayerBreakBlock);
}

const handleChatSend = (event: any) => {
    if (!configs.antiCheat.enabled || event.sender.hasTag("bypass")) return;
    Spam.detectSpam(event, playerDataManager, configs);
}

function initializeSpam(): void {
    registerModule("spam", {
        beforeChatSend: handleChatSend
    });
    eventHandlers["spam"]["beforeChatSend"] = world.beforeEvents.chatSend.subscribe(handleChatSend);
}

// 他のモジュールも同様に初期化関数を作成
function initializeModule(moduleName: keyof typeof configs.antiCheat.modules): void {
    switch (moduleName) {
        case "killAura":
            initializeKillAura();
            break;
        case "xray":
            initializeXray();
            break;
        case "spam":
            initializeSpam();
            break;
        case "airJump":
        case "speed":
        case "editionFake":
            break;
    }
}


world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source as Player;
    const item = event.itemStack;

    if (player && item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
        if (!playerDataManager.has(player)) playerDataManager.initialize(player);

        playerDataManager.updateData(player, "recentlyUsedEnderPearl", true);
        playerDataManager.updateData(player, "enderPearlInterval", 20 * 9);
    }
});



export function AddNewPlayers(): void {
    if (monitoring) {
        world.getPlayers().forEach((p) => {
            if (!playerDataManager.has(p)) {
                playerDataManager.initialize(p);
            }
        });
    }
    system.runTimeout(AddNewPlayers, 20 * 60);
}

function freezePlayer(player: Player): void {
    if (!playerDataManager.has(player)) playerDataManager.initialize(player)

    playerDataManager.updateData(player, "isFrozen", true);
    playerDataManager.updateData(player, "originalGamemode", player.getGameMode());
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
                // すべてのモジュールのイベントハンドラを登録解除
                for (const moduleName in configs.antiCheat.modules) {
                    if (configs.antiCheat.modules.hasOwnProperty(moduleName)) {
                        unregisterModule(moduleName as keyof typeof configs.antiCheat.modules);
                    }
                }
                if (eventHandlers["killAura"] && eventHandlers["killAura"]["afterEntityHurt"]) {
                    world.afterEvents.entityHurt.unsubscribe(handleEntityHurt);
                }
                if (eventHandlers["xray"] && eventHandlers["xray"]["beforePlayerBreakBlock"]) {
                    world.beforeEvents.playerBreakBlock.unsubscribe(handlePlayerBreakBlock);
                }
                if (eventHandlers["spam"] && eventHandlers["spam"]["beforeChatSend"]) {
                    world.beforeEvents.chatSend.unsubscribe(handleChatSend);
                }
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
                        // モジュールの状態が変わったので、イベントハンドラの登録状態を更新
                        if (configs.antiCheat.modules[moduleName]) {
                            initializeModule(moduleName); // モジュールを有効化（初期化）
                        } else {
                            if (moduleName === "killAura") {
                                unregisterModule("killAura");
                                world.afterEvents.entityHurt.unsubscribe(handleEntityHurt);
                            } else if (moduleName === "xray") {
                                unregisterModule("xray");
                                world.beforeEvents.playerBreakBlock.unsubscribe(handlePlayerBreakBlock);
                            } else if (moduleName === "spam") {
                                unregisterModule("spam")
                                world.beforeEvents.chatSend.unsubscribe(handleChatSend);
                            }
                        }
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

    // 有効なモジュールを初期化（イベントハンドラを登録）
    for (const moduleName in configs.antiCheat.modules) {
        if (configs.antiCheat.modules.hasOwnProperty(moduleName)) {
            const typedModuleName = moduleName as keyof typeof configs.antiCheat.modules;
            if (configs.antiCheat.modules[typedModuleName]) {
                initializeModule(typedModuleName);
            }
        }
    }

    console.warn('AntiCheat initialized.');
}