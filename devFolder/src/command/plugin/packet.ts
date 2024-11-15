import { config, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Block, GameMode, EntityHurtAfterEvent, Entity } from '@minecraft/server';
import { ServerReport } from '../utility/report';
import xy from './xy';
import { getPlayerCPS } from './tag';

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const configs = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 2,
    rollbackTicks: 20 * 3,
    freezeDuration: 20 * 10,
    betasystem: false,
    xrayDetectionDistance: 10,
    antiTimer: {
      maxTickMovment: 10,
      minTimerLog: 3,
    },
  },
};

// ----------------------------------
// --- プレイヤーデータ構造 ---
// ----------------------------------
interface XrayData {
  suspiciousBlocks: { [blockLocation: string]: { timestamp: number; count: number } };
}

interface timerData {
  safeZone: Vector3;
  lastFlag: number;
  locationData: {
    location: Vector3;
    recordTime: number;
  };
  lastTickPos: Vector3;
  maxDBVD: number;
  xzLog: number;
  disLog: number;
  timerLog: number;
  yLog: number;
  yDisLog: number;
  flagCounter: number;
  lastHighTeleport: number;

}

interface PlayerData {
  lastGroundY: number;
  originalGamemode: GameMode;
  lastFallDistance: number;
  airJumpDetected: boolean;
  jumpStartTime: number;
  positionHistory: Vector3[];
  lastTime: number;
  violationCount: number;
  lastBlinkCheck: number;
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
  lastSpeedCheck: number;
  speedViolationCount: number;
  lastRotationY: number;
  boundaryCenter: Vector3;
  boundaryRadius: number;
  lastDamageTime: number | null;
  lastBreakBlockTime: number | null;
  timerData: timerData;
  beingHit: boolean;
  lastAttackTime: number;
  attackFrequency: number[];
  lastAttackedEntity: any | null;
  aimbotTicks: number;
  blinkCount: number;
  throughBlockHits: { [targetId: string]: number }; // ブロック越しヒット数の記録
  flyHackCount: number;
  lastAttackedEntities: Entity[];
  lastMessages: string[];
  lastMessageTimes: number[];
  mutedUntil?: number;

}

// ----------------------------------
// --- プレイヤーデータ管理クラス ---
// ----------------------------------
class PlayerDataManager {
  private playerData: { [playerId: string]: PlayerData } = {};

  public initialize(player: Player): void {
    this.playerData[player.id] = {
      lastGroundY: 0,
      originalGamemode: GameMode.survival,
      lastFallDistance: 0,
      positionHistory: [player.location],
      lastTime: Date.now(),
      violationCount: 0,
      isTeleporting: false,
      lastBlinkCheck: 0,
      lastTeleportTime: 0,
      jumpStartTime: 0,
      lastSpeedCheck: 0,
      speedViolationCount: 0,
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
      beingHit: false,
      xrayData: {
        suspiciousBlocks: {},
      },
      lastDamageTime: null,
      lastBreakBlockTime: null,
      timerData: {
        safeZone: player.location,
        lastFlag: Date.now(),
        locationData: {
          location: player.location,
          recordTime: Date.now(),
        },
        lastTickPos: player.location,
        maxDBVD: 0,
        xzLog: 0,
        disLog: 0,
        timerLog: 0,
        yLog: 0,
        yDisLog: 0,
        flagCounter: 0,
        lastHighTeleport: 0,
      },
      lastAttackTime: 0,
      blinkCount: 0,
      attackFrequency: [],
      lastAttackedEntity: null,
      aimbotTicks: 0,
      throughBlockHits: {},
      flyHackCount: 0,
      lastAttackedEntities: [],
      lastMessages: [],
      lastMessageTimes: [],
      mutedUntil: 0,
    };

    if (config().module.debugMode.enabled === true) {
      console.warn(`プレイヤー ${player.name} (ID: ${player.id}) を監視しています`);
    }
  }

  public getPlayerData(): { [playerId: string]: PlayerData } {
    return this.playerData;
  }

  public get(player: Player): PlayerData | undefined {
    return this.playerData[player.id];
  }

  public update(player: Player, newData: Partial<PlayerData>): void {
    const data = this.get(player);
    if (data) {
      Object.assign(data, newData);
    }
  }

  public reset(player: Player): void {
    const data = this.get(player);
    if (data) {
      data.positionHistory = [player.location];
      data.lastTime = Date.now();
      data.lastTeleportTime = 0;
    }
  }

  public remove(player: Player): void {
    delete this.playerData[player.id];
  }
}

