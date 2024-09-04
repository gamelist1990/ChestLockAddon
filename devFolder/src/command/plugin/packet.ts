import { c, getGamemode } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, Vector3, Entity, Effect } from '@minecraft/server';

// ----------------------------------
// --- 設定 ---
// ----------------------------------
const config = {
  debugMode: false,
  antiCheat: {
    detectionThreshold: 1, // ペナルティまでの検知回数
    rollbackTicks: 3 * 20, // ロールバック
    clickTpThreshold: 20, // ClickTP 判定距離
    clickTpExclusionThreshold: 25, 
    freezeDuration: 20 * 60 * 60, // freeze時間
    maxSpeedThreshold: 2, // 最大速度
    betasystem: false,
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
    player.teleport(rollbackPosition, { dimension: player.dimension });
    console.warn(`プレイヤー ${player.name} (ID: ${player.id}) をロールバックしました`);
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
    y: 1000,
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
  }, config.antiCheat.freezeDuration);
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
      const distance = Math.sqrt(
        Math.pow(entity.location.x - player.location.x, 2) +
        Math.pow(entity.location.y - player.location.y, 2) +
        Math.pow(entity.location.z - player.location.z, 2),
      );
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
  } else {
  }



  // ClickTPの距離検出
  const clickTpDistance = Math.sqrt(
    Math.pow(player.location.x - data.positionHistory[0].x, 2) +
    Math.pow(player.location.y - data.positionHistory[0].y, 2) +
    Math.pow(player.location.z - data.positionHistory[0].z, 2),
  );

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

  const isJumping = player.isJumping;
  const isOnGround = player.isOnGround;
  const positionHistory = data.positionHistory;
  const recentPosition = positionHistory[positionHistory.length - 1];
  const previousPosition = positionHistory[positionHistory.length - 2];

  // Initialize jump counter if not present
  if (data.jumpCounter === undefined) {
    data.jumpCounter = 0;
  }

  // プレイヤーがジャンプした場合、ジャンプフラグを立てる
  if (isJumping && recentPosition && previousPosition && recentPosition.y > previousPosition.y) {
    data.isJumping = true;
  }

  // プレイヤーが地面に着地した場合、ジャンプフラグとカウンターをリセット
  if (isOnGround && data.isJumping) {
    data.isJumping = false;
    data.jumpCounter = 0;
    return null;
  }

  // 空中ジャンプの検出
  if (!isOnGround && data.isJumping && isJumping && recentPosition && previousPosition) {
    const jumpHeight = recentPosition.y - previousPosition.y;
    if (jumpHeight > 0.75) { // 大体1.25
      data.jumpCounter++;
      if (data.jumpCounter >= 1) {
        return { cheatType: '(AirJump|Fly)' };
      }
    }
  }

  return null;
}




function detectESP(player: Player): { cheatType: string } | null {
  const viewDirection = player.getViewDirection();
  const playerDimension = player.dimension;

  const otherPlayers = playerDimension.getPlayers().filter(p => p !== player);

  for (const otherPlayer of otherPlayers) {
    const distance = Math.sqrt(
      Math.pow(otherPlayer.location.x - player.location.x, 2) +
      Math.pow(otherPlayer.location.y - player.location.y, 2) +
      Math.pow(otherPlayer.location.z - player.location.z, 2),
    );

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

      const targetBlockIds = ['minecraft:stone', 'minecraft:grass', 'minecraft:dirt'];
      const isPlayerBehindTargetBlocks = isPlayerBehindSpecificBlocks(player, otherPlayer, targetBlockIds, distance);

      if (viewDirectionChange > 0.06) {
        if (!espSuspiciousTime[player.id]) {
          espSuspiciousTime[player.id] = Date.now();
          continue;
        } else {
          if (Date.now() - espSuspiciousTime[player.id] <= 750) {
            if (angle < 0.4 && isPlayerBehindTargetBlocks) {
              delete espSuspiciousTime[player.id];
              return { cheatType: 'ESP (BETA SYSTEM)' }; // ESP
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


let previousAngle = 0; // 1つ前のプレイヤーに対する角度を保存するための変数
const espSuspiciousTime: { [playerId: string]: number } = {}; // プレイヤーごとのESP検知時間

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

    const blockLocation = {
      x: Math.floor(x) + 0.5,
      y: Math.floor(clampedY) + 0.5,
      z: Math.floor(z) + 0.5,
    };

    const block = dimension.getBlock(blockLocation);

    if (block && targetBlockIds.includes(block.type.id)) {
      return true;
    }
  }

  return false;
}




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
          const espDetection = detectESP(player);
          if (espDetection) {
            handleCheatDetection(player, espDetection);
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
          latestPosition: data.positionHistory[data.positionHistory.length - 1],
          lastTime: data.lastTime,
          violationCount: data.violationCount,
          enderDev: data.enderPearlInterval,
          timeOutEnder: data.recentlyUsedEnderPearl,
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