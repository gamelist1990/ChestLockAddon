import { registerCommand, verifier,isPlayer } from "../Handler";
import { c } from "../Util";
import { world, Player, system, Vector3} from "@minecraft/server";
import { translate } from "./langs/list/LanguageManager"

interface ChestProtectionData {
  owner: string;
  isLocked: boolean;
  members: string[];
}

const CHECK_INTERVAL = 20 * 60; // 1分 (20ティック/秒 * 60秒)
//json形式
let protectedChests: Record<string, ChestProtectionData> = {};

// コマンド登録
registerCommand({
  name: "chest",
  description: "chest_command",
  parent: false,
  maxArgs: 2,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands["chest"]),
  executor: async (player: Player, args: string[]) => {
    if (args.length === 0) {
      sendInvalidCommandMessage(player);
      return;
    }

    const subcommand = args[0];

    switch (subcommand) {
      case "lock":
        protectChest(player, true);
        break;
      case "info":
        showNearbyChestInfo(player);
        break;
      case "unlock":
        protectChest(player, false);
        break;
      case "protect":
        if (args.length === 2) {
          toggleChestProtection(player, args[1]);
        } else {
          sendInvalidCommandMessage(player);
        }
        break;
      case "dev":
        if (player.hasTag("op")) {
          if (args.length === 2 && args[1] === "-reset") {
            resetProtectedChests(player);
          } else {
            showProtectedChestData(player);
          }
        } else {
          player.sendMessage(translate(player,"unavailable"));
        }
        break;
      case "add":
        if (args.length === 2) {
          addMember(player, args[1]);
        } else {
          sendInvalidCommandMessage(player);
        }
        break;
      case "remove":
        if (args.length === 2) {
          removeMember(player, args[1]);
        } else {
          sendInvalidCommandMessage(player);
        }
        break;
      case "all":
        listMembers(player);
        break;
      default:
        sendInvalidCommandMessage(player);
    }
  },
});

function sendInvalidCommandMessage(player: Player) {
  const version = `§bVersion 0.3`
  const message = translate(player, "chest_help")


  player.sendMessage(message);
  player.sendMessage(version);
}


// 近くのチェストの情報を表示する関数
function showNearbyChestInfo(player: Player) {
  const nearbyChestLocation = findNearbyChest(player);

  if (nearbyChestLocation) {
    let message = translate(player, "nearby_chest_info") + "\n";
    message += `${translate(player, "coordinate_x")}${nearbyChestLocation.x}\n`;
    message += `${translate(player, "coordinate_y")}${nearbyChestLocation.y}\n`;
    message += `${translate(player, "coordinate_z")}${nearbyChestLocation.z}\n`;

    const chestKey = getChestKey(nearbyChestLocation);
    const chestData = protectedChests[chestKey];

    if (chestData) {
      message += translate(player, "protected") + "\n";
      message += `${translate(player, "owner")}${chestData.owner}\n`;
      if (chestData.members && chestData.members.length > 0) {
        message += `${translate(player, "members")}${chestData.members.join(", ")}\n`;
      }
      const isLargeChest = findAdjacentChest(nearbyChestLocation) !== null;
      message += `${translate(player, "large_chest")}${isLargeChest ? translate(player, "yes") : translate(player, "no")}\n`;
    } else {
      const isLargeChest = findAdjacentChest(nearbyChestLocation) !== null;
      message += `${translate(player, "large_chest")}${isLargeChest ? translate(player, "yes") : translate(player, "no")}\n`;
      message += translate(player, "not_protected") + "\n";
    }
    player.sendMessage(message);
  } else {
    player.sendMessage(translate(player, "notFound_chest"));
  }
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
          player.sendMessage(translate(player,"chestProtectRemove"));
        } else {
          player.sendMessage(translate(player,"AlreadyProChest"));
        }
      } else {
        player.sendMessage(translate(player,"NotAllowed"));
      }
    } else {
      protectedChests[chestKey] = {
        owner: player.name,
        isLocked: lockState,
        members: [],
      };
      saveProtectedChests();
      player.sendMessage(translate(player, `chest_lookstate`));
      player.sendMessage(`§a(${lockState ? "locked" : "unlocked"} !!)`);



    }
  } else {
    player.sendMessage(translate(player,"notFound_chest"));
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
        const block = world.getDimension("overworld").getBlock(blockLocation);
        if (isChest(block)) {
          return blockLocation;
        }
      }
    }
  }
  return null;
}



export function showProtectedChestData(player: Player) {
  player.sendMessage("§a---- Protected Chests Data ----");
  player.sendMessage(JSON.stringify(protectedChests));
  console.warn(JSON.stringify(protectedChests));
}