// PlayerDataManager のインスタンスを作成
const playerDataManager = new PlayerDataManager();

// ----------------------------------
// --- グローバル変数 ---
// ----------------------------------
let monitoring = false;
let currentTick = 0;

// ----------------------------------
// --- 関数 ---
// ----------------------------------

world.afterEvents.playerSpawn.subscribe((event) => {
  if (monitoring) {
    const player = event.player as Player;
    if (player && player.id) {
      playerDataManager.remove(player);
      if (config().module.debugMode.enabled === true) {
        console.warn(`プレイヤー ${player.name} (ID: ${player.id}) の監視を停止しました`);
      }
    }
  }
});

// 位置履歴の追加
function addPositionHistory(player: Player): void {
  const data = playerDataManager.get(player);
  if (!data) return;

  if (player.isGliding) {
    playerDataManager.update(player, { isTeleporting: true });
    system.runTimeout(() => {
      playerDataManager.update(player, { isTeleporting: false });
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
  playerDataManager.update(player, { isTeleporting: true, lastTeleportTime: currentTick });
  system.runTimeout(() => {
    playerDataManager.update(player, { isTeleporting: false });
  }, 1 * 20);
}

// ロールバック実行
function executeRollback(player: Player): void {
  const data = playerDataManager.get(player);
  if (!data) return;

  const rollbackIndex = data.positionHistory.length - configs.antiCheat.rollbackTicks - 1;
  if (rollbackIndex >= 0) {
    const rollbackPosition = data.positionHistory[rollbackIndex];
    system.run(() => {
      player.teleport(rollbackPosition, { dimension: player.dimension });
      console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
    });
  }

  playerDataManager.reset(player);
}



async function executeFreeze(player: Player): Promise<void> {
  const data = playerDataManager.get(player);
  if (!data) return;

  playerDataManager.update(player, { isFrozen: true, freezeStartTime: currentTick, originalGamemode: player.getGameMode() });

  // アドベンチャーモードに変更
  player.setGameMode(GameMode.adventure);

  // プレイヤーの居た場所に、元の向きでTP
  player.teleport(player.location, {
    dimension: player.dimension,
  });

  console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をfreezeしました`);
  player.sendMessage('異常な行動を検出した為フリーズしました(10秒程度で解除されます)');

  system.runTimeout(() => {
    unfreezePlayer(player);
  }, configs.antiCheat.freezeDuration);
}

function unfreezePlayer(player: Player): void {
  const data = playerDataManager.get(player);
  if (data && data.isFrozen) {
    playerDataManager.update(player, { isFrozen: false });

    // 元のゲームモードに戻す
    player.setGameMode(data.originalGamemode);

    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) のfreezeを解除しました`);
    player.sendMessage('フリーズを解除しました');
    playerDataManager.reset(player);
    playerDataManager.update(player, { violationCount: 0 });
  }
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
    if (!playerDataManager.get(player)) {
      playerDataManager.initialize(player);
    }

    const data = playerDataManager.get(player);
    if (data) {
      if (data.enderPearlInterval) {
        data.enderPearlInterval = null;
      }

      playerDataManager.update(player, { recentlyUsedEnderPearl: true, enderPearlInterval: 9 });
    }
  }
});



function hasEffect(player: Player, effectName: any, level: number): boolean {
  try {
    const effect = player.getEffect(effectName);
    if (effect !== undefined && effect.amplifier >= level - 1) { // amplifierは0から始まるのでlevel-1  比較演算子を >= に変更
      return true;
    }
  } catch (error) {
    // エラー処理
  }
  return false;
}

