import { Player, GameMode, world, system, PlatformType, MemoryTier, InputMode, } from '@minecraft/server';
import { uiManager } from '@minecraft/server-ui';



interface CommandConfig {
  enabled: boolean;
  adminOnly: boolean;
  requireTag: string[];
}

interface moduleConfig {
  enabled: boolean;

}

//コマンド登録(ここから機能有効/無効切り替えてね)
export const config = (): { commands: { [key: string]: CommandConfig }; admin: string, staff: string, module: { [key: string]: moduleConfig }; } => ({
  commands: {
    chest: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    help: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    lang: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    dev: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    jpch: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    ui: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    list: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    item: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    tpa: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    join: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    warpgate: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    edit: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    anticheat: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    lore: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    about: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    report: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    staff: {
      enabled: true,
      adminOnly: false,
      requireTag: ["staff", "op"],
    },
    invsee: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    offhand: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    server: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    tag: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    hub: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    ping: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    ban: {
      enabled: true,
      adminOnly: false,
      requireTag: ["staff","op"],
    },
    unban: {
      enabled: true,
      adminOnly: false,
      requireTag: ["staff", "op"],
    },
    banlist: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    lockdown: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    transfer: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    }
  },
  
  admin: 'op',
  staff: 'staff',

  module: {
    debugMode: {
      enabled: false,
    },
    sumoSystem: {
      enabled: true,
    },
    ScoreSystem: {
      enabled: true,
    }
  },


});

//その他 



/**
 * Gets the gamemode of a player by their name.
 *
 * @param playerName - The name of the player whose gamemode is to be retrieved.
 * @returns The index of the gamemode in the `gamemodes` array, or 0 if the player is not found in any gamemode.
 */
export function getGamemode(playerName: string): number {
  const gamemodes: GameMode[] = [
    GameMode.survival,
    GameMode.creative,
    GameMode.adventure,
    GameMode.spectator,
  ];

  for (const [index, gameMode] of gamemodes.entries()) {
    if (world.getPlayers({ name: playerName, gameMode }).length > 0) {
      return index;
    }
  }

  return 0;
}



/**
 * Retrieves the names of all players in the world except the current player.
 *
 * @param currentPlayer - The player whose name should be excluded from the list.
 * @returns An array of player names excluding the current player's name.
 */
export function getAllPlayerNames(currentPlayer: Player): string[] {
  const playerNames: string[] = [];
  for (const player of world.getPlayers()) {
    if (player.name !== currentPlayer.name) {
      playerNames.push(player.name);
    }
  }
  return playerNames;
}

export function getPlayerByName(playerName: string): Player | null {
  for (const player of world.getPlayers()) {
    if (player.name === playerName) {
      return player; 
    }
  }
  return null; 
}


export function kick(player: Player, reason: string, by: string) {
  const textReason = `§c§lYou have been kicked\n§r§7Reason: §c${reason ?? "--"}\n§7By: §c${by ?? "--"}`;
  world.getDimension(player.dimension.id).runCommandAsync(`kick "${player.name}" ${textReason}`);
}


export function clientdevice(player: Player): number {
  const systemInfo = player.clientSystemInfo;
  switch (systemInfo.platformType) {
    case PlatformType.Desktop:
      return 0; //PC
    case PlatformType.Mobile:
      return 1; //iPhone
    case PlatformType.Console:
      return 2; //console全般
    default:
      return -1;//不明
  }
}


export function InputType(player:Player): number {
  const inputMode = player.inputInfo;
  switch (inputMode.lastInputModeUsed) {
    case InputMode.KeyboardAndMouse:
      return 0;
    case InputMode.Gamepad:
      return 1;
    case InputMode.MotionController:
      return 2;
    case InputMode.Touch:
      return 3;
    default:
      return -1;
  }
}



export function getMemoryTier(player: Player): number {
  const systemInfo = player.clientSystemInfo;
  switch (systemInfo.memoryTier) {
    case MemoryTier.SuperLow:
      return 0;
    case MemoryTier.Low:
      return 1;
    case MemoryTier.Mid:
      return 2;
    case MemoryTier.High:
      return 3;
    case MemoryTier.SuperHigh:
      return 4;
    default:
      return -1; 
  }
}






export function getDimension(player: Player): string {
  const dimensionId = player.dimension.id;

  switch (dimensionId) {
    case "overworld":
      return "Overworld";
    case "nether":
      return "Nether";
    case "the_end":
      return "The End";
    default:
      return dimensionId;
  }
}

export function tempkick(player: Player) {
  system.runTimeout(() => {
    player.triggerEvent('chestlock:tempkick')
  }, 1)
}


export function closeForm(player: Player) {
  uiManager.closeAllForms(player as any);
}



/**
 * Formats a given timestamp into a string with the format `YYYY/MM/DD HH:mm:ss` adjusted for a specified timezone offset.
 *
 * @param {string | number | Date} timestamp - The timestamp to format. Can be a string, number, or Date object.
 * @param {number} timezoneOffsetHours - The timezone offset in hours to adjust the timestamp.
 * @returns {string} The formatted timestamp string. Returns 'Invalid Timestamp' if the input is invalid, or 'Unexpected Error' if an unexpected error occurs.
 */
export function formatTimestamp(timestamp: string | number | Date, timezoneOffsetHours: number): string {
  if (timestamp == null) {
    return '';
  }

  let date: Date;

  try {
    if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      // 文字列の場合は、Date.parseを使用する
      const parsedDate = new Date(Date.parse(timestamp));
      if (isNaN(parsedDate.getTime())) {
        console.error('Invalid timestamp string:', timestamp);
        return 'Invalid Timestamp';
      }
      date = parsedDate;
    } else {
      console.error('Invalid timestamp type:', timestamp, typeof timestamp);
      return 'Invalid Timestamp';
    }

    if (isNaN(date.getTime())) {
      console.error('Invalid timestamp:', timestamp);
      return 'Invalid Timestamp';
    }

    const timezoneOffsetMilliseconds = timezoneOffsetHours * 60 * 60 * 1000;
    const adjustedDate = new Date(date.getTime() + timezoneOffsetMilliseconds);
    const year = adjustedDate.getFullYear();
    const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getDate()).padStart(2, '0');
    const hours = String(adjustedDate.getHours()).padStart(2, '0');
    const minutes = String(adjustedDate.getMinutes()).padStart(2, '0');
    const seconds = String(adjustedDate.getSeconds()).padStart(2, '0');

    const formattedTimestamp = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    return formattedTimestamp;

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return 'Unexpected Error';
  }
}

// JST でフォーマットする場合 (JSTはUTC+9)
export function formatTimestampJST(date: Date): string {
  const jstOffset = 9 * 60; // JSTはUTC+9時間なので、分単位でオフセットを計算
  const localDate = new Date(date.getTime() + jstOffset * 60 * 1000);

  const hours = localDate.getUTCHours().toString().padStart(2, '0');
  const minutes = localDate.getUTCMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`; // 秒を削除
}

// UTC でフォーマットする場合 (UTCはオフセット0)
export function formatTimestampUTC(timestamp: string | number | Date): string {
  return formatTimestamp(timestamp, 0);
}