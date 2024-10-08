import { world, Player, EntityHealthComponent } from '@minecraft/server';
import { config, getDimension } from '../../Modules/Util';
import { registerCommand, isPlayer, verifier, prefix } from '../../Modules/Handler';
import { getGamemode, getPing } from '../../Modules/Util';
import { translate } from '../langs/list/LanguageManager';

registerCommand({
  name: 'list',
  description: 'Display player information',
  parent: false,
  maxArgs: 2,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['list']),
  executor: async (player, args) => {
    if (args.length === 1 && args[0] === 'all') {
      sendAllPlayersInfoToChat(player);
      return;
    }

    if (args.length === 2) {
      const targetPlayerName = args[1];
      const targetPlayer = isPlayer(targetPlayerName);

      if (!targetPlayer) {
        player.sendMessage(
          translate(player, 'commands.list.playerNotFound', {
            tragetplayer: `${targetPlayerName}`,
          }),
        );
        return;
      }

      if (args[0] === 'show') {
        sendPlayerInfoToChat(player, targetPlayer);
      } else {
        player.sendMessage(translate(player, 'commands.list.usage', { prefix: `${prefix}` }));
      }
    } else {
      player.sendMessage(translate(player, 'commands.list.usage', { prefix: `${prefix}` }));
    }
  },
});

function sendPlayerInfoToChat(player: Player, targetPlayer: Player): void {
  const allPlayers = world.getPlayers();
  const targetPlayerData = allPlayers.find((p) => p.name === targetPlayer.name);

  if (!targetPlayerData) {
    player.sendMessage(
      translate(player, 'commands.list.playerNotFound', {
        tragetplayer: `${targetPlayer.name}`,
      }),
    );
    return;
  }

  const healthComponent = targetPlayerData.getComponent(
    'minecraft:health',
  ) as EntityHealthComponent;
  const health = healthComponent ? healthComponent.currentValue.toFixed(2) : '';

  const gameModeIndex = getGamemode(targetPlayerData.name);
  const gameMode = ['Survival', 'Creative', 'Adventure', 'Spectator'][gameModeIndex];

  const ping = getPing(targetPlayerData);

  //const device = clientdevice(targetPlayerData);
  const device = 0;
  const deviceName = device === 0 ? "Desktop" : device === 1 ? "Mobile" : device === 2 ? "Console" : "Unknown";

  const dimension = getDimension(targetPlayerData);

  //const memoryTier = getMemoryTier(targetPlayerData);
  const memoryTier = 0;
  const memoryTierName = memoryTier === 0 ? "Memory:Undetermined" :
    memoryTier === 1 ? "Memory:1.5GB" :
      memoryTier === 2 ? "Memory:2GB" :
        memoryTier === 3 ? "Memory:4GB" :
          memoryTier === 4 ? "Memory:8GB" :
            memoryTier === 5 ? "Memory:8GB or more" : "Memory:Unknown";

  player.sendMessage(
    translate(player, 'commands.list.playerInfo', {
      name: `${targetPlayerData.name}`,
      TargetID: `${targetPlayerData.id.toString()}`,
      TargetX: `${targetPlayerData.location.x.toFixed(2)}`,
      TargetY: `${targetPlayerData.location.y.toFixed(2)}`,
      TargetZ: `${targetPlayerData.location.z.toFixed(2)}`,
      health: `${health}`,
      GameMode: `${gameMode}`,
      ping: `${ping.toString()}`,
      device: `${deviceName}`,
      dimension: `${dimension}`,
      memory: `${memoryTierName}`
    }),
  );
}

function sendAllPlayersInfoToChat(player: Player): void {
  const allPlayers = world.getPlayers();

  allPlayers.forEach((targetPlayerData) => {
    const healthComponent = targetPlayerData.getComponent(
      'minecraft:health',
    ) as EntityHealthComponent;
    const health = healthComponent ? healthComponent.currentValue.toFixed(2) : '';

    const gameModeIndex = getGamemode(targetPlayerData.name);
    const gameMode = ['Survival', 'Creative', 'Adventure', 'Spectator'][gameModeIndex];

    const ping = getPing(targetPlayerData);

    const device = 0;
    const deviceName = device === 0 ? "Desktop" : device === 1 ? "Mobile" : device === 2 ? "Console" : "Unknown";
    const dimension = getDimension(targetPlayerData);
    const memoryTier = 0;
    const memoryTierName = memoryTier === 0 ? "Memory:Undetermined" :
      memoryTier === 1 ? "Memory:1.5GB" :
        memoryTier === 2 ? "Memory:2GB" :
          memoryTier === 3 ? "Memory:4GB" :
            memoryTier === 4 ? "Memory:8GB" :
              memoryTier === 5 ? "Memory:8GB or more" : "Memory:Unknown";

    player.sendMessage(
      translate(player, 'commands.list.playerInfo', {
        name: `${targetPlayerData.name}`,
        TargetID: `${targetPlayerData.id.toString()}`,
        TargetX: `${targetPlayerData.location.x.toFixed(2)}`,
        TargetY: `${targetPlayerData.location.y.toFixed(2)}`,
        TargetZ: `${targetPlayerData.location.z.toFixed(2)}`,
        health: `${health}`,
        GameMode: `${gameMode}`,
        ping: `${ping.toString()}`,
        device: `${deviceName}`,
        dimension: `${dimension}`,
        memory: `${memoryTierName}`
      }),
    );
  });
}