// AirJump検出
function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerDataManager.get(player);

  // プレイヤーデータが取得できない場合、テレポート中、グライディング中、エンダーパール使用後、
  // クリエイティブモード、スペクテイターモード、水中、飛行中の場合は処理をスキップ
  if (
    !data ||
    data.isTeleporting ||
    player.isGliding ||
    player.isInWater ||
    getGamemode(player.name) === 1 || // Creative
    getGamemode(player.name) === 3 || // Spectator
    player.isFlying ||
    data.recentlyUsedEnderPearl
  ) {
    return null;
  }

  const ticksToUse = 20;

  // 特定のポーション効果がある場合はスキップ (Jump Boost II以上、Speed V以上)
  if (hasEffect(player, "speed", 5) || hasEffect(player, "jump_boost", 2)) {
    return null;
  }

  if (data.positionHistory.length < ticksToUse + 1) {
    playerDataManager.update(player, { lastPosition: player.location });
    return null;
  }

  const pastPositions = data.positionHistory.slice(-ticksToUse - 1);

  const isJumping = player.isJumping;
  const isOnGround = player.isOnGround;
  const currentPosition = player.location;

  // 垂直方向の動きをより詳細に分析
  let verticalVelocities = [];
  let verticalAccelerations = [];
  for (let i = 1; i < pastPositions.length; i++) {
    verticalVelocities.push(calculateVerticalVelocity(pastPositions[i - 1], pastPositions[i]));
  }
  for (let i = 1; i < verticalVelocities.length; i++) {
    verticalAccelerations.push((verticalVelocities[i] - verticalVelocities[i - 1]) / 50);
  }

  // 不自然な加速度変化を検出
  let unnaturalAccelerationCount = 0;
  for (let i = 1; i < verticalAccelerations.length; i++) {
    if (Math.abs(verticalAccelerations[i] - verticalAccelerations[i - 1]) > 0.08 && verticalAccelerations[i] > 0) {
      unnaturalAccelerationCount++;
    }
  }


  let lastPosition = data.lastPosition;
  let isJumpingData = data.isJumping;
  let lastGroundY = data.lastGroundY;
  let jumpCounter = data.jumpCounter;



  // 直前の位置情報がない場合は処理をスキップ
  if (!lastPosition) {
    playerDataManager.update(player, { lastPosition: currentPosition, lastGroundY: isOnGround ? currentPosition.y : lastGroundY });
    return null;
  }



  const horizontalSpeed = calculateHorizontalSpeed(currentPosition, lastPosition);
  const maxVerticalVelocity = Math.max(...verticalVelocities);


  // ジャンプ状態の判定とAirJump検出
  if (isOnGround) {
    isJumpingData = false;
    jumpCounter = 0;
    lastGroundY = currentPosition.y;
  } else if (isJumping && !isJumpingData) {
    isJumpingData = true;
  } else if (isJumpingData && !isOnGround) {

    const jumpHeight = currentPosition.y - lastGroundY;
    const invalidVerticalMovement = verticalAccelerations.some(accel => accel > 0.2);


    if (
      (!isOnGround && jumpHeight > 0.6 && maxVerticalVelocity > 0.4 && invalidVerticalMovement) ||
      (unnaturalAccelerationCount >= 2) ||
      (player.isJumping && horizontalSpeed > 1.2 && !player.isSprinting)
    ) {
      jumpCounter++;

      if (jumpCounter >= 2) {
        console.log(`[DEBUG AirJump] ${player.name} - AirJump Detected!`);
        playerDataManager.update(player, {
          lastPosition: currentPosition,
          isJumping: isJumpingData,
          jumpCounter: jumpCounter,
          lastGroundY: lastGroundY
        });
        return { cheatType: '(AirJump|Fly)' };
      }
    }
  }


  // データ更新
  playerDataManager.update(player, {
    lastPosition: currentPosition,
    isJumping: isJumpingData,
    jumpCounter: jumpCounter,
    lastGroundY: lastGroundY
  });

  return null;
}

function calculateHorizontalSpeed(pos1: Vector3, pos2: Vector3) {
  return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2);
}

function calculateVerticalVelocity(currentPos: Vector3, previousPos: Vector3): number {
  return (currentPos.y - previousPos.y) / 50;
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
      currentPosition.x < minCoordinate ||
      currentPosition.x > maxCoordinate ||
      currentPosition.y < minYCoordinate ||
      currentPosition.y > maxYCoordinate ||
      currentPosition.z < minCoordinate ||
      currentPosition.z > maxCoordinate
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

      const isTouchingAir = surroundingBlocks.some((surroundingBlock) => surroundingBlock && surroundingBlock.typeId === 'minecraft:air');

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
  const data = playerDataManager.get(player);
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
        targetBlock.location.x >= minCoordinate &&
        targetBlock.location.x <= maxCoordinate &&
        targetBlock.location.y >= minYCoordinate &&
        targetBlock.location.y <= maxYCoordinate &&
        targetBlock.location.z >= minCoordinate &&
        targetBlock.location.z <= maxCoordinate
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

    if (
      currentTime - blockData.timestamp > 5000 &&
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
  const data = playerDataManager.get(player);

  if (!monitoring) return;
  if (player.hasTag('mine')) return;

  system.run(() => {
    if (data) {
      const blockLocationString = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;
      if (data.xrayData.suspiciousBlocks[blockLocationString]) {
        world.sendMessage(`§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が Xray を使用している可能性があります(バグの可能性もあり)`);
        delete data.xrayData.suspiciousBlocks[blockLocationString];
      }
    }
  });
});



