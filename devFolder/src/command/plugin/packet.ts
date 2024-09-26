import { config, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Block } from '@minecraft/server';
import { ServerReport } from '../utility/report';

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const configs = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 3,
    rollbackTicks: 3 * 20,
    freezeDuration: 20 * 10,
    betasystem: true,
    xrayDetectionDistance: 10,
    // 最大許容速度 (ブロック/ティック)
    maxAllowedSpeed: 0.7,
    // 速度違反検出のしきい値 (ブロック/ティック)
    speedViolationThreshold: 0.1,
  },
};

// ----------------------------------
// --- グローバル変数 ---
// ----------------------------------
let monitoring = false;
const playerData: { [playerId: string]: PlayerData } = {};
let currentTick = 0;

const pingData = new Map<string, {
  lastLocation: Vector3;
  lastTick: number;
  isLagg: boolean;
  ping: number;
  movementHistory: { tick: number; location: Vector3; isJumping: boolean }[];
  averagePing: number;
  pingCoefficient: number;
}>();

// ----------------------------------
// --- プレイヤーデータ構造 ---
// ----------------------------------
interface XrayData {
  suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number } };
}

interface pingData {
  pingStatus: string;
  isLagg: boolean;
  ping: number;
}

interface PlayerData {
  lastGroundY: number;
  lastFallDistance: number;
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
  pingData: pingData;
  lastRotationY: number;
  boundaryCenter: Vector3;
  boundaryRadius: number;
  lastFallVelocity: Vector3 | null;
  unnaturalAccelerationTicksY: number;
}

// ----------------------------------
// --- 関数 ---
// ----------------------------------

// プレイヤーデータの初期化
function initializePlayerData(player: Player): void {
  playerData[player.id] = {
    lastGroundY: 0,
    lastFallDistance: 0,
    positionHistory: [player.location],
    lastTime: Date.now(),
    lastFallVelocity: null,
    unnaturalAccelerationTicksY: 0,
    violationCount: 0,
    isTeleporting: false,
    lastTeleportTime: 0,
    jumpStartTime: 0,
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
      suspiciousBlocks: {}, // suspiciousBlocks を初期化
    },
    pingData: {
      isLagg: false,
      pingStatus: '',
      ping: 0,
    },
  };
  if (config().module.debugMode.enabled === true) {
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) を監視しています`);
  }
}

world.afterEvents.playerSpawn.subscribe((event) => {
  if (monitoring) { // アンチチートが有効な時のみ実行
    const player = event.player as Player;
    if (player && player.id) {
      delete playerData[player.id];
      if (config().module.debugMode.enabled === true) {
        console.warn(`プレイヤー ${player.name} (ID: ${player.id}) の監視を停止しました`);
      }
    }
  }
});

// 位置履歴の追加
function addPositionHistory(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;

  if (player.isGliding) {
    data.isTeleporting = true;
    system.runTimeout(() => {
      data.isTeleporting = false;
    }, 3 * 20);
  } else {
    data.positionHistory.push(player.location);
  }

  // デバッグログ出力
  if (configs.debugMode) {
    console.log(`[DEBUG] ${player.name} new position: ${player.location.x}, ${player.location.y}, ${player.location.z}`);
  }

  // 位置履歴の制限
  if (data.positionHistory.length > configs.antiCheat.rollbackTicks + 1) {
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

  const rollbackIndex = data.positionHistory.length - configs.antiCheat.rollbackTicks - 1;
  if (rollbackIndex >= 0) {
    const rollbackPosition = data.positionHistory[rollbackIndex];
    system.run(() => {
      player.teleport(rollbackPosition, { dimension: player.dimension });
      console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
    });
  }

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

  player.teleport({ x: player.location.x, y: 500, z: player.location.z }, { dimension: player.dimension });
  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeしました`);
  player.sendMessage("異常な行動を検出した為フリーズしました(10秒程度で解除されます)");

  system.runTimeout(() => {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);
    player.sendMessage("フリーズを解除しました");
    resetPlayerData(data, player);
    data.violationCount = 0;
  }, configs.antiCheat.freezeDuration);
}

// 2点間の距離を計算
function calculateDistance(pos1: Vector3, pos2: Vector3): number {
  return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2 + (pos2.z - pos1.z) ** 2);
}

// エンダーパールとウィンドチャージの使用を記録
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;

  if (item && (item.typeId === 'minecraft:ender_pearl' || item.typeId === 'minecraft:wind_charge')) {
    const data = playerData[player.id] || {};
    playerData[player.id] = data;

    if (data.enderPearlInterval) {
      data.enderPearlInterval = null;
    }

    data.recentlyUsedEnderPearl = true;
    data.enderPearlInterval = 9; // 9秒カウントダウン
  }
});

