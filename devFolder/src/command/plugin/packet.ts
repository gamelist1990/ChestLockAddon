import { c, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Block, Dimension } from '@minecraft/server';

//packet.tsの検出アルゴリズム自体を変更予定

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 2,
    rollbackTicks: 3 * 20,
    freezeDuration: 20 * 10,
    betasystem: true,
    xrayDetectionDistance: 5,
  },
};

// ----------------------------------
// --- グローバル変数 ---
// ----------------------------------
let monitoring = false;
const playerData: { [playerId: string]: PlayerData } = {};
let currentTick = 0;

const spikeLaggingData = new Map<string, {
  lastLocation: Vector3;
  isSpikeLagging: boolean;
  ping: number;
}>();

// ----------------------------------
// --- プレイヤーデータ構造 ---
// ----------------------------------
interface XrayData {
  suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number, lookingTime:number } };
}

interface SpikeLaggingData {
  isSpikeLagging: boolean;
  ping: number;
}


interface PlayerData {
  airJumpDetected: boolean;
  jumpStartTime: number;
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
  lastPosition: Vector3 | null;
  xrayData: XrayData;
  spikeLaggingData: SpikeLaggingData; 
  lastRotationY: number;
  boundaryCenter: Vector3;
  boundaryRadius: number;
}

// ----------------------------------
// --- 関数 ---
// ----------------------------------

// プレイヤーデータの初期化
function initializePlayerData(player: Player): void {
  playerData[player.id] = {
    positionHistory: [player.location],
    lastTime: Date.now(),
    violationCount: 0,
    isTeleporting: false,
    lastTeleportTime: 0,
    jumpStartTime:0,
    isFrozen: false,
    airJumpDetected: false,
    freezeStartTime: 0,
    isJumping: false,
    jumpCounter: 0,
    enderPearlInterval: null,
    recentlyUsedEnderPearl: false,
    lastPosition: null,
    lastRotationY: 0,
    boundaryCenter: player.location,
    boundaryRadius: 10,
    xrayData: {
      suspiciousBlocks: {},
    },
    spikeLaggingData: {
      isSpikeLagging: false,
      ping: 0,
    },
  };
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) を監視しています`);
}

// プレイヤー死亡時のデータ削除
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player as Player;
  if (player && player.id) {
    delete playerData[player.id];
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) の監視を停止しました`);
  }
});

// 位置履歴の追加
function addPositionHistory(player: Player): void {
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
    console.log(`[DEBUG] ${player.name} new position: ${player.location.x}, ${player.location.y}, ${player.location.z}`);
  }

  // 位置履歴の制限
  if (data.positionHistory.length > config.antiCheat.rollbackTicks + 1) {
    data.positionHistory.shift();
  }
}

