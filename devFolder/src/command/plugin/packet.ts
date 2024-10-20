import { config, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Block, GameMode } from '@minecraft/server';
import { ServerReport } from '../utility/report';
import xy from './xy';

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
  lastRotationY: number;
  boundaryCenter: Vector3;
  boundaryRadius: number;
  lastDamageTime: number | null;
  lastBreakBlockTime: number | null;
  timerData: timerData;
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

function hasAnyEffectExcept(player: Player, excludedEffects: string[]): boolean {
  return player.getEffects().some((effect) => !excludedEffects.includes(effect.typeId));
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

function hasEffect(player:Player, effectName:any) {
  try {
    // getEffect() はエフェクトが存在しない場合に undefined を返す
    return player.getEffect(effectName) !== undefined;
  } catch (error) {
    // getEffect() はエフェクトが存在しない場合にエラーをスローすることもある
    return false;
  }
}

// AirJump検出
function detectAirJump(player: Player): { cheatType: string } | null {
  const data = playerDataManager.get(player);

  // プレイヤーデータが取得できない場合、テレポート中、グライディング中、エンダーパール使用後、
  // クリエイティブモード、スペクテイターモードの場合は処理をスキップ
  if (
    !data ||
    data.isTeleporting ||
    player.isGliding ||
    data.recentlyUsedEnderPearl ||
    getGamemode(player.name) === 1 ||
    getGamemode(player.name) === 3
  ) {
    return null;
  }

  if (hasEffect(player, "speed")) {
   return null;
  } 

  const isJumping = player.isJumping; // ジャンプ中かどうか
  const isOnGround = player.isOnGround; // 地面にいるかどうか
  const currentPosition = player.location; // 現在の位置
  const currentVelocity = player.getVelocity();

  let lastPosition = data.lastPosition; // 直前の位置 (ローカル変数に変更)
  let previousPosition = data.lastPosition; // 2ティック前の位置 (内部変数)
  let isJumpingData = data.isJumping; // ジャンプ状態 (ローカル変数に変更)
  let jumpStartTime = data.jumpStartTime; // ジャンプ開始時刻 (ローカル変数に変更)
  let airJumpDetected = data.airJumpDetected; // AirJump検出フラグ (ローカル変数に変更)
  let jumpCounter = data.jumpCounter; // AirJumpカウンター (ローカル変数に変更)
  let lastGroundY = data.lastGroundY; // 最後に地面にいた時のY座標 (ローカル変数に変更)

  // 直前の位置情報がない場合は処理をスキップ
  if (!lastPosition) {
    lastPosition = currentPosition; // lastPositionを更新
    playerDataManager.update(player, { lastPosition: lastPosition }); // lastPositionのみを更新
    return null;
  }



  // 2ティック前の位置情報がない場合は処理をスキップ
  if (data.positionHistory.length < 2) {
    lastPosition = currentPosition; // lastPositionを更新
    playerDataManager.update(player, { lastPosition: lastPosition }); // lastPositionのみを更新
    return null; 
  } else {
    previousPosition = data.positionHistory[data.positionHistory.length - 2];
  }

  // 水平速度、水平加速度、垂直速度、垂直加速度、速度変化率を計算
  const horizontalSpeed = calculateHorizontalSpeed(currentPosition, lastPosition);
  const horizontalAcceleration = horizontalSpeed - calculateHorizontalSpeed(lastPosition, previousPosition);

  const currentVelocityY = currentVelocity.y;
  const previousVelocityY = calculateVerticalVelocity(currentPosition, lastPosition);
  const twoTicksAgoVelocityY = previousPosition ? calculateVerticalVelocity(lastPosition, previousPosition) : 0; 

  const verticalAcceleration = currentVelocityY - previousVelocityY;
  const previousVerticalAcceleration = previousVelocityY - twoTicksAgoVelocityY;

  const velocityChangeRate = (currentVelocityY - twoTicksAgoVelocityY) / (50 * 2);

  // ジャンプ状態の判定
  if (isOnGround) {
    // 地面に着地したらジャンプ関連のデータをリセット
    isJumpingData = false;
    jumpCounter = 0;
    airJumpDetected = false;
    lastGroundY = currentPosition.y;
  } else if (isJumping && !isJumpingData) {
    // ジャンプ開始
    isJumpingData = true;
    jumpStartTime = currentTick;
  } else if (isJumpingData && !isOnGround) {
    // 空中にいる間
    if (isJumping && currentTick - jumpStartTime > 1) {
      // ジャンプボタンが押し続けられている場合はAirJumpの可能性あり
      airJumpDetected = true;
    }

    const jumpHeight = currentPosition.y - Math.min(lastPosition.y, previousPosition.y);

    // AirJump判定 (しきい値を調整)
    if (
      jumpHeight > 2.3 || // 通常のジャンプよりも高い
      horizontalAcceleration > 1.6 || // 水平方向に急激な加速
      (verticalAcceleration > 0.8 && previousVerticalAcceleration > 0.5) || // 垂直方向に急激な加速
      velocityChangeRate > 0.8 || // 短時間での速度変化が大きい
      (player.isJumping && horizontalSpeed > 0.7) // ジャンプ中に水平方向に移動している
    ) {
      jumpCounter++;


      if (jumpCounter >= 1) {
        // AirJumpとして検知
        console.log(`[DEBUG AirJump] ${player.name} - AirJump Detected!`);

        // 最後にまとめて更新
        playerDataManager.update(player, {
          lastPosition: currentPosition,
          isJumping: isJumpingData,
          jumpStartTime: jumpStartTime,
          airJumpDetected: airJumpDetected,
          jumpCounter: jumpCounter,
          lastGroundY: lastGroundY,
        });

        return { cheatType: '(AirJump|Fly)' };
      }
    }
  }

  // 位置履歴の更新
  previousPosition = lastPosition;
  lastPosition = currentPosition;

  // 最後にまとめて更新
  playerDataManager.update(player, {
    lastPosition: lastPosition,
    isJumping: isJumpingData,
    jumpStartTime: jumpStartTime,
    airJumpDetected: airJumpDetected,
    jumpCounter: jumpCounter,
    lastGroundY: lastGroundY,
  });

  return null;
}

function calculateHorizontalSpeed(pos1: Vector3, pos2: Vector3) {
  return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2);
}

