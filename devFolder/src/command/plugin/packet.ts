import { c, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Entity, Effect, BlockRaycastOptions, Block, Dimension } from '@minecraft/server';

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 1, // ペナルティまでの検知回数
    rollbackTicks: 3 * 20, // ロールバック
    clickTpThreshold: 20, // ClickTP 判定距離
    clickTpExclusionThreshold: 30,
    freezeDuration: 20 * 10, // freeze時間
    maxSpeedThreshold: 6, // 最大速度
    betasystem: true,
    xrayDetectionDistance: 5, // Xray検知距離 (5ブロック以上)
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
interface XrayData {
  suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number; } }; // タイムスタンプとカウントを含むオブジェクトを格納
}

interface PlayerData {
  positionHistory: Vector3[];
  lastTime: number;
  violationCount: number;
  isTeleporting: boolean;
  lastTeleportTime: number;
  isFrozen: boolean;
  freezeStartTime: number;
  isJumping: boolean;
  jumpCounter: number;
  recentlyUsedEnderPearl: boolean;
  enderPearlInterval: any;
  lastPosition: Vector3 | null; // 1ティック前の位置を保存
  xrayData: XrayData; // Xray検知用データ
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
    jumpCounter: 0,
    enderPearlInterval: null,
    recentlyUsedEnderPearl: false,
    lastPosition: null,
    xrayData: {
      suspiciousBlocks: {},
    },
  };
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) を監視しています`);
}

function addPositionHistory(player: Player) {
  const data = playerData[player.id];
  if (!data) return;

  if (player.isGliding) {
    data.isTeleporting = true;
    // クールタイム終了後にテレポートフラグをリセット
    system.runTimeout(() => {
      data.isTeleporting = false;
    }, 3 * 20);
  } else {
    data.positionHistory.push(player.location);
  }

  // デバッグログ出力
  if (config.debugMode) {
    console.log(
      `[DEBUG] ${player.name} new position: ${player.location.x}, ${player.location.y}, ${player.location.z}`,
    );
  }

  const historyLimit = config.antiCheat.rollbackTicks + 1;
  if (data.positionHistory.length > historyLimit) {
    data.positionHistory.shift();
  }
}

export function handleTeleportCommand(player: Player) {
  const data = playerData[player.id];
  if (data) {
    data.isTeleporting = true;
    data.lastTeleportTime = currentTick;
    system.runTimeout(() => {
      data.isTeleporting = false;
    }, 1 * 20);
  }
}

// ロールバック実行
function executeRollback(player: Player) {
  const data = playerData[player.id];
  if (!data) return;

  const rollbackIndex = data.positionHistory.length - config.antiCheat.rollbackTicks - 1;
  if (rollbackIndex >= 0) {
    const rollbackPosition = data.positionHistory[rollbackIndex];
    system.run(() => { // 1 tick 遅延させる
      player.teleport(rollbackPosition, { dimension: player.dimension });
      console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
    });
  }

  //ResetData
  data.positionHistory = [player.location];
  data.lastTime = Date.now();
  data.lastTeleportTime = 0;
}


function hasAnyEffectExcept(player: Player, excludedEffects: string[]): boolean {
  const effects: Effect[] = player.getEffects();

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
    y: player.location.y,
    z: player.location.z,
  };

  player.teleport(freezeLocation, { dimension: player.dimension });
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeしました`);

  // 一定時間後にfreeze解除
  system.runTimeout(() => {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);

    data.positionHistory = [player.location];
    data.lastTime = Date.now();
    data.lastTeleportTime = 0;
    data.violationCount = 0;
  }, config.antiCheat.freezeDuration);
}


// 2点間の距離を計算する関数
function calculateDistance(pos1: Vector3, pos2: Vector3): number {
  return Math.sqrt(
    Math.pow(pos2.x - pos1.x, 2) +
    Math.pow(pos2.y - pos1.y, 2) +
    Math.pow(pos2.z - pos1.z, 2)
  );
}