// テレポートコマンド使用時の処理
export function handleTeleportCommand(player: Player): void {
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
function executeRollback(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;

  const rollbackIndex = data.positionHistory.length - config.antiCheat.rollbackTicks - 1;
  if (rollbackIndex >= 0) {
    const rollbackPosition = data.positionHistory[rollbackIndex];
    // 1 tick 遅延させてロールバック
    system.run(() => {
      player.teleport(rollbackPosition, { dimension: player.dimension });
      console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
    });
  }

  // データのリセット
  resetPlayerData(data, player);
}

// プレイヤーデータのリセット
function resetPlayerData(data: PlayerData, player: Player): void {
  data.positionHistory = [player.location];
  data.lastTime = Date.now();
  data.lastTeleportTime = 0;
}

function hasAnyEffectExcept(player: Player, excludedEffects: string[]): boolean {
  return player.getEffects().some((effect) => !excludedEffects.includes(effect.typeId));
}

// Freeze実行
function executeFreeze(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;

  data.isFrozen = true;
  data.freezeStartTime = currentTick;

  // プレイヤーをy座標500にテレポート
  player.teleport({ x: player.location.x, y: 500, z: player.location.z }, { dimension: player.dimension });
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeしました`);

  // 一定時間後にfreeze解除
  system.runTimeout(() => {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);
    // データのリセット
    resetPlayerData(data, player);
    data.violationCount = 0;
  }, config.antiCheat.freezeDuration);
}

// 2点間の距離を計算
function calculateDistance(pos1: Vector3, pos2: Vector3): number {
  return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2 + (pos2.z - pos1.z) ** 2);
}

//@ts-ignore
function calculatePlayerSpeed(player: Player): number {
  const data = playerData[player.id];
  if (!data) return 0;

  // 過去2ティック間の位置履歴を取得
  const currentPosition = player.location;
  const previousPosition = data.positionHistory.length >= 2 ? data.positionHistory[data.positionHistory.length - 2] : currentPosition;

  // 水平方向の移動距離を計算
  const horizontalDistance = Math.sqrt((currentPosition.x - previousPosition.x) ** 2 + (currentPosition.z - previousPosition.z) ** 2);

  // 速度を計算 (blocks/tick)
  const speed = horizontalDistance / (50 / 20); // 50ms = 1 tick

  return speed;
}

// プレイヤーとボートの距離をチェックする関数
//@ts-ignore
function isNearBoat(player: Player): boolean {
  return world
    .getDimension('overworld')
    .getEntities()
    .some((entity) => entity.typeId === 'minecraft:boat' && calculateDistance(player.location, entity.location) <= 5);
}

// エンダーパールとウィンドチャージの使用を記録
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;

  if (item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
    const data = playerData[player.id] || {};
    playerData[player.id] = data;

    // 既存のタイムアウトをクリア
    if (data.enderPearlInterval) {
      data.enderPearlInterval = null;
    }

    data.recentlyUsedEnderPearl = true;
    data.enderPearlInterval = 9; // 9秒カウントダウン
  }
});

// AirJump検出
function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting || player.isGliding || data.recentlyUsedEnderPearl || getGamemode(player.name) === 1) {
    return null;
  }

  if (hasAnyEffectExcept(player, getExcludedEffects())) {
    return null;
  }

  const isJumping = player.isJumping;
  const isOnGround = player.isOnGround;
  const positionHistory = data.positionHistory;

  // 位置履歴の管理
  const currentPosition = player.location;
  positionHistory.push(currentPosition);
  if (positionHistory.length > 4) {
    positionHistory.shift();
  }

  // 配列の要素数が不足している場合は処理をスキップし、警告を出力
  if (positionHistory.length < 3) {
    console.warn(`プレイヤー ${player.name} の positionHistory 配列の要素数が不足しています。`);
    return null;
  }

  const previousPosition = positionHistory[positionHistory.length - 2];
  const twoTicksAgoPosition = positionHistory[positionHistory.length - 3];

  // 水平方向の速度と加速度の計算
  const horizontalSpeed = calculateHorizontalSpeed(currentPosition, previousPosition);
  const horizontalAcceleration = horizontalSpeed - calculateHorizontalSpeed(previousPosition, twoTicksAgoPosition);

  // Y軸方向の速度と加速度の計算
  const currentVelocityY = player.getVelocity().y;
  const previousVelocityY = calculateVerticalVelocity(positionHistory, 2);
  const twoTicksAgoVelocityY = calculateVerticalVelocity(positionHistory, 3);

  const verticalAcceleration = currentVelocityY - previousVelocityY;
  const previousVerticalAcceleration = previousVelocityY - twoTicksAgoVelocityY;

  // 速度変化率の計算
  const velocityChangeRate = (currentVelocityY - twoTicksAgoVelocityY) / (50 * 2);

  // プレイヤーの向きと移動方向の角度差の計算
  const movementAngle = Math.atan2(currentPosition.z - previousPosition.z, currentPosition.x - previousPosition.x);
  const playerRotationAngle = player.getRotation().y;
  const angleDifference = Math.abs(movementAngle - playerRotationAngle);

  // 角度差の変化速度の計算 (前回との差分を計算するために変数を用意)
  data.lastRotationY = angleDifference; // 今回の角度差を次回のために保存

  // 接地状態の変化回数の計算
  let groundStateChangeCount = 0; // 条件分岐の外側で宣言

  if (positionHistory.length >= 4) {
    groundStateChangeCount = positionHistory.slice(-4).filter((pos, i, arr) => {
      // undefined チェックを追加
      if (!pos || !arr[i - 1]) return false;
      return (i > 0 && pos.y - arr[i - 1].y < -0.1) !== (i > 0 && arr[i - 1].y - (arr[i - 2]?.y || 0) < -0.1);
    }).length;
  } 

  // ジャンプ判定
  if (isOnGround) {
    data.isJumping = false;
    data.jumpCounter = 0;
    data.airJumpDetected = false; // 地面に接地したらリセット
  } else if (isJumping && !data.isJumping) {
    // プレイヤーがジャンプを開始し、かつ前回のティックではジャンプ中でなかった場合
    data.isJumping = true;
    data.jumpStartTime = currentTick; // ジャンプ開始時間を記録
  } else if (data.isJumping && !isOnGround) {
    // プレイヤーがジャンプ中で、かつ地面に接地していない場合

    // 空中でジャンプボタンが押されたかどうかを判定
    if (isJumping && currentTick - data.jumpStartTime > 1) { // ジャンプ開始から1ティック以上経過している場合
      data.airJumpDetected = true;
    }

    // AirJump判定 (複合条件)
    if (data.airJumpDetected) { // 空中でジャンプボタンが押された場合のみAirJump判定を行う
      const jumpHeight = currentPosition.y - Math.min(previousPosition.y, twoTicksAgoPosition.y);

      if (
        jumpHeight > 3.0 ||
        horizontalAcceleration > 2.1 ||
        (verticalAcceleration > 1.2 && previousVerticalAcceleration > 0.8) ||
        velocityChangeRate > 0.9 || // 速度変化率が大きい
        groundStateChangeCount > 3 || // 接地状態の変化回数が多い
        (player.isJumping && horizontalSpeed > 0.8) // ジャンプ中に水平方向の速度が大きい
      ) {
        data.jumpCounter++;
        if (data.jumpCounter >= 1) {
          return { cheatType: '(AirJump|Fly)' };
        }
      }
    }
  }

  return null;
}

function calculateHorizontalSpeed(pos1: Vector3, pos2: Vector3) {
  return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2);
}

function calculateVerticalVelocity(positionHistory: string | any[], ticksAgo: number) {
  if (positionHistory.length >= ticksAgo + 1) {
    return (positionHistory[positionHistory.length - ticksAgo].y - positionHistory[positionHistory.length - ticksAgo - 1].y) / 50;
  }
  return 0;
}


function detectClickTpOutOfBoundary(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data) return null;
  if (getGamemode(player.name) === 1) {
    return null;
  }

  const distanceToCenter = calculateDistance(player.location, data.boundaryCenter);

  // プレイヤーが落下中かどうかを判定するフラグを追加
  const isFalling = player.isFalling; // isFalling() はプレイヤーが落下中かどうかを返す関数と仮定

  // 境界の外に出た場合、かつ落下中でない場合、かつ15ブロック以内
  if (distanceToCenter > data.boundaryRadius && distanceToCenter <= data.boundaryRadius + 5 && !isFalling) {
    return { cheatType: 'ClickTP (枠外移動)' };
  }

  return null;
}

// ブロックXray検知 (視認時)
function detectXrayOnSight(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;

  const viewDirection = player.getViewDirection();
  const playerDimension = player.dimension;
  const blockRaycastHit = player.getBlockFromViewDirection({ maxDistance: 20 });

  if (blockRaycastHit && blockRaycastHit.block) {
    const frontBlockLocation = blockRaycastHit.block.location;
    const distanceToBlock = calculateDistance(player.location, frontBlockLocation);


    // 前方のブロックが不透明で、かつプレイヤーから5ブロック以上離れている場合のみチェック
    if (!isBlockVisible(player, frontBlockLocation) && distanceToBlock > 3) {
      const playerEyeLocation = {
        x: player.getHeadLocation().x,
        y: player.getHeadLocation().y + 1.62,
        z: player.getHeadLocation().z,
      };
      const targetLocation = {
        x: Math.floor(frontBlockLocation.x + viewDirection.x * distanceToBlock),
        y: Math.floor(frontBlockLocation.y + viewDirection.y * distanceToBlock),
        z: Math.floor(frontBlockLocation.z + viewDirection.z * distanceToBlock),
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
          const blockLocationString = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;

          // ブロックを見つめている時間を計測
          if (!data.xrayData.suspiciousBlocks[blockLocationString]) {
            data.xrayData.suspiciousBlocks[blockLocationString] = {
              timestamp: Date.now(),
              count: 0,
              lookingTime: 0,
            };
          }

          data.xrayData.suspiciousBlocks[blockLocationString].lookingTime += 50; // 50ms (1tick) 追加

          // 3秒以上見つめていたらカウントアップ
          if (data.xrayData.suspiciousBlocks[blockLocationString].lookingTime >= 3000) {
            data.xrayData.suspiciousBlocks[blockLocationString].count++;
            data.xrayData.suspiciousBlocks[blockLocationString].lookingTime = 0; // タイマーリセット

            // 疑わしいブロックとして記録 (一定時間見つめていたら)
            if (data.xrayData.suspiciousBlocks[blockLocationString].count >= 3) {
              // ここに疑わしいブロックとして記録する処理を追加 (例: 別のリストに追加するなど)
              console.warn(`プレイヤー ${player.name} がブロック ${blockLocationString} を長時間見つめています。`);
            }
          }
        } else {
          // 視線をそらしたらタイマーリセット
          const blockLocationString = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;
          if (data.xrayData.suspiciousBlocks[blockLocationString]) {
            data.xrayData.suspiciousBlocks[blockLocationString].lookingTime = 0;
          }
        }
      }
    }
  }
}

// ブロックが空気ブロックに面しているか判定
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
    if (!neighborBlock || neighborBlock.type.id === 'minecraft:air') {
      return true;
    }
  }

  return false;
}

// Xray検知対象のブロックか判定
function isTargetXrayBlock(block: Block): boolean {
  const targetXrayBlockIds = ['minecraft:diamond_ore', 'minecraft:ancient_debris', 'minecraft:emerald_ore', 'minecraft:iron_ore'];
  return targetXrayBlockIds.includes(block.type.id);
}

// ブレゼンハムのアルゴリズム (3D)
function bresenham3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): Vector3[] {
  const points: Vector3[] = [];
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  let dz = Math.abs(z2 - z1);
  const xs = x1 < x2 ? 1 : -1;
  const ys = y1 < y2 ? 1 : -1;
  const zs = z1 < z2 ? 1 : -1;
  let p1, p2;

  // ワールド境界内か判定
  const isWithinWorldBoundaries = (x: number, y: number, z: number): boolean => {
    const worldMin = { x: -30000000, y: -64, z: -30000000 };
    const worldMax = { x: 29999999, y: 256, z: 29999999 };
    return x >= worldMin.x && x <= worldMax.x && y >= worldMin.y && y <= worldMax.y && z >= worldMin.z && z <= worldMax.z;
  };

  if (dx >= dy && dx >= dz) {
    // x軸方向の変化量が最大の場合
    p1 = 2 * dy - dx;
    p2 = 2 * dz - dx;
    while (x1 !== x2) {
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
  } else if (dy >= dx && dy >= dz) {
    // y軸方向の変化量が最大の場合
    p1 = 2 * dx - dy;
    p2 = 2 * dz - dy;
    while (y1 !== y2) {
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
  } else {
    // z軸方向の変化量が最大の場合
    p1 = 2 * dx - dz;
    p2 = 2 * dy - dz;
    while (z1 !== z2) {
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
      p2 += 2 * dz;

      if (isWithinWorldBoundaries(x1, y1, z1)) {
        points.push({ x: x1, y: y1, z: z1 });
      }
    }
  }

  return points;
}

// ブロックが視界に入っているか判定
function isBlockVisible(player: Player, blockLocation: Vector3): boolean {
  const blockRaycastHit = player.getBlockFromViewDirection({ maxDistance: calculateDistance(player.location, blockLocation) });
  if (blockRaycastHit && blockRaycastHit.block) {
    return blockRaycastHit.block.location.x === blockLocation.x && blockRaycastHit.block.location.y === blockLocation.y && blockRaycastHit.block.location.z === blockLocation.z;
  }
  return false;
}

// ブロック破壊時のXrayチェック
world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const player = event.player;
  const blockLocation = event.block.location;
  const data = playerData[player.id];

  if (!data) return;

  // 1 tick 遅延させてチェック
  system.run(() => {
    const blockLocationString = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;
    // 破壊したブロックが疑わしいブロックとして記録されているかチェック
    if (data.xrayData.suspiciousBlocks[blockLocationString]) {
      // Xray判定
      world.sendMessage(`§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が Xray を使用している可能性があります(バグの可能性もあり)`);
      // 疑わしいブロックの記録を削除
      delete data.xrayData.suspiciousBlocks[blockLocationString];
    }
  });
});

function getExcludedEffects(): string[] {
  return [
    'minecraft:absorption', 'minecraft:bad_omen', 'minecraft:blindness', 'minecraft:conduit_power', 'minecraft:darkness',
    'minecraft:fatal_poison', 'minecraft:fire_resistance', 'minecraft:glowing', 'minecraft:haste', 'minecraft:health_boost',
    'minecraft:hunger', 'minecraft:instant_damage', 'minecraft:instant_health', 'minecraft:invisibility', 'minecraft:mining_fatigue',
    'minecraft:nausea', 'minecraft:night_vision', 'minecraft:poison', 'minecraft:regeneration', 'minecraft:resistance',
    'minecraft:saturation', 'minecraft:slow_falling', 'minecraft:slowness', 'minecraft:strength', 'minecraft:water_breathing',
    'minecraft:weakness', 'minecraft:wither',
  ];
}





//@ts-ignore
function detectNoFall(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data) return null;

  if (getGamemode(player.name) === 1) {
    return null;
  }

  // プレイヤーが落下中かどうかをチェック
  const isFalling = player.isFalling;
  const isOnGround = player.isOnGround;
  const velocityY = player.getVelocity().y;

  // 過去の落下速度を計算
  let previousFallingSpeed = 0;
  if (data.positionHistory.length >= 2) {
    previousFallingSpeed = (player.location.y - data.positionHistory[data.positionHistory.length - 2].y) / (50 / 20); // blocks/tick
  }

  // NoFallのチェック (落下中で、地面に着地していないのにY軸速度が正、または急激に速度が減少)
  if (isFalling && !isOnGround && !data.isJumping && (velocityY >= 0 || velocityY - previousFallingSpeed > 0.5)) {
    return { cheatType: 'NoFall' };
  }


  // --- OnGroundSpoof対策 ---
  if (isFalling && !isOnGround) {
    const playerDimension = player.dimension;
    const playerLocation = player.location;

    // プレイヤーの周囲1ブロックの範囲を取得
    const startBlock = { x: Math.floor(playerLocation.x - 1), y: Math.floor(playerLocation.y - 1), z: Math.floor(playerLocation.z - 1) };
    const endBlock = { x: Math.floor(playerLocation.x + 1), y: Math.floor(playerLocation.y + 1), z: Math.floor(playerLocation.z + 1) };

    const blocksBelow: Block[] = [];
    for (let x = startBlock.x; x <= endBlock.x; x++) {
      for (let y = startBlock.y; y <= endBlock.y; y++) {
        for (let z = startBlock.z; z <= endBlock.z; z++) {
          const block = playerDimension.getBlock({ x, y, z });
          if (block && block.location.y < playerLocation.y) {
            blocksBelow.push(block);
          }
        }
      }
    }

    const entitiesBelow = playerDimension.getEntities({
      location: playerLocation,
      maxDistance: 1, // 半径1ブロック以内
      type: 'minecraft:entity', 
    }).filter(entity => entity.location.y < playerLocation.y);

    if (blocksBelow.length === 0 && entitiesBelow.length === 0) {
      return { cheatType: 'OnGroundSpoof (実験的)' };
    }
  }

  return null;
}












// ティックごとの処理
function runTick(): void {
  currentTick++;
  if (!monitoring) return;

  const currentTime = Date.now();

  //logPlayerData('-4294967295');

  for (const playerId in playerData) {
    const player = world.getPlayers().find((p) => p.id === playerId);
    if (!player) continue;
    const data = playerData[player.id];
    if (!data) continue;
  


    

    if (playerData[playerId].isFrozen) {
      // Freeze中のプレイヤーはy座標500に固定
      player.teleport({ x: player.location.x, y: 500, z: player.location.z }, { dimension: player.dimension });
    } else {
      // 1ティック前の位置を保存
      playerData[playerId].lastPosition = player.location;
      // 位置履歴を追加
      addPositionHistory(player);


      

      player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§a現在Packet.ts修正中: ${playerData[playerId].spikeLaggingData.ping} tick/ping"}]}`);



      if (currentTick % 3 === 0) {
        playerData[playerId].boundaryCenter = player.location;
      }

      

      const clickTpOutOfBoundaryDetection = detectClickTpOutOfBoundary(player);
      if (clickTpOutOfBoundaryDetection) {
        handleCheatDetection(player, clickTpOutOfBoundaryDetection);
      }

      const Nofall = detectNoFall(player);
      if (Nofall) {
        handleCheatDetection(player, Nofall);
      }

      // AirJump検出
      const airJumpDetection = detectAirJump(player);
      if (airJumpDetection) {
        handleCheatDetection(player, airJumpDetection);
      }

      // Xray検知 (視認時、ベータシステムが有効な場合のみ)
      if (config.antiCheat.betasystem) {
        detectXrayOnSight(player);
      }

      for (const blockLocationString in playerData[playerId].xrayData.suspiciousBlocks) {
        const suspiciousBlock = playerData[playerId].xrayData.suspiciousBlocks[blockLocationString];
        if (currentTime - suspiciousBlock.timestamp >= 5000) {
          delete playerData[playerId].xrayData.suspiciousBlocks[blockLocationString];
        }
      }

      // エンダーパールとウィンドチャージのクールダウン処理
      if (playerData[playerId].enderPearlInterval !== null) {
        playerData[playerId].enderPearlInterval--;
        if (playerData[playerId].enderPearlInterval <= 0) {
          playerData[playerId].recentlyUsedEnderPearl = false;
          playerData[playerId].enderPearlInterval = null;
        }
      }

      playerData[playerId].lastTime = Date.now();
    }
  }

  system.run(runTick);
}