function calculateVerticalVelocity(currentPos: Vector3, previousPos: Vector3): number {
  return (currentPos.y - previousPos.y) / 50;
}

function detectClickTpOutOfBoundary(player: Player): { cheatType: string } | null {
  const data = playerDataManager.get(player);
  if (!data || getGamemode(player.name) === 1 || getGamemode(player.name) === 3) return null;

  const distanceToCenter = calculateDistance(player.location, data.boundaryCenter);
  const isFalling = player.isFalling && player.getVelocity().y < -0.1;

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

function getExcludedEffects(): string[] {
  return [
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
}

function monitorItemUseOn(player: Player, itemId: string): void {
  if (!monitoring) return; // アンチチートが無効の場合は何もしない

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

  if (player.isGliding) return null;

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
    return { cheatType: 'Timer' };
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

  // プレイヤーデータが取得できない場合、テレポート中、グライディング中、エンダーパール使用後、
  // クリエイティブモード、スペクテイターモードの場合は処理をスキップ
  if (
    !data ||
    data.isTeleporting ||
    player.isGliding ||
    data.recentlyUsedEnderPearl ||
    getGamemode(player.name) === 1 ||
    getGamemode(player.name) === 3
  ) {
    return null;
  }

  // 特定の効果を除いて、効果が付与されている場合は処理をスキップ
  if (hasAnyEffectExcept(player, getExcludedEffects())) {
    return null;
  }

  const isOnGround = player.isOnGround; // 地面にいるかどうか
  const currentPosition = player.location; // 現在の位置

  let lastPosition = data.lastPosition; // 直前の位置 (ローカル変数に変更)

  // 直前の位置情報がない場合は処理をスキップ
  if (!lastPosition) {
    lastPosition = currentPosition; // lastPositionを更新
    playerDataManager.update(player, { lastPosition: lastPosition }); // lastPositionのみを更新
    return null;
  }

  // 垂直速度、垂直加速度を計算
  const currentVelocityY = player.getVelocity().y;
  const previousVelocityY = calculateVerticalVelocity(currentPosition, lastPosition);
  const verticalAcceleration = currentVelocityY - previousVelocityY;

  // 速度変化率を計算 (2ティック間の変化)
  const twoTicksAgoVelocityY = calculateVerticalVelocity(lastPosition, data.positionHistory[data.positionHistory.length - 2]);
  const velocityChangeRate = (currentVelocityY - twoTicksAgoVelocityY) / (50 * 2);

  // FlyHack判定 (地面にいない状態で異常な垂直移動)
  if (!isOnGround && currentVelocityY > 0.5) {
    // 異常な上昇速度
    if (
      currentVelocityY > 1.2 || // 高速上昇
      verticalAcceleration > 0.4 || // 急激な加速
      velocityChangeRate > 0.3 // 短時間での速度変化
    ) {
      console.log(`[DEBUG] ${player.name} FlyHack (上昇) Detected!`);

      // 最後にlastPositionを更新
      playerDataManager.update(player, { lastPosition: currentPosition });

      return { cheatType: 'FlyHack (上昇)' };
    }
  } else if (!isOnGround && currentVelocityY < -0.1 && !player.isFalling) {
    // 通常の落下速度よりも遅い (空中で停止/減速)
    console.log(`[DEBUG] ${player.name} FlyHack (空中停止/減速) Detected!`);

    // 最後にlastPositionを更新
    playerDataManager.update(player, { lastPosition: currentPosition });

    return { cheatType: 'FlyHack (空中停止/減速)' };
  }

  // 現在の位置を直前の位置として保存
  lastPosition = currentPosition; // lastPositionを更新

  // 最後にlastPositionを更新
  playerDataManager.update(player, { lastPosition: lastPosition });

  return null;
}


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

    if (data.isFrozen) {
      player.teleport({ x: player.location.x, y: 500, z: player.location.z }, { dimension: player.dimension });
    } else {
      addPositionHistory(player);

      if (currentTick % 3 === 0) {
        playerDataManager.update(player, { boundaryCenter: player.location });
      }

      const clickTpOutOfBoundaryDetection = detectClickTpOutOfBoundary(player);
      if (clickTpOutOfBoundaryDetection) {
        handleCheatDetection(player, clickTpOutOfBoundaryDetection);
      }

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

      if (configs.antiCheat.betasystem) {
        detectXrayOnSight(player);
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

      playerDataManager.update(player, { lastTime: Date.now() }); // ループの最後に移動
    }
  }
}

// チート検出時の処理
function handleCheatDetection(player: Player, detection: { cheatType: string; value?: number }): void {
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