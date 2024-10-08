import { registerCommand, verifier, isPlayer } from '../../Modules/Handler';
import { config } from '../../Modules/Util';
import { ver } from '../../Modules/version';
import { saveData, loadData, chestLockAddonData } from '../../Modules/DataBase';
import { world, Player, system, Vector3, PlayerPlaceBlockBeforeEvent } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

interface ChestProtectionData {
  owner: string;
  isLocked: boolean;
  members: string[];
}

const CHEST_CHECK_RADIUS = 64;

const CHECK_INTERVAL = 20 * 60; // 1分 (20ティック/秒 * 60秒)

let protectedChests: Record<string, ChestProtectionData> = {};

// コマンド登録
registerCommand({
  name: 'chest',
  description: 'chest_command',
  parent: false,
  maxArgs: 2,
  minArgs: 1,
  require: (player: Player) => verifier(player, config().commands['chest']),
  executor: async (player: Player, args: string[]) => {
    if (args.length === 0) {
      sendInvalidCommandMessage(player);
      return;
    }

    const subcommand = args[0];

    switch (subcommand) {
      case 'lock':
        protectChest(player, true);
        break;
      case 'info':
        showNearbyChestInfo(player);
        break;
      case 'unlock':
        protectChest(player, false);
        break;
      case 'protect':
        if (args.length === 2) {
          toggleChestProtection(player, args[1]);
        } else {
          sendInvalidCommandMessage(player);
        }
        break;
      case 'dev':
        if (player.hasTag('op')) {
          if (args.length === 2 && args[1] === '-reset') {
            resetProtectedChests(player);
          } else {
            showProtectedChestData(player);
          }
        } else {
          player.sendMessage(translate(player, 'unavailable'));
        }
        break;
      case 'add':
        if (args.length === 2) {
          addMember(player, args[1]);
        } else {
          sendInvalidCommandMessage(player);
        }
        break;
      case 'remove':
        if (args.length === 2) {
          removeMember(player, args[1]);
        } else {
          sendInvalidCommandMessage(player);
        }
        break;
      case 'all':
        listMembers(player);
        break;
      case 'list':
        listProtectedChests(player);
        break;
      default:
        sendInvalidCommandMessage(player);
    }
  },
});

function listProtectedChests(player: Player) {
  const playerName = player.name;
  const playerChests = Object.entries(protectedChests).filter(
    ([, data]) => data.owner === playerName,
  );

  if (playerChests.length > 0) {
    player.sendMessage(
      translate(player, `ChestlistCom`, { playerChests: `${playerChests.length}` }),
    );
    playerChests.forEach(([key]) => {
      player.sendMessage(translate(player, `chestlocation`, { key: `${key}` }));
    });
  } else {
    player.sendMessage(translate(player, `notFound_chest`));
  }
}

function sendInvalidCommandMessage(player: Player) {
  const version = `§bVersion ${ver}`;
  const message = translate(player, 'chest_help');

  player.sendMessage(message);
  player.sendMessage(version);
}

// 近くのチェストの情報を表示する関数
function showNearbyChestInfo(player: Player) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    let message = translate(player, 'nearby_chest_info') + '\n';
    message += `${translate(player, 'coordinate_x')}${nearbyChestLocation.x}\n`;
    message += `${translate(player, 'coordinate_y')}${nearbyChestLocation.y}\n`;
    message += `${translate(player, 'coordinate_z')}${nearbyChestLocation.z}\n`;

    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData) {
      message += translate(player, 'protected') + '\n';
      message += `${translate(player, 'owner')}${chestData.owner}\n`;
      if (chestData.members && chestData.members.length > 0) {
        message += `${translate(player, 'members')}${chestData.members.join(', ')}\n`;
      }
      const isLargeChest = findAdjacentChest(nearbyChestLocation) !== null;
      message += `${translate(player, 'large_chest')}${isLargeChest ? translate(player, 'yes') : translate(player, 'no')}\n`;
    } else {
      const isLargeChest = findAdjacentChest(nearbyChestLocation) !== null;
      message += `${translate(player, 'large_chest')}${isLargeChest ? translate(player, 'yes') : translate(player, 'no')}\n`;
      message += translate(player, 'not_protected') + '\n';
    }
    player.sendMessage(message);
  } else {
    player.sendMessage(translate(player, 'notFound_chest'));
  }
}

