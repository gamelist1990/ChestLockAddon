import { c, getGamemode } from "../Modules/Util";
import { registerCommand, verifier } from "../Modules/Handler";
import { Player, world, system, Vector3, Entity } from "@minecraft/server";

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 1, // ペナルティまでの検知回数
    penaltyCooldown: 20 * 6, // ペナルティ後のクールダウン時間 (ティック)
    rollbackTicks: 20 * 2, // ロールバックするティック数
    clickTpThreshold: 25, // ClickTP 判定距離 (ブロック)
    noPacketThreshold: 20 * 3, // NoPacket 判定時間 (ティック)
    maxDistance: 18,
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
  lastPacketTime: number; // 最後にパケットを受信した時間
  lastTime: number; // 最後に位置を記録した時間
  violationCount: number; // 違反回数
  penaltyCooldown: number; // ペナルティ後のクールダウン時間
}

// ----------------------------------
// --- 関数 ---
// ----------------------------------

// プレイヤーデータの初期化
function initializePlayerData(player: Player) {
  playerData[player.id] = {
    positionHistory: [player.location],
    lastPacketTime: Date.now(),
    lastTime: Date.now(),
    violationCount: 0,
    penaltyCooldown: 0,
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


// チート検出
function detectCheat(player: Player): { cheatType: string, speed?: number } | null {
  const data = playerData[player.id];
  if (!data) return null;

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

  // SpeedHack 検出
  if (currentTick % 5 === 0) {
    const firstPosition = data.positionHistory[0];
    const distance = Math.sqrt(
      Math.pow(player.location.x - firstPosition.x, 2) +
      Math.pow(player.location.y - firstPosition.y, 2) +
      Math.pow(player.location.z - firstPosition.z, 2)
    );
    const timeElapsed = (currentTime - data.lastTime) / 1000;
    const speed = distance / timeElapsed;

    // デバッグログ出力
    if (config.debugMode) {
      console.warn(`[DEBUG] ${player.name} distance: ${distance.toFixed(2)} blocks, timeElapsed: ${timeElapsed.toFixed(2)} sec, speed: ${speed.toFixed(2)} blocks/sec configData ${config.antiCheat.maxDistance}`);
    }
    const truncatedDistance = Math.floor(distance);

    if (truncatedDistance > config.antiCheat.maxDistance) {
      return { cheatType: "SpeedHack", speed: speed }; // 速度情報を含むオブジェクトを返す
    }
    data.lastTime = currentTime;
  }

  // ClickTP 検出
  const clickTpDistance = Math.sqrt(
    Math.pow(player.location.x - data.positionHistory[0].x, 2) +
    Math.pow(player.location.y - data.positionHistory[0].y, 2) +
    Math.pow(player.location.z - data.positionHistory[0].z, 2)
  );
  if (clickTpDistance > config.antiCheat.clickTpThreshold) {
    return { cheatType: "ClickTP" };
  }

  // NoPacket 検出
  if (currentTime - data.lastPacketTime > config.antiCheat.noPacketThreshold) {
    if (config.debugMode) {
      console.warn(`[DEBUG] ${player.name} lastPacketTime: ${data.lastPacketTime}, currentTime: ${currentTime}`);
    }
    return { cheatType: "NoPacket" };
  }

  return null;
}

// ----------------------------------
// --- イベントハンドラ ---
// ----------------------------------

// 毎ティック実行される処理
function runTick() {
  currentTick++;
  if (!monitoring) return;

  for (const playerId in playerData) {
    const player = world.getPlayers().find((p) => p.id === playerId);
    if (player) {
      addPositionHistory(player);
      const cheatDetection = detectCheat(player); // チート検出のみ実行

      // チート検出のログを表示し、プレイヤーにメッセージを送信
      if (cheatDetection) {
        const data = playerData[player.id];
        if (data) {
          data.violationCount++;
          if (data.violationCount >= config.antiCheat.detectionThreshold) {
            let logMessage = `プレイヤー ${player.name} (ID: ${player.id}) が ${cheatDetection.cheatType} を使用している可能性があります`;
            if (cheatDetection.cheatType === "SpeedHack" && cheatDetection.speed) {
              logMessage += ` (速度: ${cheatDetection.speed.toFixed(2)} blocks/sec)`;
            }
            console.warn(logMessage);
            player.sendMessage(logMessage);

            // ペナルティ処理とロールバック実行
            if (data.penaltyCooldown <= 0) {
              executeRollback(player);
              data.penaltyCooldown = config.antiCheat.penaltyCooldown;
            }
          }
        }
      }

      // クールダウン処理
      if (playerData[playerId].penaltyCooldown > 0) {
        playerData[playerId].penaltyCooldown--;
      }

      // プレイヤーデータ更新
      playerData[playerId].lastPacketTime = Date.now();
      playerData[playerId].lastTime = Date.now();
    }
  }

  system.run(runTick);
}




// 簡潔なプレイヤーデータのログ出力
//@ts-ignore
function logPlayerData() {
  const simplifiedData = Object.fromEntries(
    Object.entries(playerData).map(([playerId, data]) => [
      playerId,
      {
        latestPosition: data.positionHistory[data.positionHistory.length - 1],
        lastPacketTime: data.lastPacketTime,
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
