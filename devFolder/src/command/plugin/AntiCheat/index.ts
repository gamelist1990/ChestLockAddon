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

// 設定 (必要に応じて調整)
const configs = {
    debugMode: false,
    ver: 0.2,
    antiCheat: {
        enabled: true,
        detectionThreshold: 2,
        rollbackTicks: 20 * 3,
        freezeDuration: 20 * 10,
        xrayDetectionDistance: 10,
        enderPearlCooldown: 80, // エンダーパールのクールダウン設定
        modules: {
            airJump: false,
            speed: false,
            killAura: false,
            xray: false,
            spam: true,
            editionFake: true
        }
    },
};

// PlayerDataManager のインスタンスを作成
const playerDataManager = new PlayerDataManager();
let monitoring = false; // チート検出の監視状態
let currentTick = 0;    // 現在のティック数

// ティックごとの処理
function runTick(): void {
    currentTick++; // ティック数を更新
    if (!monitoring) return; // 監視が無効なら処理をスキップ

    const currentTime = Date.now(); // 現在時刻を取得

    // 全てのプレイヤーに対して処理
    for (const player of world.getPlayers()) {
        if (!playerDataManager.has(player) || player.hasTag("bypass")) continue; // プレイヤーデータがないか、バイパス対象ならスキップ

        const data = playerDataManager.get(player);
        if (!data) continue; // プレイヤーデータがなければスキップ
        if (!configs.antiCheat.enabled) return; // アンチチートが無効ならスキップ

        addPositionHistory(player, playerDataManager, configs); // 位置履歴を更新

        if (data.isFrozen) {
            //フリーズ中はプレイヤーを同じ場所にテレポートし続けることで移動を制限
            player.teleport(player.location, { dimension: player.dimension });
        } else {
            // 各モジュールの実行
            if (configs.antiCheat.modules.xray) {
                Xray.detectXrayOnSight(player, configs, playerDataManager); // Xray検出を実行
            }
            if (configs.antiCheat.modules.airJump) {
                const airJumpResult = AirJump.detectAirJump(player, playerDataManager); // AirJump検出を実行
                if (airJumpResult) handleCheatDetection(player, airJumpResult, configs, playerDataManager); // 検出結果を処理
            }
            if (configs.antiCheat.modules.speed) {
                const speedResult = Speed.detectSpeed(player, playerDataManager); // Speed検出を実行
                if (speedResult) handleCheatDetection(player, speedResult, configs, playerDataManager); // 検出結果を処理
            }
            if (configs.antiCheat.modules.editionFake) {
                const response = editionFake.detectEditionFake(player, playerDataManager); // EditionFake検出を実行
                if (response) handleCheatDetection(player, response, configs, playerDataManager);
            }

            cleanupSuspiciousBlocks(data, currentTime); // Xray検出の怪しいブロックデータをクリーンアップ
            updateEnderPearlInterval(player, playerDataManager); // エンダーパールのクールダウンを更新
        }
    }
}

// イベントリスナー (エンティティがダメージを受けた後)
world.afterEvents.entityHurt.subscribe((event: EntityHurtAfterEvent) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.killAura) return; // 監視が無効、アンチチートが無効、KillAuraが無効ならスキップ

    // ダメージを受けたエンティティがプレイヤーの場合
    const hurtEntity = event.hurtEntity;
    if (hurtEntity instanceof Player) {
        const data = playerDataManager.get(hurtEntity);
        if (data) {
            // エンダーパール使用後のクールダウンを設定
            data.recentlyUsedEnderPearl = true;
            data.enderPearlInterval = configs.antiCheat.enderPearlCooldown; // 設定ファイルからクールダウンを取得
            playerDataManager.update(hurtEntity, data);
        }
    }


    const attackingPlayer = event.damageSource.damagingEntity as Player; // ダメージを与えたエンティティを取得
    if (attackingPlayer && event.hurtEntity instanceof Player) { // 攻撃者がプレイヤーかつ、ダメージを受けた側がプレイヤーの場合
        if (event.damageSource.cause === 'entityAttack') { // ダメージの原因がエンティティ攻撃の場合
            const killAuraResult = KillAura.detectKillAura(attackingPlayer, event, playerDataManager, getPlayerCPS); 
            if (killAuraResult) handleCheatDetection(attackingPlayer, killAuraResult, configs, playerDataManager); // 検出結果を処理
        }
    }
});