//オーナーが持つチェスト数を確認
function countProtectedChestsByOwner(owner: string): number {
  let count = 0;
  for (const chestKey in protectedChests) {
    if (protectedChests[chestKey].owner === owner) {
      count++;
    }
  }
  return count;
}

// チェストを保護する関数
function protectChest(player: Player, lockState: boolean) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData) {
      if (chestData.owner === player.name) {
        if (lockState === false) {
          delete protectedChests[chestKey];
          saveProtectedChests();
          player.sendMessage(translate(player, 'chestProtectRemove'));
        } else {
          player.sendMessage(translate(player, 'AlreadyProChest'));
        }
      } else {
        player.sendMessage(translate(player, 'NotChest'));
      }
    } else {
      const protectedChestCount = countProtectedChestsByOwner(player.name);
      if (protectedChestCount >= 10) {
        player.sendMessage(
          translate(player, 'MaxChestLimitReached', { protectChest: `${protectedChestCount}` }),
        );
      } else {
        protectedChests[chestKey] = {
          owner: player.name,
          isLocked: lockState,
          members: [],
        };
        saveProtectedChests();
        player.sendMessage(
          translate(player, `chest_lookstate`, {
            lcokstate: `§a(${lockState ? 'locked' : 'unlocked'} !!)`,
          }),
        );
        player.sendMessage(
          translate(player, `chestLocksCount`, { protectChest: `${protectedChestCount + 1}` }),
        );
      }
    }
  } else {
    player.sendMessage(translate(player, 'notFound_chest'));
  }
}

// プレイヤーの近くのチェストを見つける関数
function findNearbyChest(player: Player): any | null {
  const playerLocation = player.location;
  const searchRange = 1;

  for (let x = -searchRange; x <= searchRange; x++) {
    for (let y = -searchRange; y <= searchRange; y++) {
      for (let z = -searchRange; z <= searchRange; z++) {
        const blockLocation: any = {
          x: Math.floor(playerLocation.x + x),
          y: Math.floor(playerLocation.y + y),
          z: Math.floor(playerLocation.z + z),
        };
        const block = world.getDimension('overworld').getBlock(blockLocation);
        if (isChest(block)) {
          return blockLocation;
        }
      }
    }
  }
  return null;
}

export function showProtectedChestData(player: Player) {
  const data = chestLockAddonData.protectedChests;
  player.sendMessage('§a---- Protected Chests Data ----');
  player.sendMessage(JSON.stringify(protectedChests));
  player.sendMessage('\n');
  player.sendMessage('§a---- Protected Chests Data By DataBase ----');
  player.sendMessage(JSON.stringify(data, null, 2));
  console.warn(JSON.stringify(data, null, 2));
}

// protectedChests をリセットする関数
export function resetProtectedChests(player: Player) {
  protectedChests = {};
  saveProtectedChests();
  player.sendMessage(translate(player, 'chest_removeData'));
}

// イベントリスナー：チェストへのアクセスを制御
system.run(() => {
  loadProtectedChests();
  //@ts-ignore
  world.beforeEvents.playerInteractWithBlock.subscribe((event: any) => {
    const block = event.block;
    if (isChest(block)) {
      handleChestInteraction(event);
    }
  });

  world.beforeEvents.playerBreakBlock.subscribe((event: any) => {
    handleChestBreak(event);
  });

  world.beforeEvents.explosion.subscribe((eventData: any) => {
    handleExplosion(eventData);
  });

  world.beforeEvents.playerPlaceBlock.subscribe((eventData: any) => {
    handlePistonUse(eventData);
  });

  system.runInterval(() => {
    checkProtectedChests();
    saveProtectedChests();
  }, CHECK_INTERVAL);
});

//system.runInterval(() => {
//for (const chestKey in protectedChests) {
//  const chestLocation = parseChestKey(chestKey);
//    const currentBlock = world.getDimension("overworld").getBlock(chestLocation);
//  if (!isChest(currentBlock)) {
//   revertChest(chestLocation);
//  }
//}
//}, 3);