function monitorItemUseOn(player: Player, itemId: string): void {
  if (!monitoring) return; // アンチチートが無効の場合は何もしない
  if (!player.hasTag("bypassItem")) return;

  let lastUseTimes: number[] = []; // 最後にアイテムを使用した時刻を保存する配列

  world.afterEvents.itemUseOn.subscribe((event) => {
    if (monitoring && event.source.id === player.id && event.itemStack.typeId === itemId) {
      lastUseTimes.push(Date.now()); // アイテムを使用した時刻を配列に追加

      // 5秒以内の使用回数をカウント
      const recentUseCount = lastUseTimes.filter((time) => Date.now() - time <= 3000).length;

      if (recentUseCount >= 1) {
        const location = event.source.location;
        let reason = `§f§a(ID: ${player.name})§b \n(アイテム: ${itemId}) \n§f|§6 (x: ${Math.floor(location.x)}, y: ${Math.floor(
          location.y,
        )}, z: ${Math.floor(location.z)})`;
        console.warn(reason);
      }

      if (recentUseCount >= 5) {
        // 5秒間に5回以上使用された場合
        const location = event.source.location;
        world.sendMessage(
          `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${itemId} を短時間に大量に使用しました (x: ${Math.floor(
            location.x,
          )}, y: ${Math.floor(location.y)}, z: ${Math.floor(location.z)})`,
        );
        let reason = `§f§a(ID: ${player.id})§b \n(アイテム: ${itemId} 短時間に大量に使用) \n§f|§6 (x: ${Math.floor(location.x)}, y: ${Math.floor(
          location.y,
        )}, z: ${Math.floor(location.z)})`;
        ServerReport(player, reason);

        // 配列をリセットして連続検知を防ぐ
        lastUseTimes = [];
      }

      // 古い使用時刻を削除
      lastUseTimes = lastUseTimes.filter((time) => Date.now() - time <= 3000);
    }
  });
}

function detectTimer(player: Player): { cheatType: string } | null {
  const config = configs.antiCheat;
  const data = playerDataManager.get(player)?.timerData;
  if (!data) return null;



  const now = Date.now();

  if (player.isGliding || getGamemode(player.name) === 1) return null;

  let timerData = data; // timerDataをローカル変数として保持

  const dBVD = Math.abs(timerData.xzLog - timerData.disLog);
  const dBVD2 = timerData.yDisLog - timerData.yLog;

  const tps = 20;

  timerData.maxDBVD = 20 / tps!;

  //console.log(`[DEBUG] ${player.name} dBVD: ${dBVD}, dBVD2: ${dBVD2}, maxDBVD: ${timerData.maxDBVD}`);

  if ((dBVD < timerData.maxDBVD && dBVD > 20 / (tps! * 2)) || (dBVD2 < timerData.maxDBVD && dBVD2 > 20 / (tps! * 2))) {
    timerData.timerLog++;
  } else {
    timerData.timerLog = 0;
  }

  if (
    now - timerData.lastHighTeleport >= 5000 &&
    (((dBVD > timerData.maxDBVD || dBVD2 > timerData.maxDBVD) && now - timerData.lastFlag >= 1025) || timerData.timerLog >= config.antiTimer.minTimerLog)
  ) {
    const dBLFN = now - timerData.lastFlag;

    if (dBLFN <= 10000) {
      timerData.flagCounter++;
    } else {
      timerData.flagCounter = 0;
    }

    if (dBVD >= 3 || timerData.flagCounter >= 3) {
      player.teleport(timerData.safeZone);
    }

    timerData.lastFlag = now;
  }

  if (dBVD < 0.5) {
    timerData.safeZone = player.location;
  }

  timerData.xzLog = 0;
  timerData.yLog = 0;
  timerData.disLog = 0;
  timerData.yDisLog = 0;

  // Timer検知時の処理
  if (timerData.timerLog >= config.antiTimer.minTimerLog) {
    playerDataManager.update(player, { timerData: timerData }); // 更新されたtimerDataを反映
    return { cheatType: 'Timer(ラグイ時検知率高)' };
  }

  playerDataManager.update(player, { timerData: timerData }); // 更新されたtimerDataを反映
  return null;
}