// ClickTP検出
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
      const distance = calculateDistance(player.location, entity.location);
      return distance <= 5; // Check if within 5 blocks
    }

    return false;

  });


  if (player.isGliding || isNearBoat) {
    data.positionHistory = [player.location];
    data.lastTime = Date.now();
    return null;
  }

  const isFalling = player.getVelocity().y < -0.5 && !player.isOnGround;
  const isSprintingInAir = player.isSprinting && !player.isOnGround;


  if (player.location.y <= -64) {
    return null;
  }

  if (isFalling || isSprintingInAir) {
    data.positionHistory = [player.location];
    data.lastTime = Date.now();
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
  }



  // ClickTPの距離検出
  const clickTpDistance = calculateDistance(player.location, data.positionHistory[0]);

  if (clickTpDistance > config.antiCheat.clickTpExclusionThreshold) {
    return null;
  }

  if (clickTpDistance > config.antiCheat.clickTpThreshold) {
    return { cheatType: '移動系のチート(距離)' };
  }

  const velocity = player.getVelocity();
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);

  if (speed > config.antiCheat.maxSpeedThreshold) {
    return { cheatType: '移動系のチート(スピード)' };
  }

  return null;
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;

  if (item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
    const data = playerData[player.id] || {};
    playerData[player.id] = data;

    if (data.enderPearlInterval) {
      // 既存のタイムアウトをクリア
      data.enderPearlInterval = null;
    }

    data.recentlyUsedEnderPearl = true;
    data.enderPearlInterval = 9; // 9秒カウントダウン
  }
});


function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting || player.isGliding || data.recentlyUsedEnderPearl || getGamemode(player.name) === 1) {
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
  }

  const isJumping = player.isJumping;
  const isOnGround = player.isOnGround;
  const positionHistory = data.positionHistory;

  // 過去3ティック分の座標を取得
  const currentPosition = player.location;
  const previousPosition = positionHistory.length >= 2 ? positionHistory[positionHistory.length - 2] : currentPosition;
  const twoTicksAgoPosition = positionHistory.length >= 3 ? positionHistory[positionHistory.length - 3] : previousPosition; // 修正: previousPositionを使う

  // XZ平面での移動速度を計算
  const horizontalSpeed = Math.sqrt(
    Math.pow(currentPosition.x - previousPosition.x, 2) + Math.pow(currentPosition.z - previousPosition.z, 2)
  );

  // 過去2ティック間の水平方向の速度の変化量を計算
  const horizontalAcceleration = horizontalSpeed -
    Math.sqrt(
      Math.pow(previousPosition.x - twoTicksAgoPosition.x, 2) + Math.pow(previousPosition.z - twoTicksAgoPosition.z, 2)
    );

  // 過去3ティック分のY軸方向の速度を計算
  const currentVelocityY = player.getVelocity().y;
  const previousVelocityY = positionHistory.length >= 3 ? (positionHistory[positionHistory.length - 2].y - positionHistory[positionHistory.length - 3].y) / 50 : 0; // 要素数が3以上であることを確認
  const twoTicksAgoVelocityY = positionHistory.length >= 4 ? (positionHistory[positionHistory.length - 3].y - positionHistory[positionHistory.length - 4].y) / 50 : 0; // 要素数が4以上であることを確認

  // Y軸方向の加速度を計算
  const verticalAcceleration = currentVelocityY - previousVelocityY;
  const previousVerticalAcceleration = previousVelocityY - twoTicksAgoVelocityY;

  // ジャンプ判定
  if (isOnGround) {
    // 地面に着地したらジャンプフラグをリセット
    data.isJumping = false;
    data.jumpCounter = 0;
  } else if (isJumping && !data.isJumping) {
    // ジャンプ開始
    data.isJumping = true;
  } else if (data.isJumping && !isOnGround) {
    // 空中にいる間
    // 過去3ティック間のY座標の変化量からジャンプの高さを計算
    const jumpHeight = currentPosition.y - Math.min(previousPosition.y, twoTicksAgoPosition.y);

    // ジャンプ高さ、水平方向の加速度、またはY軸方向の加速度が閾値を超えたらAirJumpの可能性あり
    if (jumpHeight > 1.52 || horizontalAcceleration > 0.8 || (verticalAcceleration > 0.4 && previousVerticalAcceleration > 0.1)) {
      data.jumpCounter++;
      if (data.jumpCounter >= 1) {
        return { cheatType: '(AirJump|Fly)' };
      }
    }
  }

  return null;
}