const RADIUS2 = 2;
const RADIUS1 = 14;
const RADIUS2_IDS = ['minecraft:hopper', 'minecraft:hopper_minecart'];
const RADIUS1_IDS = ['minecraft:piston', 'minecraft:sticky_piston'];

function handlePistonUse(eventData: PlayerPlaceBlockBeforeEvent) {
  const player = eventData.player;
  const permutation = eventData.permutationBeingPlaced;
  const itemId = permutation.type.id;
  const blockLocation = eventData.block.location;
  if (!player || !permutation) return;

  if (
    (RADIUS2_IDS.includes(itemId) && isWithinDetectionArea(blockLocation, RADIUS2)) ||
    (RADIUS1_IDS.includes(itemId) && isWithinDetectionArea(blockLocation, RADIUS1))
  ) {
    // 設置位置の周辺にある保護されたチェストを探索し、オーナーかどうかを確認
    let isOwner = false;
    for (let x = -RADIUS2; x <= RADIUS2; x++) {
      for (let y = -RADIUS2; y <= RADIUS2; y++) {
        for (let z = -RADIUS2; z <= RADIUS2; z++) {
          const nearbyLocation: Vector3 = {
            x: blockLocation.x + x,
            y: blockLocation.y + y,
            z: blockLocation.z + z,
          };
          const chestKey = getChestKey(nearbyLocation);
          const chestData = protectedChests[chestKey];
          if (chestData && chestData.owner === player.nameTag) { // player.nameTag を使用
            isOwner = true;
            break;
          }
        }
        if (isOwner) break;
      }
      if (isOwner) break;
    }

    // オーナーではない場合のみキャンセル
    if (!isOwner) {
      eventData.cancel = true;
      player.sendMessage(translate(player, 'cannotPlaceItem'));
    }
  }
}

// 検知範囲内かどうか判定
function isWithinDetectionArea(location: Vector3, radius: number): boolean {
  const chestLocations = Object.keys(protectedChests).map((key) => {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  });

  for (const chestLocation of chestLocations) {
    const distance = Math.sqrt(
      Math.pow(location.x - chestLocation.x, 2) +
      Math.pow(location.y - chestLocation.y, 2) +
      Math.pow(location.z - chestLocation.z, 2)
    );

    if (distance <= radius) {
      return true;
    }
  }
  return false;
}

// 保護されたチェストかどうか判定
function isProtectedChest(location: Vector3): boolean {
  const key = `${location.x},${location.y},${location.z}`;
  return protectedChests.hasOwnProperty(key);
}

//@ts-ignore
async function revertChest(location: Vector3) {
  const key = `${location.x},${location.y},${location.z}`;
  const chestData = protectedChests[key];
  if (!chestData) return;

  // 方向の配列を定義
  const directions = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];

  const dimension = world.getDimension('overworld');

  for (const direction of directions) {
    const adjacentLocation = {
      x: location.x + direction.x,
      y: location.y + direction.y,
      z: location.z + direction.z,
    };
    const block = dimension.getBlock(adjacentLocation);

    if (block && isChest(block)) {
      console.warn(
        `Found chest at: ${adjacentLocation.x}, ${adjacentLocation.y}, ${adjacentLocation.z}`,
      );
      console.warn(`Block type: ${block.typeId}`);

      // 1. 元の位置のブロックを空気ブロックに設定
      const clearCommand = `/setblock ${location.x} ${location.y} ${location.z} air`;
      console.warn(`Running command: ${clearCommand}`);
      await dimension
        .runCommandAsync(clearCommand)
        .then((result) => {
          console.warn(`Clear command result: ${JSON.stringify(result)}`);
        })
        .catch((error) => {
          console.warn(`Clear command error: ${error}`);
        });

      // 2. チェストを元の位置に戻す
      const command = `/clone ${adjacentLocation.x} ${adjacentLocation.y} ${adjacentLocation.z} ${adjacentLocation.x} ${adjacentLocation.y} ${adjacentLocation.z} ${location.x} ${location.y} ${location.z} replace move`;
      console.warn(`Running command: ${command}`);
      await dimension
        .runCommandAsync(command)
        .then((result) => {
          console.warn(`Clone command result: ${JSON.stringify(result)}`);
        })
        .catch((error) => {
          console.warn(`Clone command error: ${error}`);
        });

      break;
    }
  }
}

