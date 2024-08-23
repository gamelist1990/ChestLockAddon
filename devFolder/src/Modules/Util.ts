import { Player, GameMode, world} from "@minecraft/server";


interface CommandConfig {
  enabled: boolean;
  adminOnly: boolean;
  requireTag: string[];
}

export const c = (): { commands: { [key: string]: CommandConfig }, admin: string } => ({
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
      adminOnly: false,
      requireTag: [],
    },
    item: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    anticheat: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
  },
  
  admin: "op",
});


export function getGamemode(playerName: string) {
  const gamemodes: GameMode[] = [GameMode.survival, GameMode.creative, GameMode.adventure, GameMode.spectator];

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