let previousAngle = 0; // 1つ前のプレイヤーに対する角度を保存するための変数
const espSuspiciousTime: { [playerId: string]: number } = {}; // プレイヤーごとのESP検知時間

//@ts-ignore
function detectESP(player: Player): { cheatType: string } | null {
  const viewDirection = player.getViewDirection();
  const playerDimension = player.dimension;

  const otherPlayers = playerDimension.getPlayers().filter(p => p !== player && !p.hasTag("staff"));

  for (const otherPlayer of otherPlayers) {
    const distance = calculateDistance(player.location, otherPlayer.location);

    if (distance) {
      const directionToOtherPlayer = {
        x: (otherPlayer.location.x - player.location.x) / distance,
        y: (otherPlayer.location.y - player.location.y) / distance,
        z: (otherPlayer.location.z - player.location.z) / distance,
      };

      const dotProduct =
        viewDirection.x * directionToOtherPlayer.x +
        viewDirection.y * directionToOtherPlayer.y +
        viewDirection.z * directionToOtherPlayer.z;

      const angle = Math.acos(dotProduct);

      const viewDirectionChange = Math.abs(angle - previousAngle);

      const targetBlockIds = ['minecraft:stone', 'minecraft:grass', 'minecraft:dirt', 'minecraft:deepslate', 'minecraft:cobblestone'];
      const isPlayerBehindTargetBlocks = isPlayerBehindSpecificBlocks(player, otherPlayer, targetBlockIds, distance);

      if (viewDirectionChange > 0.05 && isPlayerBehindTargetBlocks) {
        if (!espSuspiciousTime[player.id]) {
          espSuspiciousTime[player.id] = Date.now();
          continue;
        } else {
          if (Date.now() - espSuspiciousTime[player.id] <= 750) {
            if (angle < 0.4) {
              delete espSuspiciousTime[player.id];
              return { cheatType: 'ESP' }; // ESP
            }
          } else {
            delete espSuspiciousTime[player.id];
          }
        }
      }

      previousAngle = angle;
    }
  }

  return null;
}


function isPlayerBehindSpecificBlocks(player: Player, otherPlayer: Entity, targetBlockIds: string[], distance: number): boolean {
  if (distance <= 20) {
    return false;
  }

  const dimension = world.getDimension('overworld');
  const step = 0.25;
  const worldHeight = 256;
  const maxAngle = 2;

  const playerLocation = player.location;
  const otherPlayerLocation = otherPlayer.location;

  playerLocation.y += 1;

  const viewDirection = player.getViewDirection();

  const directionToOtherPlayer = {
    x: otherPlayerLocation.x - playerLocation.x,
    y: otherPlayerLocation.y - playerLocation.y,
    z: otherPlayerLocation.z - playerLocation.z,
  };

  const dotProduct = viewDirection.x * directionToOtherPlayer.x + viewDirection.y * directionToOtherPlayer.y + viewDirection.z * directionToOtherPlayer.z;

  const angle = Math.acos(dotProduct / (Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2) * Math.sqrt(directionToOtherPlayer.x ** 2 + directionToOtherPlayer.y ** 2 + directionToOtherPlayer.z ** 2)));

  const angleInDegrees = angle * 180 / Math.PI;

  if (angleInDegrees > maxAngle) {
    return false;
  }

  for (let i = 0; i <= 1; i += step) {
    const x = playerLocation.x + directionToOtherPlayer.x * i;
    const y = playerLocation.y + directionToOtherPlayer.y * i;
    const z = playerLocation.z + directionToOtherPlayer.z * i;

    const clampedY = Math.min(y, worldHeight - 1);

    const blockLocation = { x: Math.floor(x) + 0.5, y: Math.floor(clampedY) + 0.5, z: Math.floor(z) + 0.5 };

    const block = dimension.getBlock(blockLocation);

    if (block && targetBlockIds.includes(block.type.id)) {
      return true;
    }
  }

  return false;
}