function checkProtectedChests() {
  const players = world.getPlayers(); // オンラインのプレイヤーを取得

  for (const chestKey in protectedChests) {
    const location = parseChestKey(chestKey);
    const dimension = world.getDimension('overworld');

    // プレイヤーがチェストの近くにいたらチェックを行う
    const isPlayerNearby = players.some(player =>
      Math.abs(player.location.x - location.x) <= CHEST_CHECK_RADIUS &&
      Math.abs(player.location.y - location.y) <= CHEST_CHECK_RADIUS &&
      Math.abs(player.location.z - location.z) <= CHEST_CHECK_RADIUS
    );

    if (isPlayerNearby) {
      try {
        const block = dimension.getBlock(location);
        if (!isChest(block)) {
          delete protectedChests[chestKey];
          console.warn(`Removed data for non-existent chest at ${chestKey}`);
        }
      } catch (error) {
        console.warn(`Chunk at ${location} is not loaded.`);
      }
    }
  }
  saveProtectedChests();
}

function parseChestKey(chestKey: string): any {
  const [x, y, z] = chestKey.split(',').map(Number);
  return { x, y, z };
}

// チェストへのアクセスを処理する関数
//
function handleChestInteraction(event: any) {
  const chestKey = getChestKey(event.block.location);
  const chestData = protectedChests[chestKey];

  if (chestData && chestData.isLocked) {
    if (
      chestData.owner !== event.player.name &&
      !chestData.members?.includes(event.player.name) &&
      !event.player.hasTag('op') &&
      !event.player.hasTag('staff')
    ) {
      event.cancel = true;
      event.player.sendMessage(translate(event.player, 'isLookChest'));
    }
  }
}

function handleChestBreak(event: any) {
  const chestKey = getChestKey(event.block.location);
  const chestData = protectedChests[chestKey];

  if (chestData) {
    if (event.player) {
      const player = event.player;
      if (chestData.owner === player.name || player.hasTag('op') || player.hasTag('staff')) {
        delete protectedChests[chestKey];
        saveProtectedChests();
        player.sendMessage(translate(player, 'ProChestBreak'));
      } else {
        event.cancel = true;
        player.sendMessage(translate(player, 'isProChest'));
      }
    } else {
      event.cancel = true;
      event.world.sendMessage('The chest was destroyed by a cause other than the player.');
    }
  }
}

// 爆発によるチェスト破壊を処理する関数
function handleExplosion(eventData: any) {
  const impactedBlocks = eventData.getImpactedBlocks();
  for (const block of impactedBlocks) {
    if (isChest(block) && isProtectedChest(block.location)) {
      eventData.cancel = true; // チェストの破壊をキャンセル

      // 爆発の原因となったエンティティを取得
      const source = eventData.source;
      if (source && source.typeId === 'minecraft:player') {
        // プレイヤーが原因の場合
        const player = source as Player;
        player.sendMessage(translate(player, 'ExplosionWarning')); // 警告メッセージを送信
      }
    }
  }
}

// チェストかどうかを判定する関数
function isChest(block: any): boolean {
  try {
    return (
      block && (block.typeId === 'minecraft:chest' || block.typeId === 'minecraft:trapped_chest')
    );
  } catch (error) {
    return true;
  }
}

// チェストのキーを取得する関数
function getChestKey(location: any): string {
  const block = world.getDimension('overworld').getBlock(location);
  if (block && (block.typeId === 'minecraft:chest' || block.typeId === 'minecraft:trapped_chest')) {
    const adjacentChest = findAdjacentChest(location);
    if (adjacentChest) {
      const minX = Math.min(location.x, adjacentChest.x);
      const minY = Math.min(location.y, adjacentChest.y);
      const minZ = Math.min(location.z, adjacentChest.z);
      return `${minX},${minY},${minZ}`;
    }
  }
  return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

function findAdjacentChest(location: any): any | null {
  const directions = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];

  for (const direction of directions) {
    const adjacentLocation = {
      x: location.x + direction.x,
      y: location.y + direction.y,
      z: location.z + direction.z,
    };
    const block = world.getDimension('overworld').getBlock(adjacentLocation);
    if (isChest(block)) {
      return adjacentLocation;
    }
  }
  return null;
}

