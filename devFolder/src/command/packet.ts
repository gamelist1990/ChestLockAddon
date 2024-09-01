import { c, getGamemode } from '../Modules/Util';
import { registerCommand, verifier } from '../Modules/Handler';
import { Player, world, system, Vector3, Entity,Effect } from '@minecraft/server';

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 1, // ペナルティまでの検知回数
    rollbackTicks: 20 * 2, // ロールバックするティック数
    clickTpThreshold: 25, // ClickTP 判定距離 (ブロック)
    allowedTeleportTicks: 0, // テレポートとみなす最大ティック数
    clickTpExclusionThreshold: 50, // この距離以上は検出除外
    freezeDuration: 20 * 60 * 60, // freeze時間 (ティック): 約1時間
  },
};

// ----------------------------------
// --- グローバル変数 ---
// ----------------------------------
let monitoring = false;
const playerData: { [playerId: string]: PlayerData } = {};
let currentTick = 0;

// ----------------------------------
// --- プレイヤーデータ構造 ---
// ----------------------------------
interface PlayerData {
  positionHistory: Vector3[]; // 位置履歴
  lastTime: number; // 最後に位置を記録した時間
  violationCount: number; // 違反回数
  isTeleporting: boolean; // テレポートフラグを追加
  lastTeleportTime: number; // 最後にテレポートした時間
  isFrozen: boolean; // freezeフラグ
  freezeStartTime: number; // freeze開始時間
}

// ----------------------------------
// --- 関数 ---
// ----------------------------------

//死亡イベント
world.afterEvents.entityDie.subscribe((event) => {
  const player = event.deadEntity as Player;
  if (player && player.id) {
    delete playerData[player.id];
    system.runTimeout(() => {
      world.getPlayers().forEach((p) => {
        if (!playerData[p.id]) {
          initializePlayerData(p);
        }
      });
    }, 20 * 3);
  }

});

// プレイヤーデータの初期化
function initializePlayerData(player: Player) {
  playerData[player.id] = {
    positionHistory: [player.location],
    lastTime: Date.now(),
    violationCount: 0,
    isTeleporting: false,
    lastTeleportTime: 0,
    isFrozen: false,
    freezeStartTime: 0,
  };
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) を監視しています`);
}

// 位置履歴に追加
function addPositionHistory(player: Player) {
  const data = playerData[player.id];
  if (!data) return;

  data.positionHistory.push(player.location);

  // デバッグログ出力
  if (config.debugMode) {
    console.log(
      `[DEBUG] ${player.name} new position: ${player.location.x}, ${player.location.y}, ${player.location.z}`,
    );
  }

  // 一定時間以上前の履歴は削除
  const historyLimit = config.antiCheat.rollbackTicks + 1;
  if (data.positionHistory.length > historyLimit) {
    data.positionHistory.shift();
  }
}

export function handleTeleportCommand(player: Player) {
  const data = playerData[player.id];
  if (data) {
    data.isTeleporting = true;
    data.lastTeleportTime = currentTick; // テレポート時間を記録
    // 一定時間後にテレポートフラグをリセット
    system.runTimeout(() => {
      data.isTeleporting = false;
    }, 2 * 20); // 1秒後にリセット (20ティック)
  }
}

// ロールバック実行
function executeRollback(player: Player) {
  const data = playerData[player.id];
  if (!data) return;

  const rollbackIndex = data.positionHistory.length - config.antiCheat.rollbackTicks - 1;
  if (rollbackIndex >= 0) {
    const rollbackPosition = data.positionHistory[rollbackIndex];
    player.teleport(rollbackPosition, { dimension: player.dimension });
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
  }

  // positionHistory, lastTime, lastTeleportTime をリセット
  data.positionHistory = [player.location];
  data.lastTime = Date.now();
  data.lastTeleportTime = 0;
}


function hasAnyEffectExcept(player: Player, excludedEffects: string[]): boolean {
  // プレイヤーのエフェクトを取得
  const effects: Effect[] = player.getEffects();

  // プレイヤーが除外されたエフェクト以外のエフェクトを持っているかどうかを確認
  return effects.some((effect: Effect) => !excludedEffects.includes(effect.typeId));
}

//Freeze
function executeFreeze(player: Player) {
  const data = playerData[player.id];
  if (!data) return;

  data.isFrozen = true;
  data.freezeStartTime = currentTick;

  // プレイヤーの現在の位置を取得して、y座標を1000に変更
  const freezeLocation = {
    x: player.location.x,
    y: 1000,
    z: player.location.z,
  };

  player.teleport(freezeLocation, { dimension: player.dimension });
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeしました`);

  // 一定時間後にfreeze解除
  system.runTimeout(() => {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);

    // positionHistory, lastTime, lastTeleportTime をリセット
    data.positionHistory = [player.location];
    data.lastTime = Date.now();
    data.lastTeleportTime = 0;
  }, config.antiCheat.freezeDuration);
}

