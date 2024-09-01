import { c, getGamemode } from '../Modules/Util';
import { registerCommand, verifier } from '../Modules/Handler';
import { Player, world, system, Vector3, Entity, Effect } from '@minecraft/server';

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 1, // ペナルティまでの検知回数
    rollbackTicks: 20 * 2, // ロールバックするティック数
    clickTpThreshold: 25, // ClickTP 判定距離 (ブロック)
    clickTpExclusionThreshold: 50, // この距離以上は検出除外
    freezeDuration: 20 * 60 * 60, // freeze時間 (ティック): 約1時間
    betasystem:false,
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
  isJumping:boolean;
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
    isJumping: false,
  };
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) を監視しています`);
}

function addPositionHistory(player: Player) {
  const data = playerData[player.id];
  if (!data) return;

  // エリトラを使用中の場合、位置履歴をクリアし、クールタイムを設定
  if (player.isGliding) {
    data.isTeleporting = true; // クールタイム中はテレポート扱いにする
    // クールタイム終了後にテレポートフラグをリセット
    system.runTimeout(() => {
      data.isTeleporting = false;
    }, 3 * 20); // 3秒後にリセット (20ティック = 1秒)
  } else {
    data.positionHistory.push(player.location);
  }

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

   //誤検知少ない版
   // const positionHistory = data.positionHistory;
   // const recentPosition = positionHistory[positionHistory.length - 1];
   //const previousPosition = positionHistory[positionHistory.length - 2];
   //const yVelocity = recentPosition.y - previousPosition.y;
   //const isFalling = yVelocity < -0.5 && !player.isOnGround;
   //保留

   const isFalling = player.getVelocity().y < -0.5 && !player.isOnGround;
   const isSprintingInAir = player.isSprinting && !player.isOnGround;


   // 奈落への落下かどうかを判定
   if (player.location.y <= -64) {
    return null;
  }
 
   // 通常の落下中は検知しない
   if (isFalling || isSprintingInAir) {
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
  

  // ClickTP 検出除外範囲内かどうかを確認
  if (clickTpDistance >= config.antiCheat.clickTpExclusionThreshold) {
    return null; // 検出除外範囲内なので ClickTP とはみなさない
  }

  if (clickTpDistance > config.antiCheat.clickTpThreshold) {
    return { cheatType: '移動系のチート' };
  }

  return null;
}

function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting) return null;

  if (player.isGliding) {
    return null;
  }
  if (getGamemode(player.name) === 1) {
    return null;
  }

  // プレイヤーがジャンプしたかどうかを記録
  const isJumping = player.isJumping;
  const isOnGround = player.isOnGround;

  // ログを追加して状態を確認
  //console.warn(`[DEBUG] Player: ${player.name}, isJumping: ${isJumping}, isOnGround: ${isOnGround}, isJumpingFlag: ${data.isJumping}`);

  // プレイヤーの位置履歴を取得
  const positionHistory = data.positionHistory;
  const recentPosition = positionHistory[positionHistory.length - 1];
  const previousPosition = positionHistory[positionHistory.length - 2];

  // プレイヤーがジャンプした場合、ジャンプフラグを立てる
  if (isJumping && recentPosition && previousPosition && recentPosition.y > previousPosition.y) {
    data.isJumping = true;
    //console.warn(`[DEBUG] Player: ${player.name} has started jumping.`);
  }

  // プレイヤーが地面に着地した場合、ジャンプフラグをリセット
  if (isOnGround && data.isJumping) {
    data.isJumping = false;
   // console.log(`[DEBUG] Player: ${player.name} has landed.`);
    return null;
  }

  // プレイヤーがジャンプフラグを立てたまま地面に着地せずに再度ジャンプした場合、AirJumpとみなす
  if (!isOnGround && data.isJumping && isJumping) {
    if (recentPosition && previousPosition) {
      const jumpHeight = recentPosition.y - previousPosition.y;
      if (jumpHeight > 1.25) { // 通常のジャンプの高さを超える場合
       //console.warn(`[DEBUG] Player: ${player.name} is detected for AirJump.`);
        return { cheatType: 'AirJump' };
      }
    }
  }

  return null;
}

function detectESP(player: Player): { cheatType: string } | null {
  const viewDirection = player.getViewDirection();
  const playerDimension = player.dimension;

  // 他のプレイヤーを取得
  const otherPlayers = playerDimension.getPlayers().filter(p => p !== player); // 自分自身を除外

  for (const otherPlayer of otherPlayers) {
    // 距離を手動で計算
    const distance = Math.sqrt(
      Math.pow(otherPlayer.location.x - player.location.x, 2) +
        Math.pow(otherPlayer.location.y - player.location.y, 2) +
        Math.pow(otherPlayer.location.z - player.location.z, 2),
    );

    // directionToOtherPlayerを手動で計算
    const directionToOtherPlayer = {
      x: (otherPlayer.location.x - player.location.x) / distance,
      y: (otherPlayer.location.y - player.location.y) / distance,
      z: (otherPlayer.location.z - player.location.z) / distance,
    };

    // 2つのベクトルの内積を計算
    const dotProduct =
      viewDirection.x * directionToOtherPlayer.x +
      viewDirection.y * directionToOtherPlayer.y +
      viewDirection.z * directionToOtherPlayer.z;

    // 内積から角度を計算 (ラジアン)
    const angle = Math.acos(dotProduct);

    // 視点方向の変化量を計算
    const viewDirectionChange = Math.abs(angle - previousAngle);

    // プレイヤーと他のプレイヤーの間に指定されたブロックがあるか判定
    const targetBlockIds = ['minecraft:stone', 'minecraft:grass', 'minecraft:dirt'];
    const isPlayerBehindTargetBlocks = isPlayerBehindSpecificBlocks(player, otherPlayer, targetBlockIds);

    // 視点方向の変化量が閾値を超えた場合
    if (viewDirectionChange > 0.06) {
      // 初回検知時
      if (!espSuspiciousTime[player.id]) {
        espSuspiciousTime[player.id] = Date.now();
        continue; // 監視を開始
      } else {
        // 0.5秒以内に再度視点方向の変化量が閾値を超えた場合
        if (Date.now() - espSuspiciousTime[player.id] <= 750) {
          // 角度が一定値以下、かつ間に指定されたブロックがある場合、ESPと判定
          if (angle < 0.4 && isPlayerBehindTargetBlocks) {
            delete espSuspiciousTime[player.id]; // 監視時間をリセット
            return { cheatType: 'ESP (BETA SYSTEM) 【誤検知の可能性もあります】' }; // ESPとして検知
          }
        } else {
          // 0.5秒以上経過している場合は、監視をリセット
          delete espSuspiciousTime[player.id];
        }
      }
    }

    // 角度を保存
    previousAngle = angle;
  }

  return null;
}

let previousAngle = 0; // 1つ前のプレイヤーに対する角度を保存するための変数
const espSuspiciousTime: { [playerId: string]: number } = {}; // プレイヤーごとのESP検知時間

// 指定されたブロックのいずれかの背後にプレイヤーがいるか判定する関数
function isPlayerBehindSpecificBlocks(player: Player, otherPlayer: Entity, targetBlockIds: string[]): boolean {
  const dimension = world.getDimension('overworld');
  const step = 0.25; // ブロック判定の刻み幅
  const worldHeight = 256; // ワールドの高さ
  const maxAngle = 2; // プレイヤーの視線方向からの最大角度 (度)

  const playerLocation = player.location;
  const otherPlayerLocation = otherPlayer.location;

  // プレイヤーの目線の高さ1ブロック分を加算
  playerLocation.y += 1;

  // プレイヤーの視線方向ベクトル
  const viewDirection = player.getViewDirection();

  // プレイヤーから他のプレイヤーへのベクトル
  const directionToOtherPlayer = {
    x: otherPlayerLocation.x - playerLocation.x,
    y: otherPlayerLocation.y - playerLocation.y,
    z: otherPlayerLocation.z - playerLocation.z,
  };

  // 2つのベクトルの内積を計算
  const dotProduct = viewDirection.x * directionToOtherPlayer.x + viewDirection.y * directionToOtherPlayer.y + viewDirection.z * directionToOtherPlayer.z;

  // 内積から角度を計算 (ラジアン)
  const angle = Math.acos(dotProduct / (Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2) * Math.sqrt(directionToOtherPlayer.x ** 2 + directionToOtherPlayer.y ** 2 + directionToOtherPlayer.z ** 2)));

  // 角度を度に変換
  const angleInDegrees = angle * 180 / Math.PI;

  // 角度が最大角度を超えている場合は、ブロック判定を行わない
  if (angleInDegrees > maxAngle) {
    return false;
  }

  // start から end まで step 刻みでブロックの中央をチェック
  for (let i = 0; i <= 1; i += step) {
    const x = playerLocation.x + directionToOtherPlayer.x * i;
    const y = playerLocation.y + directionToOtherPlayer.y * i;
    const z = playerLocation.z + directionToOtherPlayer.z * i;

    // Y座標がワールドの高さを超える場合は、ワールドの高さに制限
    const clampedY = Math.min(y, worldHeight - 1);

    // ブロックの中央座標を計算
    const blockLocation = {
      x: Math.floor(x) + 0.5,
      y: Math.floor(clampedY) + 0.5,
      z: Math.floor(z) + 0.5,
    };

    const block = dimension.getBlock(blockLocation);

    // ブロックが存在し、指定されたブロックのいずれかである場合、true を返す
    if (block && targetBlockIds.includes(block.type.id)) {
      return true;
    }
  }

  return false; // 指定されたブロックのいずれもなければ false
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

        // AirJump検出
        const airJumpDetection = detectAirJump(player);
        if (airJumpDetection) {
          handleCheatDetection(player, airJumpDetection);
        }


        //ESP検出システム
        if (config.antiCheat.betasystem == true) {
          const espDetection = detectESP(player);
        if (espDetection) {
          handleCheatDetection(player, espDetection);
        }
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
      if (data.violationCount >= config.antiCheat.detectionThreshold * 5) {
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