// ブロックXray検知 (視認時)
function detectXrayOnSight(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;

  const viewDirection = player.getViewDirection();
  const playerDimension = player.dimension;

  const blockRayCastOptions: BlockRaycastOptions = {
    maxDistance: 20 // Xray検知距離を設定
  };
  const blockRaycastHit = player.getBlockFromViewDirection(blockRayCastOptions);

  if (blockRaycastHit && blockRaycastHit.block) {
    const frontBlockLocation = blockRaycastHit.block.location;
    const distanceToBlock = calculateDistance(player.location, frontBlockLocation);

    // 前方のブロックが不透明で、かつプレイヤーから5ブロック以上離れている場合のみチェック
    if (!isBlockVisible(player, frontBlockLocation) && distanceToBlock > 5) {
      // プレイヤーの目の位置を取得
      const playerHeadLocation = player.getHeadLocation(); // 頭の位置を取得
      const playerEyeLocation = {
        x: playerHeadLocation.x,
        y: playerHeadLocation.y + 1.62,  // 頭の位置に身長1.62ブロックを加算
        z: playerHeadLocation.z
      };
      const targetLocation = {
        x: Math.floor(frontBlockLocation.x + viewDirection.x * distanceToBlock),
        y: Math.floor(frontBlockLocation.y + viewDirection.y * distanceToBlock),
        z: Math.floor(frontBlockLocation.z + viewDirection.z * distanceToBlock)
      };
      const blocksOnLine = bresenham3D(
        Math.floor(playerEyeLocation.x),
        Math.floor(playerEyeLocation.y),
        Math.floor(playerEyeLocation.z),
        targetLocation.x,
        targetLocation.y,
        targetLocation.z,
      );

      // 交差するブロックをチェック
      for (const blockLocation of blocksOnLine) {
        const checkBlock = playerDimension.getBlock(blockLocation);
        // チェックしたブロックがXray検知対象で、かつ空気に触れていない場合
        if (checkBlock && isTargetXrayBlock(checkBlock) && !isBlockExposedToAir(playerDimension, blockLocation)) {
          const blockLocationString = blockLocation.x + ',' + blockLocation.y + ',' + blockLocation.z;

          // 疑わしいブロックとして記録
          if (!data.xrayData.suspiciousBlocks[blockLocationString]) {
            data.xrayData.suspiciousBlocks[blockLocationString] = {
              timestamp: Date.now(),
              count: 1
            };
          } else {
            data.xrayData.suspiciousBlocks[blockLocationString].count++;
          }
        }
      }
    }
  }
}

function isBlockExposedToAir(dimension: Dimension, blockLocation: Vector3): boolean {
  const directions: Vector3[] = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];

  for (const direction of directions) {
    const neighborLocation = {
      x: blockLocation.x + direction.x,
      y: blockLocation.y + direction.y,
      z: blockLocation.z + direction.z,
    };
    const neighborBlock = dimension.getBlock(neighborLocation);
    // 周りのブロックが空気ブロックの場合
    if (!neighborBlock || neighborBlock.type.id === "minecraft:air") {
      return true;
    }
  }

  // すべての隣接ブロックが空気ブロックではない場合
  return false;
}

function isTargetXrayBlock(block: Block): boolean {
  const targetXrayBlockIds = [
    'minecraft:diamond_ore',
    'minecraft:ancient_debris',
    'minecraft:emerald_ore',
    'minecraft:iron_ore',
  ];
  return targetXrayBlockIds.includes(block.type.id);
}