// チート検出時の処理
function handleCheatDetection(player: Player, detection: { cheatType: string }): void {
  const data = playerData[player.id];
  if (!data) return;

  const isLagging = false;
  const detectionThreshold = isLagging ? config.antiCheat.detectionThreshold * 2 : config.antiCheat.detectionThreshold;

  data.violationCount++;
  if (data.violationCount >= detectionThreshold) {
    const logMessage = `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;
    console.warn(logMessage);
    world.sendMessage(logMessage);

    if (data.violationCount >= detectionThreshold * 5) {
      executeFreeze(player);
    } else {
      executeRollback(player);
    }
  }
}


// プレイヤーデータのログ出力 (デバッグ用)
//@ts-ignore //playerIdToDisplay: string
function logPlayerData(playerIdToDisplay: string): void {
  const simplifiedData = Object.fromEntries(
    Object.entries(playerData || playerIdToDisplay)
      .filter(([playerId]) => playerId)
      .map(([playerId, data]) => [playerId, { ping: data.spikeLaggingData, last: data.lastPosition }])
  );
  console.warn(`[DEBUG] playerData: ${JSON.stringify(simplifiedData, null, 2)}`);
}



function updateSpikeLaggingData() {
  const players = world.getAllPlayers();
  for (const player of players) {
    const sl = spikeLaggingData.get(player.id) ?? {
      lastLocation: player.location,
      ping: 0,
      isSpikeLagging: false,
    };

    const velocity = Math.hypot(player.getVelocity().x, player.getVelocity().z);
    const distance = Math.hypot(sl.lastLocation.x - player.location.x, sl.lastLocation.z - player.location.z);

    if (velocity > 0) {
      sl.ping = Math.floor(Math.abs(distance / velocity * 20));
    }

    sl.lastLocation = player.location;
    spikeLaggingData.set(player.id, sl);

    // プレイヤーデータの更新
    if (playerData[player.id]) {
      playerData[player.id].spikeLaggingData.ping = sl.ping;
    }
  }
}

function checkSpikeLagging() {
  const players = world.getAllPlayers();
  for (const player of players) {
    const sl = spikeLaggingData.get(player.id);
    if (!sl) return;
    if (Math.trunc(sl.ping / 20) >= 850) sl.isSpikeLagging = true;
    else sl.isSpikeLagging = false;
    spikeLaggingData.set(player.id, sl);

    // プレイヤーデータの更新
    if (playerData[player.id]) {
      playerData[player.id].spikeLaggingData.isSpikeLagging = sl.isSpikeLagging;
    }
  }
}


// アンチチートの開始
export function RunAntiCheat(): void {
  monitoring = true;
  world.getPlayers().forEach(initializePlayerData);
  system.run(runTick);
  system.runInterval(checkSpikeLagging,1);
  system.runInterval(updateSpikeLaggingData,1);
  AddNewPlayers();
  console.warn('チート対策を有効にしました');
}

// 新規プレイヤーの追加
function AddNewPlayers(): void {
  if (monitoring) {
    world.getPlayers().forEach((p) => {
      if (!playerData[p.id]) {
        initializePlayerData(p);
      }
    });
  }
  system.runTimeout(AddNewPlayers, 20 * 60);
}

// プレイヤーのFreeze解除
function unfreezePlayer(player: Player): void {
  const data = playerData[player.id];
  if (data && data.isFrozen) {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);
    // データのリセット
    resetPlayerData(data, player);
    data.violationCount = 0;
  }
}

// プレイヤーのFreeze
function freezePlayer(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;
  data.isFrozen = true;
  player.teleport({ x: player.location.x, y: 60000, z: player.location.z }, { dimension: player.dimension });
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeさせました`);
  // データのリセット
  resetPlayerData(data, player);
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
    switch (args[0]) {
      case 'on':
        RunAntiCheat();
        AddNewPlayers();
        break;
      case 'off':
        monitoring = false;
        player.sendMessage('チート対策を無効にしました');
        break;
      case 'unfreeze':
        if (args.length === 2) {
          const targetPlayer = world.getPlayers().find((p) => p.name === args[1]);
          if (targetPlayer) {
            unfreezePlayer(targetPlayer);
            player.sendMessage(`プレイヤー ${targetPlayer.name} のfreezeを解除しました`);
          } else {
            player.sendMessage(`プレイヤー ${args[1]} が見つかりません`);
          }
        } else {
          player.sendMessage('無効な引数です。unfreeze Playername を指定してください');
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
          player.sendMessage('無効な引数です。freeze Playername を指定してください');
        }
        break;
      default:
        player.sendMessage('無効な引数です。on, off, unfreeze Playername, freeze Playername を指定してください');
        break;
    }
  },
});