import { c, getGamemode } from "../Modules/Util";
import { registerCommand, verifier } from "../Modules/Handler";
import { Player, world, system, Vector3, Entity } from "@minecraft/server";

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 0, // ペナルティまでの検知回数
    penaltyCooldown: 20 * 4, // ペナルティ後のクールダウン時間 (ティック)
    rollbackTicks: 20 * 2, // ロールバックするティック数
    clickTpThreshold: 25, // ClickTP 判定距離 (ブロック)
    maxDistance: 18,
    speedThreshold: 115, // 歩行速度の閾値 (ブロック/秒)
    //正当なテレポートを許可するための設定
    allowedTeleportTicks: 20 // テレポートとみなす最大ティック数
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
  penaltyCooldown: number; // ペナルティ後のクールダウン時間
  speed: number; // 現在の速度
  lastSpeedCheckTime: number; // 最後に速度をチェックした時間
  isTeleporting: boolean; // テレポートフラグを追加
  lastTeleportTime: number; // 最後にテレポートした時間
}

// ----------------------------------
// --- 関数 ---
// ----------------------------------

//死亡イベント
world.afterEvents.entityDie.subscribe((event) => {
  const player = event.deadEntity as Player;
  if (player && player.id) {
    delete playerData[player.id]; 
  }
});

// プレイヤーデータの初期化
function initializePlayerData(player: Player) {
  playerData[player.id] = {
    positionHistory: [player.location],
    lastTime: Date.now(),
    violationCount: 0,
    penaltyCooldown: 0,
    speed: 0,
    lastSpeedCheckTime: Date.now(),
    isTeleporting: false, 
    lastTeleportTime: 0,
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
    console.log(`[DEBUG] ${player.name} new position: ${player.location.x}, ${player.location.y}, ${player.location.z}`);
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
}

// SpeedHack検出
function detectSpeedHack(player: Player): { cheatType: string, speed?: number } | null {
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
        Math.pow(entity.location.z - player.location.z, 2)
      );
      return distance <= 5; // Check if within 5 blocks
    }
    return false;
  });

  // エリトラを使用中、または近くにボートがある場合は検知しない
  if (player.isGliding || isNearBoat) {
    return null;
  }

  const currentTime = Date.now();
  const deltaTime = (currentTime - data.lastSpeedCheckTime) / 1000; // 秒に変換

  // 移動距離の計算
  const previousPosition = data.positionHistory[data.positionHistory.length - 2];
  if (!previousPosition) return null; 
  const distance = Math.sqrt(
    Math.pow(player.location.x - previousPosition.x, 2) +
    Math.pow(player.location.y - previousPosition.y, 2) +
    Math.pow(player.location.z - previousPosition.z, 2)
  );

  // 速度の計算
  const speed = distance / deltaTime;

  // SpeedHack検出
  if (speed > config.antiCheat.speedThreshold) {
    return { cheatType: "SpeedHack", speed: speed };
  }

  // データ更新
  data.speed = speed;
  data.lastSpeedCheckTime = currentTime;

  return null;
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
        Math.pow(entity.location.z - player.location.z, 2)
      );
      return distance <= 5; // Check if within 5 blocks
    }
    return false;
  });

  // エリトラを使用中、または近くにボートがある場合は検知しない
  if (player.isGliding || isNearBoat) {
    return null;
  }

  const clickTpDistance = Math.sqrt(
    Math.pow(player.location.x - data.positionHistory[0].x, 2) +
    Math.pow(player.location.y - data.positionHistory[0].y, 2) +
    Math.pow(player.location.z - data.positionHistory[0].z, 2)
  );

  // 最近テレポートした場合、正当なテレポートとみなす
  if (currentTick - data.lastTeleportTime <= config.antiCheat.allowedTeleportTicks) {
    return null;
  }

  if (clickTpDistance > config.antiCheat.clickTpThreshold) {
    return { cheatType: "ClickTP" };
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
      addPositionHistory(player);

      // ClickTP検出
      const clickTpDetection = detectClickTP(player);
      if (clickTpDetection) {
        handleCheatDetection(player, clickTpDetection);
      }

      // SpeedHack検出
      const speedHackDetection = detectSpeedHack(player);
      if (speedHackDetection) {
        handleCheatDetection(player, speedHackDetection);
      }

      // クールダウン処理
      if (playerData[playerId].penaltyCooldown > 0) {
        playerData[playerId].penaltyCooldown--;
      }

      // プレイヤーデータ更新
      playerData[playerId].lastTime = Date.now();
    }
  }

  system.run(runTick);
}

// チート検出時の処理
function handleCheatDetection(player: Player, detection: { cheatType: string, speed?: number }) {
  const data = playerData[player.id];
  if (data) {
    data.violationCount++;
    if (data.violationCount >= config.antiCheat.detectionThreshold) {
      let logMessage = `プレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;
      if (detection.cheatType === "SpeedHack" && detection.speed) {
        logMessage += ` (速度: ${detection.speed.toFixed(2)} blocks/sec)`;
      }
      console.warn(logMessage);
      world.sendMessage(logMessage);

      // ペナルティ処理とロールバック実行
      if (data.penaltyCooldown <= 0) {
        executeRollback(player);
        data.penaltyCooldown = config.antiCheat.penaltyCooldown;
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
        penaltyCooldown: data.penaltyCooldown,
      },
    ])
  );
  console.warn(`[DEBUG] playerData: ${JSON.stringify(simplifiedData, null, 2)}`);
}

// ----------------------------------
// --- コマンド登録 ---
// ----------------------------------

registerCommand({
  name: "anticheat",
  description: "チート対策を有効/無効にします",
  parent: false,
  maxArgs: 1,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands["anticheat"]), // 権限確認
  executor: (player: Player, args: string[]) => {
    if (args[0] === "on") {
      monitoring = true;
      world.getPlayers().forEach((p) => initializePlayerData(p));
      system.run(runTick);
      player.sendMessage("チート対策を有効にしました");
    } else if (args[0] === "off") {
      monitoring = false;
      player.sendMessage("チート対策を無効にしました");
    } else {
      player.sendMessage("無効な引数です。on または off を指定してください");
    }
  },
});