function bresenham3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): Vector3[] {
  let points: Vector3[] = [];
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  let dz = Math.abs(z2 - z1);
  let xs = x1 < x2 ? 1 : -1;
  let ys = y1 < y2 ? 1 : -1;
  let zs = z1 < z2 ? 1 : -1;
  let p1, p2;

  const isWithinWorldBoundaries = (x: number, y: number, z: number): boolean => {
    const worldMin = { x: -30000000, y: -64, z: -30000000 }; 
    const worldMax = { x: 29999999, y: 256, z: 29999999 }; 
    return x >= worldMin.x && x <= worldMax.x && y >= worldMin.y && y <= worldMax.y && z >= worldMin.z && z <= worldMax.z;
  };

  // x軸方向の変化量が最大の場合
  if (dx >= dy && dx >= dz) {
    p1 = 2 * dy - dx;
    p2 = 2 * dz - dx;
    while (x1 != x2) {
      x1 += xs;
      if (p1 >= 0) {
        y1 += ys;
        p1 -= 2 * dx;
      }
      if (p2 >= 0) {
        z1 += zs;
        p2 -= 2 * dx;
      }
      p1 += 2 * dy;
      p2 += 2 * dz;

      if (isWithinWorldBoundaries(x1, y1, z1)) {
        points.push({ x: x1, y: y1, z: z1 });
      }
    }
    // y軸方向の変化量が最大の場合
  } else if (dy >= dx && dy >= dz) {
    p1 = 2 * dx - dy;
    p2 = 2 * dz - dy;
    while (y1 != y2) {
      y1 += ys;
      if (p1 >= 0) {
        x1 += xs;
        p1 -= 2 * dy;
      }
      if (p2 >= 0) {
        z1 += zs;
        p2 -= 2 * dy;
      }
      p1 += 2 * dx;
      p2 += 2 * dz;

      if (isWithinWorldBoundaries(x1, y1, z1)) {
        points.push({ x: x1, y: y1, z: z1 });
      }
    }
    // z軸方向の変化量が最大の場合
  } else {
    p1 = 2 * dx - dz;
    p2 = 2 * dy - dz;
    while (z1 != z2) {
      z1 += zs;
      if (p1 >= 0) {
        x1 += xs;
        p1 -= 2 * dz;
      }
      if (p2 >= 0) {
        y1 += ys;
        p2 -= 2 * dz;
      }
      p1 += 2 * dx;
      p2 += 2 * dy;

      if (isWithinWorldBoundaries(x1, y1, z1)) {
        points.push({ x: x1, y: y1, z: z1 });
      }
    }
  }

  return points;
}

function isBlockVisible(player: Player, blockLocation: Vector3): boolean {
  const blockRayCastOptions: BlockRaycastOptions = {
    maxDistance: calculateDistance(player.location, blockLocation)
  };
  const blockRaycastHit = player.getBlockFromViewDirection(blockRayCastOptions);

  if (blockRaycastHit && blockRaycastHit.block) {
    return blockRaycastHit.block.location.x === blockLocation.x &&
      blockRaycastHit.block.location.y === blockLocation.y &&
      blockRaycastHit.block.location.z === blockLocation.z;
  } else {
    return false;
  }
}

world.beforeEvents.playerBreakBlock.subscribe((event: any) => {
  const player = event.player;
  const blockLocation = event.block.location;
  const data = playerData[player.id];

  if (!data) return;


  system.run(() => { // 1 tick 遅延させる
    const blockLocationString = blockLocation.x + ',' + blockLocation.y + ',' + blockLocation.z;

    // 破壊したブロックが疑わしいブロックとして記録されているかチェック
    if (data.xrayData.suspiciousBlocks[blockLocationString]) {
      // Xrayと判定
      //handleCheatDetection(player, { cheatType: 'Xray' });
      world.sendMessage(`§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が Xray を使用している可能性があります(バグの可能性もあり)`)

      // 疑わしいブロックの記録を削除
      delete data.xrayData.suspiciousBlocks[blockLocationString];
    }
  });
});




