import { c, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Block } from '@minecraft/server';

//packet.tsの検出アルゴリズム自体を変更予定

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 3,
    rollbackTicks: 3 * 20,
    freezeDuration: 20 * 10,
    betasystem: true,
    xrayDetectionDistance: 10,
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
  suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number} };
}

interface SpikeLaggingData {
  isSpikeLagging: boolean;
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
    lastGroundY: 0,
    lastFallDistance: 0,
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
  player.sendMessage("異常な行動を検出した為フリーズしました(10秒程度で解除されます)")

  // 一定時間後にfreeze解除
  system.runTimeout(() => {
    data.isFrozen = false;
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);
    player.sendMessage("フリーズを解除しました")
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


function isPlayerActuallyOnGround(player: Player): boolean {
  const playerLocation = player.location;
  const playerDimension = player.dimension;
  const blockRadiusToCheck = 1;

  for (let x = Math.floor(playerLocation.x) - blockRadiusToCheck; x <= Math.floor(playerLocation.x) + blockRadiusToCheck; x++) {
    for (let z = Math.floor(playerLocation.z) - blockRadiusToCheck; z <= Math.floor(playerLocation.z) + blockRadiusToCheck; z++) {
      for (let y = Math.floor(playerLocation.y) - 1; y >= Math.floor(playerLocation.y) - blockRadiusToCheck; y--) {
        // world グローバルオブジェクトを使ってブロックを取得
        const block = playerDimension.getBlock({ x, y, z });
        if (block) {
          const blockPerm = block.permutation;
          if (blockPerm.hasTag("collision")) {
            return true;
          }
        }
      }
    }
  }
  return false;
}


// AirJump検出
function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerData[player.id];
  if (!data || data.isTeleporting || player.isGliding || data.recentlyUsedEnderPearl || getGamemode(player.name) === 1) {
    return null;
  }

  if (hasAnyEffectExcept(player, getExcludedEffects())) {
    return null;
  }

  if (playerData[player.id].spikeLaggingData.ping > 60) {
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

  const movementAngle = Math.atan2(currentPosition.z - previousPosition.z, currentPosition.x - previousPosition.x);
  const playerRotationAngle = player.getRotation().y;
  const angleDifference = Math.abs(movementAngle - playerRotationAngle);
  
  

  data.lastRotationY = angleDifference;

  // ジャンプ状態の判定
  if (isActuallyOnGround) {
    data.isJumping = false;
    data.jumpCounter = 0;
    data.airJumpDetected = false;
    data.lastGroundY = currentPosition.y; // 接地時の高さを記録
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
        jumpHeight > 3.0 ||
        horizontalAcceleration > 2.1 ||
        (verticalAcceleration > 1.3 && previousVerticalAcceleration > 0.8) ||
        velocityChangeRate > 0.9 ||
        (player.isJumping && horizontalSpeed > 0.9)
      ) {
        data.jumpCounter++;
        if (data.jumpCounter >= 2) {
          return { cheatType: '(AirJump|Fly)' }; // 通常のAirJumpとして検出
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
    return { cheatType: 'ClickTP (実験中)' };
  }

  return null;
}

function getBlockFromReticle(player: Player, maxDistance: number): Block | null {
  const playerDimension = player.dimension;
  const playerLocation = player.getHeadLocation();
  const viewDirection = player.getViewDirection();

  // 有効な座標範囲を定義
  const minCoordinate = -30000000;
  const maxCoordinate = 30000000;
  const minYCoordinate = -64;
  const maxYCoordinate = 255;

  // 光線上の各点を計算
  for (let i = 0; i <= maxDistance; i++) {
    const currentPosition = {
      x: Math.floor(playerLocation.x + viewDirection.x * i),
      y: Math.floor(playerLocation.y + viewDirection.y * i),
      z: Math.floor(playerLocation.z + viewDirection.z * i),
    };

    // 座標が有効な範囲内にあるかどうかをチェック
    if (
      currentPosition.x < minCoordinate || currentPosition.x > maxCoordinate ||
      currentPosition.y < minYCoordinate || currentPosition.y > maxYCoordinate ||
      currentPosition.z < minCoordinate || currentPosition.z > maxCoordinate
    ) {
      continue; // 無効な座標の場合は次のループへ
    }

    // ブロックを取得
    const block = playerDimension.getBlock(currentPosition);

    // ブロックが存在し、かつXray検知対象の場合
    if (block && targetXrayBlockIds.includes(block.typeId)) {
      // 周囲6方向のブロックを取得
      const surroundingBlocks = [
        playerDimension.getBlock({ x: currentPosition.x + 1, y: currentPosition.y, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x - 1, y: currentPosition.y, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y + 1, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y - 1, z: currentPosition.z }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y, z: currentPosition.z + 1 }),
        playerDimension.getBlock({ x: currentPosition.x, y: currentPosition.y, z: currentPosition.z - 1 }),
      ];

      // 周囲にairブロックが存在するかチェック
      const isTouchingAir = surroundingBlocks.some(surroundingBlock => surroundingBlock && surroundingBlock.typeId === 'minecraft:air');

      // airブロックと触れていない場合のみブロックを返す
      if (!isTouchingAir) {
        return block;
      }
    }
  }

  // 指定距離以内に指定種類のブロックが見つからない場合は null を返す
  return null;
}



const targetXrayBlockIds = ['minecraft:diamond_ore', 'minecraft:ancient_debris', 'minecraft:emerald_ore', 'minecraft:iron_ore'];

// ブロックXray検知 (視認時)
function detectXrayOnSight(player: Player): void {
  const data = playerData[player.id];
  if (!data) return;
  const currentTime = Date.now();

  // プレイヤーのレティクルからブロックを取得 (最大距離: config.antiCheat.xrayDetectionDistance)
  const targetBlock = getBlockFromReticle(player, config.antiCheat.xrayDetectionDistance);

  // ブロックが存在し、かつXray検知対象の場合
  if (targetBlock && targetXrayBlockIds.includes(targetBlock.typeId)) {
    // プレイヤーとブロックの距離を計算
    const distanceToBlock = calculateDistance(player.location, targetBlock.location);

    // ブロックが3ブロック以上離れている場合のみ処理
    if (distanceToBlock > 6) {
      const blockLocationString = `${targetBlock.location.x},${targetBlock.location.y},${targetBlock.location.z}`;

      // 座標が有効な範囲内にあるかどうかをチェック
      const minCoordinate = -30000000;
      const maxCoordinate = 30000000;
      const minYCoordinate = -64;
      const maxYCoordinate = 255;

      if (
        targetBlock.location.x >= minCoordinate && targetBlock.location.x <= maxCoordinate &&
        targetBlock.location.y >= minYCoordinate && targetBlock.location.y <= maxYCoordinate &&
        targetBlock.location.z >= minCoordinate && targetBlock.location.z <= maxCoordinate
      ) {
        // 既に同じ座標のブロックが登録されているかチェック
        if (data.xrayData.suspiciousBlocks[blockLocationString]) {
          // 既存データの場合はcountを増やす
          data.xrayData.suspiciousBlocks[blockLocationString].count++;
        } else {
          // 新規データの場合は追加
          data.xrayData.suspiciousBlocks[blockLocationString] = {
            timestamp: currentTime,
            count: 1, // 初期カウントは1
          };
        }
      }
    }
  }

  // Xray検知対象外のブロックを見ている場合は、suspiciousBlocks から削除
  for (const blockLocationString in data.xrayData.suspiciousBlocks) {
    const blockData = data.xrayData.suspiciousBlocks[blockLocationString];

    // 3秒以上経過し、視界から外れている場合のみ削除
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


      

      //player.runCommandAsync(`titleraw @s actionbar {"rawtext":[{"text":"§a現在Packet.ts修正中: ${playerData[playerId].spikeLaggingData.ping} tick/ping"}]}`);



      if (currentTick % 3 === 0) {
        playerData[playerId].boundaryCenter = player.location;
      }

      

      const clickTpOutOfBoundaryDetection = detectClickTpOutOfBoundary(player);
      if (clickTpOutOfBoundaryDetection) {
        handleCheatDetection(player, clickTpOutOfBoundaryDetection);
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
        if (currentTime - suspiciousBlock.timestamp >= 10000) {
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

    if (data.violationCount >= detectionThreshold * 4) {
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
      .map(([playerId, data]) => [playerId, { ping: data.spikeLaggingData, xray: data.xrayData}])
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