// protectedChests をリセットする関数
export function resetProtectedChests(player: Player) {
  protectedChests = {};
  saveProtectedChests();
  player.sendMessage(translate(player,"chest_removeData"));
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

  system.runInterval(() => {
    for (const chestKey in protectedChests) {
      const chestLocation = parseChestKey(chestKey);
  
      // チェストの存在チェック
      const currentBlock = world.getDimension("overworld").getBlock(chestLocation);
      if (!isChest(currentBlock)) {
        revertChest(chestLocation);
      }
    }
  }, 3); 
  

  // ピストンによるチェストの移動を制限
  world.beforeEvents.itemUseOn.subscribe((eventData: any) => {
    handlePistonUse(eventData);
  });

  system.runInterval(() => {
    checkProtectedChests();
  }, CHECK_INTERVAL);
});

const RADIUS2 = 2; // 検知範囲1
const RADIUS1 = 14; // 検知範囲2
const RADIUS2_IDS = ["minecraft:hopper", "minecraft:hopper_minecart"]; // 検知範囲1のアイテムID
const RADIUS1_IDS = ["minecraft:piston", "minecraft:sticky_piston"]; // 検知範囲2のアイテムID


function handlePistonUse(eventData: any) {
  let playerActions: { [playerName: string]: Vector3[] } = {};

  const player = eventData.source;
  const itemStack = eventData.itemStack;
  if (!player || !itemStack) return;

  const itemId = itemStack.typeId;
  const blockLocation = eventData.block.location;

  if (RADIUS2_IDS.includes(itemId)) {
    if (!isWithinDetectionArea(blockLocation, RADIUS2)) return;
  } else if (RADIUS1_IDS.includes(itemId)) {
    if (!isWithinDetectionArea(blockLocation, RADIUS1)) return;
  } else {
    return;
  }

  if (!playerActions[player.name]) {
    playerActions[player.name] = [];
  }
  playerActions[player.name].push(blockLocation);
  if (isMovingTowardsChest(playerActions[player.name])) {
    eventData.cancel = true;
    player.sendMessage(translate(player, "cannotPlaceItem"));
  }
}

// 検知範囲内かどうか判定
function isWithinDetectionArea(location: Vector3, radius: number): boolean {
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const blockLocation: Vector3 = {
          x: location.x + x,
          y: location.y + y,
          z: location.z + z,
        };
        if (isProtectedChest(blockLocation)) {
          return true;
        }
      }
    }
  }

  return false;
}

function isMovingTowardsChest(locations: Vector3[]): boolean {
  if (locations.length === 0) {
    return false;
  }
  const lastLocation = locations[locations.length - 1];
  return isWithinDetectionArea(lastLocation, RADIUS1);
}

// 保護されたチェストかどうか判定
function isProtectedChest(location: Vector3): boolean {
  const key = `${location.x},${location.y},${location.z}`;
  return protectedChests.hasOwnProperty(key);
}


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

  const dimension = world.getDimension("overworld");

  for (const direction of directions) {
    const adjacentLocation = {
      x: location.x + direction.x,
      y: location.y + direction.y,
      z: location.z + direction.z,
    };
    const block = dimension.getBlock(adjacentLocation);

    if (block && isChest(block)) {
      console.warn(`Found chest at: ${adjacentLocation.x}, ${adjacentLocation.y}, ${adjacentLocation.z}`);
      console.warn(`Block type: ${block.typeId}`);

      // 1. 元の位置のブロックを空気ブロックに設定
      const clearCommand = `/setblock ${location.x} ${location.y} ${location.z} air`;
      console.warn(`Running command: ${clearCommand}`);
      await dimension.runCommandAsync(clearCommand).then(result => {
        console.warn(`Clear command result: ${JSON.stringify(result)}`);
      }).catch(error => {
        console.warn(`Clear command error: ${error}`);
      });

      // 2. チェストを元の位置に戻す
      const command = `/clone ${adjacentLocation.x} ${adjacentLocation.y} ${adjacentLocation.z} ${adjacentLocation.x} ${adjacentLocation.y} ${adjacentLocation.z} ${location.x} ${location.y} ${location.z} replace move`;
      console.warn(`Running command: ${command}`);
      await dimension.runCommandAsync(command).then(result => {
        console.warn(`Clone command result: ${JSON.stringify(result)}`);
      }).catch(error => {
        console.warn(`Clone command error: ${error}`);
      });

      break;
    }
  }
}