function runTick() {
  currentTick++;
  if (!monitoring) return;
  //logPlayerData('-4294967295');

  for (const playerId in playerData) {
    const player = world.getPlayers().find((p) => p.id === playerId);
    if (player) {
      if (playerData[playerId].isFrozen) {
        const freezeLocation = {
          x: player.location.x,
          y: 1000,
          z: player.location.z,
        };
        player.teleport(freezeLocation, { dimension: player.dimension });
      } else {
        // 1ティック前の位置を保存
        playerData[playerId].lastPosition = player.location;

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
          //const espDetection = detectESP(player);
          //if (espDetection) {
          //  handleCheatDetection(player, espDetection);
          //}
        if (config.antiCheat.betasystem == true ) {
          // Xray検知 (視認時)
          detectXrayOnSight(player);
        }

        




        const currentTime = Date.now();
        for (const blockLocationString in playerData[playerId].xrayData.suspiciousBlocks) {
          const suspiciousBlock = playerData[playerId].xrayData.suspiciousBlocks[blockLocationString];
          if (currentTime - suspiciousBlock.timestamp >= 12000) { // 10秒経過
            delete playerData[playerId].xrayData.suspiciousBlocks[blockLocationString];
          }
        }
        }
        if (playerData[playerId].enderPearlInterval !== null) {
          playerData[playerId].enderPearlInterval--;
          if (playerData[playerId].enderPearlInterval <= 0) {
            playerData[playerId].recentlyUsedEnderPearl = false;
            playerData[playerId].enderPearlInterval = null;
          }
        }

        

      }

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

      if (data.violationCount >= config.antiCheat.detectionThreshold * 5) {
        executeFreeze(player);
      } else {
        executeRollback(player);
      }
    }
  }
}

//@ts-ignore
function logPlayerData(playerIdToDisplay) {
  const simplifiedData = Object.fromEntries(
    Object.entries(playerData)
      .filter(([playerId]) => playerId === playerIdToDisplay)
      .map(([playerId, data]) => [
        playerId,
        {
         //  latestPosition: data.positionHistory[data.positionHistory.length - 1],
          //lastTime: data.lastTime,
          // violationCount: data.violationCount,
          // enderDev: data.enderPearlInterval,
          // timeOutEnder: data.recentlyUsedEnderPearl,
          xrayData: data.xrayData,
        },
      ])
  );
  console.warn(`[DEBUG] playerData: ${JSON.stringify(simplifiedData, null, 2)}`);
}



export function RunAntiCheat() {
  monitoring = true;
  world.getPlayers().forEach((p) => initializePlayerData(p));
  system.run(runTick);
  AddNewPlayers();
  console.warn('チート対策を有効にしました');
}

function AddNewPlayers() {
  if (monitoring) {
    world.getPlayers().forEach((p) => {
      if (!playerData[p.id]) {
        initializePlayerData(p);
      }
    });
  }
  system.runTimeout(AddNewPlayers, 20 * 60);
}

function unfreezePlayer(player: Player) {
  const data = playerData[player.id];
  if (data && data.isFrozen) {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);

    data.positionHistory = [player.location];
    data.lastTime = Date.now();
    data.violationCount = 0;
    data.lastTeleportTime = 0;
  }
}


function freezePlayer(player: Player) {
  const data = playerData[player.id];
  data.isFrozen = true;
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeさせました`);

  data.positionHistory = [player.location];
  data.lastTime = Date.now();
  data.lastTeleportTime = 0;
}


// ----------------------------------
// --- コマンド登録 ---
// ----------------------------------

registerCommand({
  name: 'anticheat',
  description: 'チート対策を有効/無効にします',
  parent: false,
  maxArgs: 2,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands['anticheat']),
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
    } else if (args[0] === 'freeze' && args.length === 2) {
      const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
      if (targetPlayer) {
        freezePlayer(targetPlayer);
        player.sendMessage(`プレイヤー ${targetPlayer.name} をフリーズさせました`);
      } else {
        player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
      }
    } else {
      player.sendMessage('無効な引数です。on, off, または unfreeze Playername,freeze Playernameを指定してください');
    }
  },
});