// イベントリスナー (アイテム使用時)
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source as Player; // プレイヤーを取得
    const item = event.itemStack; // 使用したアイテムを取得

    // エンダーパールまたはウィンドチャージを使用した時の処理
    if (player && item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
        const data = playerDataManager.get(player);
        if (!data) {
            playerDataManager.initialize(player); // プレイヤーデータがなければ初期化
            return; // 初期化直後は return
        }

        playerDataManager.update(player, { recentlyUsedEnderPearl: true, enderPearlInterval: 20 * 9 }); // エンダーパールのクールダウンを設定
    }
});

// イベントリスナー (ブロック破壊前)
world.beforeEvents.playerBreakBlock.subscribe((event: any) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.xray) return; // 監視が無効、アンチチートが無効、Xrayが無効ならスキップ
    Xray.handleBlockBreak(event, playerDataManager, configs); // Xray検出のブロック破壊を処理
});

// イベントリスナー (チャット送信前)
world.beforeEvents.chatSend.subscribe((event: any) => {
    if (!monitoring || !configs.antiCheat.enabled || !configs.antiCheat.modules.spam) return; // 監視が無効、アンチチートが無効、スパム検出が無効ならスキップ
    Spam.detectSpam(event, playerDataManager, configs); // スパム検出を実行
});

// 新規プレイヤーを追加
export function AddNewPlayers(): void {
    if (monitoring) { // 監視が有効な場合のみ実行
        world.getPlayers().forEach((p) => { // 全てのプレイヤーに対して
            if (!playerDataManager.get(p)) { // プレイヤーデータがない場合
                playerDataManager.initialize(p); // プレイヤーデータを初期化
            }
        });
    }
    system.runTimeout(AddNewPlayers, 20 * 60); // 1分ごとに新規プレイヤーを追加
}

// プレイヤーをフリーズ
function freezePlayer(player: Player): void {
    const data = playerDataManager.get(player);
    if (!data) return; // プレイヤーデータがなければスキップ

    playerDataManager.update(player, { isFrozen: true, originalGamemode: player.getGameMode() }); // フリーズ状態を更新
    player.setGameMode(GameMode.adventure); // ゲームモードをアドベンチャーに変更
    player.teleport(player.location, { dimension: player.dimension }); // 位置を固定

    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をフリーズさせました`); // コンソールにログを表示
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
            case 'on': // チート対策を有効にする
                initializeAntiCheat();
                AddNewPlayers();
                player.sendMessage('チート対策を有効にしました');
                break;
            case 'off': // チート対策を無効にする
                monitoring = false;
                player.sendMessage('チート対策を無効にしました');
                break;
            case 'unfreeze': // プレイヤーのフリーズを解除する
                if (args.length === 2) {
                    const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
                    if (targetPlayer) {
                        unfreezePlayer(targetPlayer, playerDataManager); // フリーズを解除
                        player.sendMessage(`プレイヤー ${targetPlayer.name} のフリーズを解除しました`);
                    } else {
                        player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
                    }
                } else {
                    player.sendMessage('無効な引数です。unfreeze <プレイヤー名> を指定してください');
                }
                break;
            case 'freeze': // プレイヤーをフリーズする
                if (args.length === 2) {
                    const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
                    if (targetPlayer) {
                        freezePlayer(targetPlayer); // プレイヤーをフリーズ
                        player.sendMessage(`プレイヤー ${targetPlayer.name} をフリーズさせました`);
                    } else {
                        player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
                    }
                } else {
                    player.sendMessage('無効な引数です。freeze <プレイヤー名> を指定してください');
                }
                break;
            case 'toggle': // モジュールを切り替える
                if (args.length === 2) {
                    // モジュール名を小文字に変換
                    const moduleName = args[1].toLowerCase() as keyof typeof configs.antiCheat.modules;
                    if (moduleName in configs.antiCheat.modules) { // モジュールが存在する場合
                        configs.antiCheat.modules[moduleName] = !configs.antiCheat.modules[moduleName]; // モジュールの状態を切り替える
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
    // 全てのプレイヤーに対してプレイヤーデータを初期化
    world.getPlayers().forEach(player => playerDataManager.initialize(player));
    monitoring = true; // 監視を開始
    system.runInterval(runTick, 1); // ティックごとの処理を開始
    console.warn('AntiCheat initialized.');
}