// ClickTP検出 (正当なテレポートを考慮)
function detectClickTP(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting) return null;

  if (getGamemode(player.name) === 1) {
    return null;
  }

  // Get all entities in the overworld
  const entities = world.getDimension('overworld').getEntities();

  // Check for nearby boats
  const isNearBoat = entities.some((entity: Entity) => {
    if (entity.typeId === 'minecraft:boat') {
      const distance = Math.sqrt(
        Math.pow(entity.location.x - player.location.x, 2) +
        Math.pow(entity.location.y - player.location.y, 2) +
        Math.pow(entity.location.z - player.location.z, 2),
      );
      return distance <= 5; // Check if within 5 blocks
    }
    return false;
  });

  // エリトラを使用中、または近くにボートがある場合は検知しない
  if (player.isGliding || isNearBoat) {
    return null;
  }

   // 落下中かどうかを判定
   const isFalling = player.getVelocity().y < 0 && !player.isOnGround;

   // 奈落への落下かどうかを判定
   if (player.location.y <= -64) {
    return null;
  }
 
   // 通常の落下中は検知しない
   if (isFalling) {
     return null;
   }

   const excludedEffects = [
    'minecraft:absorption',
    'minecraft:bad_omen',
    'minecraft:blindness',
    'minecraft:conduit_power',
    'minecraft:darkness',
    'minecraft:fatal_poison',
    'minecraft:fire_resistance',
    'minecraft:glowing',
    'minecraft:haste',
    'minecraft:health_boost',
    'minecraft:hunger',
    'minecraft:instant_damage',
    'minecraft:instant_health',
    'minecraft:invisibility',
    'minecraft:mining_fatigue',
    'minecraft:nausea',
    'minecraft:night_vision',
    'minecraft:poison',
    'minecraft:regeneration',
    'minecraft:resistance',
    'minecraft:saturation',
    'minecraft:slow_falling',
    'minecraft:slowness',
    'minecraft:strength',
    'minecraft:water_breathing',
    'minecraft:weakness',
    'minecraft:wither',
  ];

  if (hasAnyEffectExcept(player, excludedEffects)) {
    return null;
  } else {
  }

  

  const clickTpDistance = Math.sqrt(
    Math.pow(player.location.x - data.positionHistory[0].x, 2) +
    Math.pow(player.location.y - data.positionHistory[0].y, 2) +
    Math.pow(player.location.z - data.positionHistory[0].z, 2),
  );

  // 最近テレポートした場合、正当なテレポートとみなす
  if (currentTick - data.lastTeleportTime <= config.antiCheat.allowedTeleportTicks) {
    return null;
  }
  

  // ClickTP 検出除外範囲内かどうかを確認
  if (clickTpDistance >= config.antiCheat.clickTpExclusionThreshold) {
    return null; // 検出除外範囲内なので ClickTP とはみなさない
  }

  if (clickTpDistance > config.antiCheat.clickTpThreshold) {
    return { cheatType: '移動系のチート' };
  }

  return null;
}