function isPlayerActuallyOnGround(player: Player): boolean {
  const playerLocation = player.location;
  const playerDimension = player.dimension;
  const blockRadiusToCheck = 1;

  const minWorldX = -30000000;
  const maxWorldX = 30000000;
  const minWorldY = -64;
  const maxWorldY = 255;
  const minWorldZ = -30000000;
  const maxWorldZ = 30000000;

  for (let x = Math.max(minWorldX, Math.floor(playerLocation.x) - blockRadiusToCheck); x <= Math.min(maxWorldX, Math.floor(playerLocation.x) + blockRadiusToCheck); x++) {
    for (let z = Math.max(minWorldZ, Math.floor(playerLocation.z) - blockRadiusToCheck); z <= Math.min(maxWorldZ, Math.floor(playerLocation.z) + blockRadiusToCheck); z++) {
      for (let y = Math.max(minWorldY, Math.floor(playerLocation.y) - 1); y >= Math.max(minWorldY, Math.floor(playerLocation.y) - blockRadiusToCheck) && y <= maxWorldY; y--) {
        const block = playerDimension.getBlock({ x, y, z });
        if (block && block.permutation.hasTag("collision")) {
          return true;
        }
      }
    }
  }
  return false;
}

// AirJump検出
function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting || player.isGliding || data.recentlyUsedEnderPearl || getGamemode(player.name) === 1 || getGamemode(player.name) === 3) {
    return null;
  }

  if (hasAnyEffectExcept(player, getExcludedEffects())) {
    return null;
  }

  if (playerData[player.id].pingData.ping > 50) {
    return null;
  }

  const isActuallyOnGround = isPlayerActuallyOnGround(player);
  const isJumping = player.isJumping;
  const isOnGround = player.isOnGround;
  const positionHistory = data.positionHistory;

  const currentPosition = player.location;
  positionHistory.push(currentPosition);
  if (positionHistory.length > 4) {
    positionHistory.shift();
  }

  if (positionHistory.length < 3) {
    return null;
  }

  const previousPosition = positionHistory[positionHistory.length - 2];
  const twoTicksAgoPosition = positionHistory[positionHistory.length - 3];

  const horizontalSpeed = calculateHorizontalSpeed(currentPosition, previousPosition);
  const horizontalAcceleration = horizontalSpeed - calculateHorizontalSpeed(previousPosition, twoTicksAgoPosition);

  const currentVelocityY = player.getVelocity().y;
  const previousVelocityY = calculateVerticalVelocity(positionHistory, 2);
  const twoTicksAgoVelocityY = calculateVerticalVelocity(positionHistory, 3);

  const verticalAcceleration = currentVelocityY - previousVelocityY;
  const previousVerticalAcceleration = previousVelocityY - twoTicksAgoVelocityY;

  const velocityChangeRate = (currentVelocityY - twoTicksAgoVelocityY) / (50 * 2);

  // ジャンプ状態の判定
  if (isActuallyOnGround) {
    data.isJumping = false;
    data.jumpCounter = 0;
    data.airJumpDetected = false;
    data.lastGroundY = currentPosition.y;
  } else if (isJumping && !data.isJumping) {
    data.isJumping = true;
    data.jumpStartTime = currentTick;
  } else if (data.isJumping && !isOnGround) {
    if (isJumping && currentTick - data.jumpStartTime > 1) {
      data.airJumpDetected = true;
    }

    if (data.airJumpDetected) {
      const jumpHeight = currentPosition.y - Math.min(previousPosition.y, twoTicksAgoPosition.y);

      if (
        jumpHeight > 2.0 ||
        horizontalAcceleration > 2.1 ||
        (verticalAcceleration > 1.3 && previousVerticalAcceleration > 0.8) ||
        velocityChangeRate > 0.9 ||
        (player.isJumping && horizontalSpeed > 0.9)
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
  if (!data || getGamemode(player.name) === 1 || getGamemode(player.name) === 3) return null;

  const distanceToCenter = calculateDistance(player.location, data.boundaryCenter);

  const isFalling = player.isFalling;

  if (distanceToCenter > data.boundaryRadius && distanceToCenter <= data.boundaryRadius + 5 && !isFalling) {
    return { cheatType: 'ClickTP (実験中)' };
  }

  return null;
}

function getBlockFromReticle(player: Player, maxDistance: number): Block | null {
  const playerDimension = player.dimension;
  const playerLocation = player.getHeadLocation();
  const viewDirection = player.getViewDirection();

  const minCoordinate = -30000000;
  const maxCoordinate = 30000000;
  const minYCoordinate = -64;
  const maxYCoordinate = 255;

  for (let i = 0; i <= maxDistance; i++) {
    const currentPosition = {
      x: Math.floor(playerLocation.x + viewDirection.x * i),
      y: Math.floor(playerLocation.y + viewDirection.y * i),
      z: Math.floor(playerLocation.z + viewDirection.z * i),
    };

    if (
      currentPosition.x < minCoordinate || currentPosition.x > maxCoordinate ||
      currentPosition.y < minYCoordinate || currentPosition.y > maxYCoordinate ||
      currentPosition.z < minCoordinate || currentPosition.z > maxCoordinate
    ) {
      continue;
    }

    const block = playerDimension.getBlock(currentPosition);

    if (block && targetXrayBlockIds.includes(block.typeId)) {
      const surroundingBlocks = [
        playerDimension.getBlock({ x: currentPosition.x + 1, y: currentPosition.y, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x - 1, y: currentPosition.y, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y + 1, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y - 1, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y, z: currentPosition.z + 1 }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y, z: currentPosition.z - 1 }),
      ];

      const isTouchingAir = surroundingBlocks.some(surroundingBlock => surroundingBlock && surroundingBlock.typeId === 'minecraft:air');

      if (!isTouchingAir) {
        return block;
      }
    }
  }

  return null;
}

const targetXrayBlockIds = ['minecraft:diamond_ore', 'minecraft:ancient_debris', 'minecraft:emerald_ore', 'minecraft:iron_ore'];

// ブロックXray検知 (視認時)
function detectXrayOnSight(player: Player): void {
  const data = playerData[player.id];
  if (!data || !data.xrayData) return;
  const currentTime = Date.now();

  const targetBlock = getBlockFromReticle(player, configs.antiCheat.xrayDetectionDistance);

  if (targetBlock && targetXrayBlockIds.includes(targetBlock.typeId)) {
    const distanceToBlock = calculateDistance(player.location, targetBlock.location);

    if (distanceToBlock > 4) {
      const blockLocationString = `${targetBlock.location.x},${targetBlock.location.y},${targetBlock.location.z}`;

      const minCoordinate = -30000000;
      const maxCoordinate = 30000000;
      const minYCoordinate = -64;
      const maxYCoordinate = 255;

      if (
        targetBlock.location.x >= minCoordinate && targetBlock.location.x <= maxCoordinate &&
        targetBlock.location.y >= minYCoordinate && targetBlock.location.y <= maxYCoordinate &&
        targetBlock.location.z >= minCoordinate && targetBlock.location.z <= maxCoordinate
      ) {
        if (data.xrayData.suspiciousBlocks[blockLocationString]) {
          data.xrayData.suspiciousBlocks[blockLocationString].count++;
        } else {
          data.xrayData.suspiciousBlocks[blockLocationString] = {
            timestamp: currentTime,
            count: 1,
          };
        }
      }
    }
  }

  for (const blockLocationString in data.xrayData.suspiciousBlocks) {
    const blockData = data.xrayData.suspiciousBlocks[blockLocationString];

    if (currentTime - blockData.timestamp > 5000 &&
      !(
        targetBlock &&
        targetBlock.location.x === parseFloat(blockLocationString.split(',')[0]) &&
        targetBlock.location.y === parseFloat(blockLocationString.split(',')[1]) &&
        targetBlock.location.z === parseFloat(blockLocationString.split(',')[2])
      )
    ) {
      delete data.xrayData.suspiciousBlocks[blockLocationString];
    }
  }
}

// ブロック破壊時のXrayチェック
world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const player = event.player;
  const blockLocation = event.block.location;
  const data = playerData[player.id];

  if (!data) return;

  system.run(() => {
    const blockLocationString = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;
    if (data.xrayData.suspiciousBlocks[blockLocationString]) {
      world.sendMessage(`§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が Xray を使用している可能性があります(バグの可能性もあり)`);
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

function checkPlayerSpeed(player: Player): { cheatType: string; value?: number } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting || player.isGliding || data.recentlyUsedEnderPearl || getGamemode(player.name) === 1) {
    return null;
  }

  if (hasAnyEffectExcept(player, getExcludedEffects())) {
    return null;
  }

  const currentLocation = player.location;
  const previousLocation = data.lastPosition || currentLocation;

  const horizontalDistance = Math.sqrt(
    (currentLocation.x - previousLocation.x) ** 2 + (currentLocation.z - previousLocation.z) ** 2
  );

  const timeElapsed = (Date.now() - data.lastTime) / 50;

  const horizontalSpeed = horizontalDistance / timeElapsed;

  if (horizontalSpeed > configs.antiCheat.maxAllowedSpeed + configs.antiCheat.speedViolationThreshold) {
    return { cheatType: 'Speed', value: horizontalSpeed }; // 速度を数値として返す
  }

  return null;
}

function estimatePingFromMovement(movementHistory: { tick: number; location: Vector3; isJumping: boolean }[]): number {
  if (movementHistory.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  let totalTime = 0;
  let totalVelocityChange = 0;

  for (let i = 1; i < movementHistory.length; i++) {
    const prev = movementHistory[i - 1];
    const curr = movementHistory[i];

    const distance = calculateDistance3D(prev.location, curr.location);
    totalDistance += distance;

    const timeDiff = curr.tick - prev.tick;
    totalTime += timeDiff;

    const velocity = distance / timeDiff;

    if (i > 1) {
      const prevVelocity = calculateDistance3D(movementHistory[i - 2].location, prev.location) / (prev.tick - movementHistory[i - 2].tick);
      totalVelocityChange += Math.abs(velocity - prevVelocity);
    }

    if (curr.isJumping) {
      totalVelocityChange += 5;
    }
  }

  const averageSpeed = totalDistance / totalTime;

  const averageVelocityChange = totalVelocityChange / (movementHistory.length - 1);

  const pingCoefficient = 20;
  let estimatedPing = Math.floor((averageSpeed + averageVelocityChange) * pingCoefficient);

  if (estimatedPing > 1000) estimatedPing = 1000;
  if (estimatedPing < 0) estimatedPing = 0;

  return estimatedPing;
}

function calculateDistance3D(pos1: Vector3, pos2: Vector3): number {
  return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2 + (pos2.z - pos1.z) ** 2);
}

function updateping(player: Player): void {
  const sl = pingData.get(player.id) ?? {
    lastLocation: player.location,
    lastTick: system.currentTick,
    isLagg: false,
    ping: 0,
    movementHistory: [],
    averagePing: 0,
    pingCoefficient: 20,
  };

  const currentTick = system.currentTick;
  const currentLocation = player.location;

  sl.movementHistory.push({ tick: currentTick, location: currentLocation, isJumping: player.isJumping });

  if (sl.movementHistory.length > 100) {
    sl.movementHistory.shift();
  }

  const estimatedPing = estimatePingFromMovement(sl.movementHistory);

  const minPingCoefficient = 10;
  const maxPingCoefficient = 50;
  if (sl.pingCoefficient < minPingCoefficient) sl.pingCoefficient = minPingCoefficient;
  if (sl.pingCoefficient > maxPingCoefficient) sl.pingCoefficient = maxPingCoefficient;

  const adjustedPing = estimatedPing * (sl.pingCoefficient / 20);
  const pingHistoryLength = 5;
  if (sl.averagePing === 0) {
    sl.averagePing = adjustedPing;
  } else {
    sl.averagePing = (sl.averagePing * (pingHistoryLength - 1) + adjustedPing) / pingHistoryLength;
  }

  let pingStatus = `良好:${sl.averagePing}`;
  if (sl.averagePing < 50) {
    pingStatus = `良好:${sl.averagePing}`;
  } else if (sl.averagePing < 150) {
    pingStatus = `普通:${sl.averagePing}`;
  } else {
    pingStatus = `悪い:${sl.averagePing}`;
  }

  sl.lastLocation = currentLocation;
  sl.lastTick = currentTick;
  pingData.set(player.id, sl);

  if (playerData[player.id]) {
    playerData[player.id].pingData.ping = sl.averagePing;
    playerData[player.id].pingData.pingStatus = pingStatus;
  }
}

function checklagping(player: Player): void {
  const sl = pingData.get(player.id);
  if (!sl) return;

  sl.isLagg = Math.trunc(sl.ping / 20) >= 850;
  pingData.set(player.id, sl);

  if (playerData[player.id]) {
    playerData[player.id].pingData.isLagg = sl.isLagg;
  }
}





function monitorItemUseOn(player: Player, itemId: string): void {
  if (!monitoring) return; // アンチチートが無効の場合は何もしない

  let lastUseTimes: number[] = []; // 最後にアイテムを使用した時刻を保存する配列

  world.afterEvents.itemUseOn.subscribe((event) => {
    if (monitoring && event.source.id === player.id && event.itemStack.typeId === itemId) {
      lastUseTimes.push(Date.now()); // アイテムを使用した時刻を配列に追加

      // 5秒以内の使用回数をカウント
      const recentUseCount = lastUseTimes.filter((time) => Date.now() - time <= 3000).length;

      if (recentUseCount >=1) {
        const location = event.source.location;
        let reason = `§f§a(ID: ${player.name})§b \n(アイテム: ${itemId}) \n§f|§6 (x: ${Math.floor(location.x)}, y: ${Math.floor(location.y)}, z: ${Math.floor(location.z)})`;
        console.warn(reason);
      }

      if (recentUseCount >= 5) {
        // 5秒間に10回以上使用された場合
        const location = event.source.location;
        world.sendMessage(`§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${itemId} を短時間に大量に使用しました (x: ${Math.floor(location.x)}, y: ${Math.floor(location.y)}, z: ${Math.floor(location.z)})`);
        let reason = `§f§a(ID: ${player.id})§b \n(アイテム: ${itemId} 短時間に大量に使用) \n§f|§6 (x: ${Math.floor(location.x)}, y: ${Math.floor(location.y)}, z: ${Math.floor(location.z)})`;
        ServerReport(player, reason);

        // 配列をリセットして連続検知を防ぐ
        lastUseTimes = [];
      }

      // 古い使用時刻を削除
      lastUseTimes = lastUseTimes.filter((time) => Date.now() - time <= 3000);
    }
  });
}



// ティックごとの処理
function runTick(): void {
  currentTick++;
  if (!monitoring) return;

  const currentTime = Date.now();

  for (const playerId in playerData) {
    const player = world.getPlayers().find((p) => p.id === playerId);
    if (!player) continue;
    const data = playerData[player.id];
    if (!data) continue;

    if (playerData[playerId].isFrozen) {
      player.teleport({ x: player.location.x, y: 500, z: player.location.z }, { dimension: player.dimension });
    } else {
      playerData[playerId].lastPosition = player.location;
      addPositionHistory(player);

      if (currentTick % 3 === 0) {
        playerData[playerId].boundaryCenter = player.location;
      }

      const clickTpOutOfBoundaryDetection = detectClickTpOutOfBoundary(player);
      if (clickTpOutOfBoundaryDetection) {
        handleCheatDetection(player, clickTpOutOfBoundaryDetection);
      }

      

      

      


      const speedHacks = checkPlayerSpeed(player);
      if (speedHacks) {
        handleCheatDetection(player, speedHacks);
      }

      const airJumpDetection = detectAirJump(player);
      if (airJumpDetection) {
        handleCheatDetection(player, airJumpDetection);
      }

      if (configs.antiCheat.betasystem) {
        detectXrayOnSight(player);
      }

      for (const blockLocationString in playerData[playerId].xrayData.suspiciousBlocks) {
        const suspiciousBlock = playerData[playerId].xrayData.suspiciousBlocks[blockLocationString];
        if (currentTime - suspiciousBlock.timestamp >= 10000) {
          delete playerData[playerId].xrayData.suspiciousBlocks[blockLocationString];
        }
      }

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
function handleCheatDetection(player: Player, detection: { cheatType: string; value?: number }): void {
  const data = playerData[player.id];
  if (!data) return;

  const isLagging = false;
  const detectionThreshold = isLagging ? configs.antiCheat.detectionThreshold * 2 : configs.antiCheat.detectionThreshold;

  data.violationCount++;
  if (data.violationCount >= detectionThreshold) {
    let logMessage = `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;

    // 数値がある場合、メッセージに追加
    if (detection.value !== undefined) {
      logMessage += ` (値: ${detection.value})`;
    }

    console.warn(logMessage);
    world.sendMessage(logMessage);

    if (data.violationCount >= detectionThreshold * 4) {
      executeFreeze(player);
    } else {
      executeRollback(player);
    }
  }
}

// アンチチートの開始
export function RunAntiCheat(): void {
  monitoring = true;
  world.getPlayers().forEach(initializePlayerData);
  system.run(runTick);
  system.runTimeout(()=>{
    world.getPlayers().forEach(player => {
    const monitoredItems = ["minecraft:flint_and_steel"]; // 監視対象のアイテム
    monitoredItems.forEach((itemId) => {
      monitorItemUseOn(player, itemId);
    });
  },1)})


  system.runInterval(() => {
    world.getPlayers().forEach(player => {
      checklagping(player);
      updateping(player);
    });
  }, 20);

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
  require: (player: Player) => verifier(player, config().commands['anticheat']),
  executor: (player: Player, args: string[]) => {
    switch (args[0]) {
      case 'on':
        RunAntiCheat();
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