// Timer検知用の補助関数
function updateTimerData(player: Player, now: number) {
  const data = playerDataManager.get(player)?.timerData;
  if (!data) return;

  const locdata = data.locationData;
  data.locationData = { location: player.location, recordTime: now };
  data.lastTickPos ??= player.location;
  const distance = xy.distanceXZ(player.location, data.lastTickPos);
  data.lastTickPos = player.location;
  data.lastHighTeleport ??= 0;
  if (distance > configs.antiCheat.antiTimer.maxTickMovment) data.lastHighTeleport = now;

  const { x: x1, y: y1, z: z1 } = player.location;
  const { x: x2, y: y2, z: z2 } = locdata.location;
  const { x, y, z } = player.getVelocity();
  const xz = Math.hypot(x, z);

  data.xzLog += xz;
  if (y > 0) {
    data.yLog += Math.abs(y);
    data.yDisLog += Math.abs(y1 - y2);
  }
  data.disLog += Math.hypot(x1 - x2, z1 - z2);

  if ((xz === 0 && Math.hypot(x1 - x2, z1 - z2) > 0.5) || player.isGliding) {
    data.xzLog = 0;
    data.disLog = 0;
  }

  if ((y === 0 && Math.abs(y1 - y2) > 0.1) || y > 0.5) {
    data.yDisLog = 0;
  }
}





function detectFlyHack(player: Player): { cheatType: string } | null {
  const data = playerDataManager.get(player);

  // 既存の条件はそのまま残す
  if (
    !data ||
    data.isTeleporting ||
    player.isGliding ||
    player.isInWater ||
    player.isFalling ||
    hasEffect(player, "jump_boost", 3) ||
    hasEffect(player, "speed", 3) ||
    player.isFlying ||
    getGamemode(player.name) === 1 ||
    getGamemode(player.name) === 3 ||
    data.recentlyUsedEnderPearl
  ) {
    return null;
  }

  if (data.positionHistory.length < 4) {
    playerDataManager.update(player, { lastPosition: player.location });
    return null;
  }

  const isOnGround = player.isOnGround;
  const currentPosition = player.location;
  let lastPosition = data.lastPosition;

  if (!lastPosition) {
    playerDataManager.update(player, { lastPosition: currentPosition });
    return null;
  }

  const currentVelocityY = player.getVelocity().y;
  const previousVelocityY = calculateVerticalVelocity(currentPosition, lastPosition);

  // 新しい検知パターン: 水平方向の移動距離が大きい場合
  const horizontalDistance = Math.sqrt(
    Math.pow(currentPosition.x - lastPosition.x, 2) +
    Math.pow(currentPosition.z - lastPosition.z, 2)
  );
  const suspiciousHorizontalMovement = horizontalDistance > 5; // 5ブロック以上移動した場合

  // 既存の条件に加えて、新しい条件もチェック
  const isSuspiciousAscent = !isOnGround && (
    currentVelocityY > 1.8 ||
    (previousVelocityY > 0.6 && currentVelocityY > 1.3) ||
    (suspiciousHorizontalMovement && currentVelocityY > 0.5) // 水平移動が大きい場合、わずかな上昇でも疑わしい
  );

  // FlyHack 疑惑フラグを追加
  if (!isOnGround && isSuspiciousAscent) {
    if (data.flyHackCount === undefined) {
      data.flyHackCount = 0;
    }
    data.flyHackCount++;

    if (data.flyHackCount >= 3) { // 検知しきい値を調整
      console.log(`[DEBUG] ${player.name} FlyHack Detected!`);
      playerDataManager.update(player, { lastPosition: currentPosition, flyHackCount: 0 });
      return { cheatType: 'FlyHack (実験中)' };
    } else {
      playerDataManager.update(player, { lastPosition: currentPosition, flyHackCount: data.flyHackCount });
      return null;
    }
  } else {
    // 疑惑が解消された場合はカウントをリセット
    if (data.flyHackCount !== undefined && data.flyHackCount > 0) {
      playerDataManager.update(player, { flyHackCount: 0 });
    }
  }

  playerDataManager.update(player, { lastPosition: currentPosition });
  return null;
}

