import { Player, GameMode, world, system,  } from '@minecraft/server';

interface CommandConfig {
  enabled: boolean;
  adminOnly: boolean;
  requireTag: string[];
}

interface moduleConfig   {
  enabled:boolean;
  
}

//コマンド登録 関数C
export const config = (): { commands: { [key: string]: CommandConfig }; admin: string, module: {[key: string]: moduleConfig}; } => ({
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
      requireTag: ["staff","op"],
    },
    invsee: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    }, 
    echest: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    }, 
    
  },
  admin: 'op',

  module: {
    debugMode: {
      enabled:true,
    }
  },

  
});

//その他 



export function getGamemode(playerName: string) {
  const gamemodes: GameMode[] = [
    GameMode.survival,
    GameMode.creative,
    GameMode.adventure,
    GameMode.spectator,
  ];

  for (let i = 0; i < 4; i++) {
    if (
      world.getPlayers({
        name: playerName,
        gameMode: gamemodes[i],
      }).length != 0
    )
      return i;
  }

  return 0;
}

export const getPing = (player: Player) => player.pingTick ?? 0;

export function getAllPlayerNames(currentPlayer: Player): string[] {
  const players = world.getPlayers();
  return players.filter((p) => p.name !== currentPlayer.name).map((p) => p.nameTag);
}


export function kick(player: Player, reason: string, by: string) {
  const textReason = `§c§lYou have been kicked\n§r§7Reason: §c${reason ?? "--"}\n§7By: §c${by ?? "--"}`;
  world.getDimension(player.dimension.id).runCommandAsync(`kick "${player.name}" ${textReason}`);
}

/* 
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
  */


/**
 export function getMemoryTier(player: Player): number {
  const systemInfo = player.clientSystemInfo;
  switch (systemInfo.memoryTier) {
    case MemoryTier.Undetermined:
      return 0;
    case MemoryTier.SuperLow:
      return 1;
    case MemoryTier.Low:
      return 2;
    case MemoryTier.Mid:
      return 3;
    case MemoryTier.High:
      return 4;
    case MemoryTier.SuperHigh:
      return 5;
    default:
      return -1; // Unknown
  }
}
 */





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
  system.runTimeout(()=>{
    player.triggerEvent('chestlock:tempkick')
  },1)
}

