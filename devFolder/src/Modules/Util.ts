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
    prompt: {
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


export function formatTimestamp(timestamp: string | number | Date): string {
  if (timestamp == null) {
   // console.warn('formatTimestamp received a null or undefined timestamp.');
    return '';
  }

 // console.log('Raw timestamp:', timestamp, typeof timestamp);

  let date: Date;

  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    const parsedInt = parseInt(timestamp, 10);
    if (!isNaN(parsedInt)) {
      date = new Date(parsedInt);
    } else {
      date = new Date(timestamp);
    }
  } else {
    console.error('Invalid timestamp type:', timestamp, typeof timestamp);
    return 'Invalid Timestamp';
  }



 // console.log('Date object (UTC):', date);
 // console.log('Date object in UTC:', date.toUTCString()); // Log the Date in UTC for comparison


  if (isNaN(date.getTime())) {
    console.error('Invalid timestamp:', timestamp);
    return 'Invalid Timestamp';
  }
  // UTCからJSTに変換処理(9時間分のミリ秒を追加)
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));

  const year = jstDate.getFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getDate()).padStart(2, '0');
  const hours = String(jstDate.getHours()).padStart(2, '0');
  const minutes = String(jstDate.getMinutes()).padStart(2, '0');
  const seconds = String(jstDate.getSeconds()).padStart(2, '0');


  const formattedTimestamp = `${year}/${month}/${day}, ${hours}:${minutes}:${seconds}`;

  //console.log('Formatted timestamp (manual):', formattedTimestamp);

  return formattedTimestamp;
}