function detectSpeed(player: Player): { cheatType: string; value?: number } | null {
  const data = playerDataManager.get(player);
  if (!data) return null;

  if (
    !data ||
    data.isTeleporting ||
    getGamemode(player.name) === 1 ||
    getGamemode(player.name) === 4 ||
    player.isGliding ||
    hasEffect(player, "speed", 5) ||
    player.isFlying ||
    data.recentlyUsedEnderPearl
  ) {
    return null;
  }

  //ここも同様に殴られている際の検知を除外
  if (data && data.beingHit) {
    return null;
  }

  const now = Date.now();

  // Speedチェックの間隔 (ミリ秒)
  const checkInterval = 500;

  // 前回のチェックから一定時間経過していない場合はスキップ
  if (now - data.lastSpeedCheck < checkInterval) {
    return null;
  }

  // プレイヤーが移動していない場合はスキップ
  const velocity = player.getVelocity();
  if (velocity.x === 0 && velocity.z === 0) {
    playerDataManager.update(player, { lastSpeedCheck: now });
    return null;
  }

  const lastPosition = data.positionHistory[data.positionHistory.length - 2] || player.location; // 1ティック前の位置

  // 水平方向の移動距離を計算
  const distance = calculateHorizontalSpeed(player.location, lastPosition);
  // console.log(`[DEBUG] ${player.name} Distance: ${distance}`);
  // 速度を計算 (ブロック/秒)
  const speed = distance * (1000 / checkInterval);


  // 許容速度 (ブロック/秒) - 適宜調整
  const allowedSpeed = 2;



  // SpeedHack判定
  if (speed > allowedSpeed) {
    playerDataManager.update(player, { lastSpeedCheck: now, speedViolationCount: data.speedViolationCount + 1 });

    if (data.speedViolationCount + 1 >= 1) {
      console.log(`[DEBUG] ${player.name} SpeedHack Detected! Speed: ${speed} (Violation Count: ${data.speedViolationCount + 1})`);
      return { cheatType: 'Speed', value: speed };
    }
  } else {
    // 速度違反がない場合はカウントをリセット
    playerDataManager.update(player, { lastSpeedCheck: now, speedViolationCount: 0 });
  }

  playerDataManager.update(player, { lastSpeedCheck: now, speedViolationCount: 0 });
  return null;
}

function detectBlink(player: Player): { cheatType: string; value?: number } | null {
  const data = playerDataManager.get(player);
  if (!data) return null;

  if (
    !data ||
    data.isTeleporting ||
    player.isGliding ||
    player.isFlying ||
    player.isInWater ||
    getGamemode(player.name) === 1 ||
    getGamemode(player.name) === 3 ||
    hasEffect(player, "speed", 3) ||
    hasEffect(player, "jump_boost", 3) ||
    data.recentlyUsedEnderPearl
  ) {
    return null;
  }

  //ここも同様に殴られている際の検知を除外
  if (data && data.beingHit) {
    return null;
  }

  const now = Date.now();
  const checkInterval = 50; // チェック間隔 (ミリ秒)

  // 前回のチェックから一定時間経過していない場合はスキップ
  if (now - data.lastBlinkCheck < checkInterval) {
    return null;
  }

  // 位置履歴が十分にない場合はスキップ
  if (data.positionHistory.length < 2) {
    playerDataManager.update(player, { lastBlinkCheck: now });
    return null;
  }

  const lastPosition = data.positionHistory[data.positionHistory.length - 2]; // 1ティック前の位置
  const distance = calculateDistance(player.location, lastPosition);

  // Blinkのしきい値 (ブロック) - この値は調整が必要
  const blinkThreshold = 2;

  if (distance > blinkThreshold) {
    data.blinkCount = (data.blinkCount || 0) + 1; // カウンターをインクリメント

    if (data.blinkCount >= 2) { // 3回連続で検知した場合
      console.log(`[DEBUG] ${player.name} Blink Detected! Distance: ${distance}, Count: ${data.blinkCount}`);
      playerDataManager.update(player, { lastBlinkCheck: now, blinkCount: 0 }); // カウンターをリセット
      return { cheatType: 'Blink', value: distance };
    }
  } else {
    data.blinkCount = 0; // カウンターをリセット
  }

  playerDataManager.update(player, { lastBlinkCheck: now });
  return null;
}