// チェストの保護状態を切り替える関数
function toggleChestProtection(player: Player, state: string) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData && chestData.owner === player.name) {
      const newLockState = state === 'lock';
      chestData.isLocked = newLockState;
      saveProtectedChests();
      player.sendMessage(
        translate(player, 'lockChange', { lock: `${newLockState ? 'locked' : 'unlocked'}` }),
      );
    } else {
      player.sendMessage(translate(player, 'NotChest'));
    }
  } else {
    player.sendMessage(translate(player, 'notFound_chest'));
  }
}

// メンバー追加関数
function addMember(player: Player, memberName: string) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData && chestData.owner === player.name) {
      if (!chestData.members.includes(memberName)) {
        // プレイヤーの存在確認
        const targetPlayer = isPlayer(memberName);
        if (targetPlayer) {
          chestData.members.push(memberName);
          saveProtectedChests();
          player.sendMessage(
            translate(player, 'AddM', {
              member: `${memberName}`,
              chestLocation: `${nearbyChestLocation.x}, ${nearbyChestLocation.y}, ${nearbyChestLocation.z}`,
            }),
          );

          // 追加されたプレイヤーに通知
          translate(
            player,
            'addYouM',
            {
              playerName: player.name,
              chestLocation: `${nearbyChestLocation.x}, ${nearbyChestLocation.y}, ${nearbyChestLocation.z}`,
            },
            targetPlayer,
          );
        } else {
          player.sendMessage(translate(player, 'PlayerNotFound'));
        }
      } else {
        player.sendMessage(translate(player, 'MAlreday', { member: `${memberName}` }));
      }
    } else {
      player.sendMessage(translate(player, 'NotChest'));
    }
  } else {
    player.sendMessage(translate(player, 'notFound_chest'));
  }
}

// メンバー削除関数
function removeMember(player: Player, memberName: string) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData && chestData.owner === player.name) {
      const memberIndex = chestData.members.indexOf(memberName);
      const targetPlayer = isPlayer(memberName);
      if (memberIndex !== -1) {
        chestData.members.splice(memberIndex, 1);
        saveProtectedChests();
        player.sendMessage(translate(player, 'RemoveM', { member: `${memberName}` }));

        translate(
          player,
          'RemoveYouM',
          {
            playerName: player.name,
            chestLocation: `${nearbyChestLocation.x}, ${nearbyChestLocation.y}, ${nearbyChestLocation.z}`,
          },
          targetPlayer,
        );
      } else {
        player.sendMessage(`§c${memberName}`);
        player.sendMessage(translate(player, 'NotM'));
      }
    } else {
      player.sendMessage(translate(player, 'NotChest'));
    }
  } else {
    player.sendMessage(translate(player, 'notFound_chest'));
  }
}

// メンバー一覧表示関数
function listMembers(player: Player) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData && chestData.owner === player.name) {
      if (chestData.members.length > 0) {
        player.sendMessage(translate(player, 'allM'));
        player.sendMessage(`§e${chestData.members.join(', ')}`);
      } else {
        player.sendMessage(translate(player, 'NotFoundM'));
      }
    } else {
      player.sendMessage(translate(player, 'NotChest'));
    }
  } else {
    player.sendMessage(translate(player, 'notFound_chest'));
  }
}

// データの保存関数
//function saveProtectedChests() {
//  const data = JSON.stringify(protectedChests);
//  world.setDynamicProperty("protectedChests", data);
//}

function saveProtectedChests(): void {
  saveData('protectedChests', protectedChests);
}

// データの読み込み関数
export function loadProtectedChests(): void {
  loadData();
  const data = chestLockAddonData.protectedChests;
  if (data && typeof data === 'object') {
    protectedChests = data;
  }
}