function checkProtectedChests() {
  for (const chestKey in protectedChests) {
    const location = parseChestKey(chestKey);
    const dimension = world.getDimension("overworld");

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
  saveProtectedChests();
}



function parseChestKey(chestKey: string): any {
  const [x, y, z] = chestKey.split(",").map(Number);
  return { x, y, z };
}


// チェストへのアクセスを処理する関数
function handleChestInteraction(event: any) {
  const chestKey = getChestKey(event.block.location);
  const chestData = protectedChests[chestKey];

  if (chestData && chestData.isLocked) {
    if (chestData.owner !== event.player.name && !chestData.members?.includes(event.player.name) && !event.player.hasTag("op")) {
      event.cancel = true;
      event.player.sendMessage(translate(event.player, "isLookChest"));
    }
  }
}

function handleChestBreak(event: any) {
  const chestKey = getChestKey(event.block.location);
  const chestData = protectedChests[chestKey];

  if (chestData) {
    if (event.player) {
      const player = event.player;
      if (chestData.owner === player.name || player.hasTag("op")) {
        delete protectedChests[chestKey];
        saveProtectedChests();
        player.sendMessage(translate(player, "ProChestBreak"));
      } else {
        event.cancel = true;
        player.sendMessage(translate(player, "isProChest"));
      }
    } else {
      event.cancel = true;
      event.world.sendMessage("The chest was destroyed by a cause other than the player.");
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
      if (source && source.typeId === "minecraft:player") { // プレイヤーが原因の場合
        const player = source as Player;
        player.sendMessage(translate(player, "ExplosionWarning")); // 警告メッセージを送信
      }
    }
  }
}








// チェストかどうかを判定する関数
function isChest(block: any): boolean {
  return block && (block.typeId === "minecraft:chest" || block.typeId === "minecraft:trapped_chest");
}



// チェストのキーを取得する関数
function getChestKey(location: any): string {
  const block = world.getDimension("overworld").getBlock(location);
  if (block && (block.typeId === "minecraft:chest" || block.typeId === "minecraft:trapped_chest")) {
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
    const block = world.getDimension("overworld").getBlock(adjacentLocation);
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
      const newLockState = state === "lock";
      chestData.isLocked = newLockState;
      saveProtectedChests();
      player.sendMessage(translate(player, "lockChange"));
      player.sendMessage(`§a ${newLockState ? "locked" : "unlocked"}`);

    } else {
      player.sendMessage(translate(player,"NotChest"));
    }
  } else {
    player.sendMessage(translate(player,"notFound_chest"));
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
          player.sendMessage(`§a${memberName}`);
          player.sendMessage(translate(player, "AddM"));

          // 追加されたプレイヤーに通知
          translate(player, "addYouM", {
            playerName: player.name,
            chestLocation: `${nearbyChestLocation.x}, ${nearbyChestLocation.y}, ${nearbyChestLocation.z}`
          }, targetPlayer);
          
        } else {
          player.sendMessage(`§c${memberName}`);
          player.sendMessage(translate(player, "PlayerNotFound"));
        }
      } else {
        player.sendMessage(`§c${memberName}`);
        player.sendMessage(translate(player, "MAlreday"));
      }
    } else {
      player.sendMessage(translate(player, "NotChest"));
    }
  } else {
    player.sendMessage(translate(player, "notFound_chest"));
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
        player.sendMessage(`§a${memberName}`)
        player.sendMessage(translate(player,"RemoveM"));

        translate(player, "RemoveYouM", {
          playerName: player.name,
          chestLocation: `${nearbyChestLocation.x}, ${nearbyChestLocation.y}, ${nearbyChestLocation.z}`
        }, targetPlayer);
      } else {
        player.sendMessage(`§c${memberName}`)
        player.sendMessage(translate(player,"NotM"));
      }
    } else {
      player.sendMessage(translate(player,"NotChest"));
    }
  } else {
    player.sendMessage(translate(player,"notFound_chest"));
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
        player.sendMessage(translate(player,"allM"));
        player.sendMessage(`§e${chestData.members.join(", ")}`);
      } else {
        player.sendMessage(translate(player,"NotFoundM"));
      }
    } else {
      player.sendMessage(translate(player,"NotChest"));
    }
  } else {
    player.sendMessage(translate(player,"notFound_chest"));
  }
}

// データの保存関数
function saveProtectedChests() {
  const data = JSON.stringify(protectedChests);
  world.setDynamicProperty("protectedChests", data);
}

// データの読み込み関数
function loadProtectedChests() {
  const data = world.getDynamicProperty("protectedChests");
  if (data && typeof data === 'string') {
    protectedChests = JSON.parse(data);
  }
}