function detectKillAura(player: Player, event: EntityHurtAfterEvent): { cheatType: string } | null {
  const attackedEntity = event.hurtEntity as Player; // Assuming the hurt entity is a player
  if (!attackedEntity || player === attackedEntity) return null; // Ignore self-attacks

  const now = Date.now();
  const data = playerDataManager.get(player) || { lastAttackTime: 0, lastAttackedEntities: [] };

  // Attack Speed Detection
  const cps = getPlayerCPS(player);
  if (cps >= 20) {
    console.log(`[DEBUG] ${player.name} Kill Aura (Attack Speed) Detected! CPS: ${cps}`);
    playerDataManager.update(player, { lastAttackTime: now, lastAttackedEntities: [attackedEntity] });
    return { cheatType: 'Kill Aura (Attack Speed)' };
  }

  // Reach Detection
  const maxReach = 6.5; // Adjust as needed
  const distanceToEntity = getDistance(player.location, attackedEntity.location);

  if (distanceToEntity > maxReach) {
    console.log(`[DEBUG] ${player.name} Kill Aura (Reach) Detected! Distance: ${distanceToEntity}`);
    playerDataManager.update(player, { lastAttackTime: now, lastAttackedEntities: [attackedEntity] });
    return { cheatType: "Kill Aura (Reach)" };
  }

  // Multi-Target Detection
  const timeThreshold = 300;
  if (data.lastAttackedEntities.length > 0 && now - data.lastAttackTime < timeThreshold) {
    const uniqueAttackedEntities = new Set([...data.lastAttackedEntities, attackedEntity]);
    if (uniqueAttackedEntities.size > 1) {
      console.log(`[DEBUG] ${player.name} Kill Aura (Multi-Target) Detected! Hit ${uniqueAttackedEntities.size} players.`);
      playerDataManager.update(player, { lastAttackTime: now, lastAttackedEntities: [attackedEntity] });
      return { cheatType: "Kill Aura (Multi-Target)" };
    }
  }

  const raycastResult = player.getBlockFromViewDirection({ maxDistance: distanceToEntity });
  if (raycastResult && raycastResult.block.location) {
    const distanceToWall = getDistance(player.location, raycastResult.block.location);
    if (distanceToEntity < distanceToWall) {
      console.log(`[DEBUG] ${player.name} Wall Hack Detected!`);
      playerDataManager.update(player, { lastAttackTime: now, lastAttackedEntities: [attackedEntity] });
      return { cheatType: 'Wall Hack' };
    }
  }

  // Update last attack data
  playerDataManager.update(player, { lastAttackTime: now, lastAttackedEntities: [attackedEntity] });

  return null;
}

// Helper function for distance calculation
function getDistance(pos1: any, pos2: any): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

world.afterEvents.entityHurt.subscribe((event: EntityHurtAfterEvent) => {
  if (!monitoring) return;
  if (event.damageSource.damagingEntity instanceof Player && event.damageSource.damagingEntity.hasTag("bypass")) {
    return;
  }
  if (event.hurtEntity instanceof Player && event.damage > 0) {
    playerDataManager.update(event.hurtEntity, { recentlyUsedEnderPearl: true, enderPearlInterval: 3 });
  }

  const attackingPlayer = event.damageSource.damagingEntity as Player;
  if (attackingPlayer && event.hurtEntity instanceof Player) {
    const killAuraDetection = detectKillAura(attackingPlayer, event);
    if (killAuraDetection) {
      handleCheatDetection(attackingPlayer, killAuraDetection);
    }
  }
});



function detectSpam(player: Player, message: string): { cheatType: string; value?: string } | null {
  const data = playerDataManager.get(player);
  if (!data || data.mutedUntil && Date.now() < data.mutedUntil) return null; // ミュート中の場合はスキップ

  const now = Date.now();
  data.lastMessages.push(message);
  data.lastMessageTimes.push(now);

  const recentMessages = data.lastMessages.filter((_, index) => now - data.lastMessageTimes[index] <= 5000);
  const recentMessageTimes = data.lastMessageTimes.filter((time) => now - time <= 5000);

  if (recentMessages.length >= 5) {
    for (let i = 0; i < recentMessages.length - 2; i++) {
      if (recentMessages[i] === recentMessages[i + 1] && recentMessages[i] === recentMessages[i + 2]) {
        console.warn(`[DEBUG] ${player.name} Spam Detected! Message: ${message}`);

        // 5秒間ミュート
        playerDataManager.update(player, { mutedUntil: Date.now() + 5000 });
        player.sendMessage("§l§a[自作§3AntiCheat]§f スパム行為を検知したため、5秒間チャットを禁止しました");

        data.lastMessages = [];
        data.lastMessageTimes = [];

        return { cheatType: "Spam", value: message };
      }
    }
  }

  data.lastMessages = recentMessages;
  data.lastMessageTimes = recentMessageTimes;
  return null;
}


world.beforeEvents.chatSend.subscribe(event => {
  if (!monitoring) return;
  const player = event.sender;
  if (player.hasTag("bypass")) return;

  const message = event.message;

  const data = playerDataManager.get(player);
  if (data && data.mutedUntil && Date.now() < data.mutedUntil) {
    event.cancel = true;
    player.sendMessage("§l§a[自作§3AntiCheat]§f あなたは現在チャットの使用を禁止されています")
    return;
  }

  const spamDetection = detectSpam(player, message);
  if (spamDetection) {
    handleCheatDetection(player, spamDetection);
    event.cancel = true; // スパム検知時にもメッセージ送信をキャンセル
  }
});



