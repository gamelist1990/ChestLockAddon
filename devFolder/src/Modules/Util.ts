import { Player, GameMode, world, system } from '@minecraft/server';

interface CommandConfig {
  enabled: boolean;
  adminOnly: boolean;
  requireTag: string[];
}

interface moduleConfig   {
  enabled:boolean;
  
}

//コマンド登録 関数C
export const c = (): { commands: { [key: string]: CommandConfig }; admin: string, module: {[key: string]: moduleConfig}; } => ({
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
    
  },
  admin: 'op',

  module: {
    debugMode: {
      enabled:true,
    }
  },

  
});

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

export function tempkick(player: Player) {
  system.runTimeout(()=>{
    player.triggerEvent('chestlock:tempkick')
  },1)
}