// 毎ティック実行される処理
function runTick() {
  currentTick++;
  if (!monitoring) return;

  for (const playerId in playerData) {
    const player = world.getPlayers().find((p) => p.id === playerId);
    if (player) {
      // freeze中の場合は座標を固定
      if (playerData[playerId].isFrozen) {
        const freezeLocation = {
          x: player.location.x,
          y: 1000,
          z: player.location.z,
        };
        player.teleport(freezeLocation, { dimension: player.dimension });
      } else {
        addPositionHistory(player);

        // ClickTP検出
        const clickTpDetection = detectClickTP(player);
        if (clickTpDetection) {
          handleCheatDetection(player, clickTpDetection);
        }
      }

      // プレイヤーデータ更新
      playerData[playerId].lastTime = Date.now();
    }
  }

  system.run(runTick);
}

// チート検出時の処理
function handleCheatDetection(player: Player, detection: { cheatType: string }) {
  const data = playerData[player.id];
  if (data) {
    data.violationCount++;
    if (data.violationCount >= config.antiCheat.detectionThreshold) {
      let logMessage = `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;
      console.warn(logMessage);
      world.sendMessage(logMessage);

      // ペナルティ処理とロールバック実行
      if (data.violationCount >= config.antiCheat.detectionThreshold * 3) {
        executeFreeze(player);
      } else {
        executeRollback(player);
      }
    }
  }
}

// 簡潔なプレイヤーデータのログ出力
//@ts-ignore
function logPlayerData() {
  const simplifiedData = Object.fromEntries(
    Object.entries(playerData).map(([playerId, data]) => [
      playerId,
      {
        latestPosition: data.positionHistory[data.positionHistory.length - 1],
        lastTime: data.lastTime,
        violationCount: data.violationCount,
      },
    ]),
  );
  console.warn(`[DEBUG] playerData: ${JSON.stringify(simplifiedData, null, 2)}`);
}


export function RunAntiCheat() {
  monitoring = true;
  world.getPlayers().forEach((p) => initializePlayerData(p));
  system.run(runTick);
  AddNewPlayers();
  // 全プレイヤーにメッセージを送信
  console.warn('チート対策を有効にしました');
}

// 定期的に全プレイヤーを追加する関数
function AddNewPlayers() {
  if (monitoring) {
    world.getPlayers().forEach((p) => {
      if (!playerData[p.id]) {
        initializePlayerData(p);
      }
    });
  }
  system.runTimeout(AddNewPlayers, 20 * 60); // 5秒ごとに実行 (20ティック = 1秒)
}

function unfreezePlayer(player: Player) {
  const data = playerData[player.id];
  if (data && data.isFrozen) {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);

    // positionHistory, lastTime, lastTeleportTime をリセット
    data.positionHistory = [player.location];
    data.lastTime = Date.now();
    data.lastTeleportTime = 0;
  }
}

// ----------------------------------
// --- コマンド登録 ---
// ----------------------------------

registerCommand({
  name: 'anticheat',
  description: 'チート対策を有効/無効にします',
  parent: false,
  maxArgs: 2, // サブコマンド用に maxArgs を増やす
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands['anticheat']), // 権限確認
  executor: (player: Player, args: string[]) => {
    if (args[0] === 'on') {
      RunAntiCheat();
      AddNewPlayers();
    } else if (args[0] === 'off') {
      monitoring = false;
      player.sendMessage('チート対策を無効にしました');
    } else if (args[0] === 'unfreeze' && args.length === 2) { // unfreeze サブコマンド
      const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
      if (targetPlayer) {
        unfreezePlayer(targetPlayer);
        player.sendMessage(`プレイヤー ${targetPlayer.name} のfreezeを解除しました`);
      } else {
        player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
      }
    } else {
      player.sendMessage('無効な引数です。on, off, または unfreeze Playername を指定してください');
    }
  },
});