// ティックごとの処理
function runTick(): void {
  currentTick++;
  if (!monitoring) return;

  const currentTime = Date.now();

  for (const playerId in playerDataManager.getPlayerData()) {
    const player = world.getPlayers().find((p) => p.id === playerId);
    if (!player) continue;
    const data = playerDataManager.get(player);
    if (!data) continue;

    if (player.hasTag("bypass")) {
      return;
    }

    if (data.isFrozen) {
      player.teleport({ x: player.location.x, y: player.location.y, z: player.location.z }, { dimension: player.dimension });
    } else {
      addPositionHistory(player);

      if (currentTick % 3 === 0) {
        playerDataManager.update(player, { boundaryCenter: player.location });
      }




      if (configs.antiCheat.betasystem) {
        detectXrayOnSight(player);

        const airJumpDetection = detectAirJump(player);
        if (airJumpDetection) {
          handleCheatDetection(player, airJumpDetection);
        }

        const flyHackDetection = detectFlyHack(player);
        if (flyHackDetection) {
          handleCheatDetection(player, flyHackDetection);
        }

        const timerDetection = detectTimer(player);
        if (timerDetection) {
          handleCheatDetection(player, timerDetection);
        }

        const blinkDetection = detectBlink(player);
        if (blinkDetection) {
          handleCheatDetection(player, blinkDetection);
        }

        const speedDetection = detectSpeed(player);
        if (speedDetection) {
          handleCheatDetection(player, speedDetection);
        }

      }

      for (const blockLocationString in data.xrayData.suspiciousBlocks) {
        const suspiciousBlock = data.xrayData.suspiciousBlocks[blockLocationString];
        if (currentTime - suspiciousBlock.timestamp >= 10000) {
          delete data.xrayData.suspiciousBlocks[blockLocationString];
        }
      }

      if (data.enderPearlInterval !== null) {
        playerDataManager.update(player, { enderPearlInterval: data.enderPearlInterval - 1 });
        if (data.enderPearlInterval - 1 <= 0) {
          playerDataManager.update(player, { recentlyUsedEnderPearl: false, enderPearlInterval: null });
        }
      }

      updateTimerData(player, currentTime);

      playerDataManager.update(player, { lastTime: Date.now() });
    }
  }
}

// チート検出時の処理
function handleCheatDetection(player: Player, detection: { cheatType: string; value?: string | number }): void {
  const data = playerDataManager.get(player);
  if (!data) return;

  const detectionThreshold = configs.antiCheat.detectionThreshold;

  playerDataManager.update(player, { violationCount: data.violationCount + 1 });

  if (data.violationCount + 1) {
    let logMessage = `§l§a[自作§3AntiCheat]§fプレイヤー ${player.name} (ID: ${player.id}) が ${detection.cheatType} を使用している可能性があります`;

    if (detection.value !== undefined) {
      logMessage += ` (値: ${detection.value})`;
    }

    console.warn(logMessage);
    world.sendMessage(logMessage);

    if (data.violationCount + 1 >= detectionThreshold * 4) {
      executeFreeze(player);
    } else {
      executeRollback(player);
    }
  }
}

// アンチチートの開始
export function RunAntiCheat(): void {
  monitoring = true;
  world.getPlayers().forEach(playerDataManager.initialize.bind(playerDataManager));

  system.runInterval(runTick, 1);

  system.runTimeout(() => {
    world.getPlayers().forEach((player) => {
      const monitoredItems = ['minecraft:flint_and_steel'];
      monitoredItems.forEach((itemId) => {
        monitorItemUseOn(player, itemId);
      });
    });
  }, 1);

  system.runTimeout(() => {
    world.afterEvents.entityHurt.subscribe((event) => {
      if (event.hurtEntity instanceof Player) {
        playerDataManager.update(event.hurtEntity, { lastDamageTime: Date.now() });
      }
    });
  }, 1);

  AddNewPlayers();
  console.warn('チート対策を有効にしました');
}

// 新規プレイヤーの追加
function AddNewPlayers(): void {
  if (monitoring) {
    world.getPlayers().forEach((p) => {
      if (!playerDataManager.get(p)) {
        playerDataManager.initialize(p);
      }
    });
  }
  system.runTimeout(AddNewPlayers, 20 * 60);
}

// プレイヤーのFreeze
function freezePlayer(player: Player): void {
  const data = playerDataManager.get(player);
  if (!data) return;
  playerDataManager.update(player, { isFrozen: true });
  player.teleport({ x: player.location.x, y: player.location.y, z: player.location.z }, { dimension: player.dimension });
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