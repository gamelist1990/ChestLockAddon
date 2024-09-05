import { world, Player, EntityHealthComponent } from '@minecraft/server';
import { c } from '../../Modules/Util';
import { registerCommand, isPlayer, verifier, prefix } from '../../Modules/Handler';
import { getGamemode, getPing } from '../../Modules/Util';
import { translate } from '../langs/list/LanguageManager';

registerCommand({
  name: 'list',
  description: 'Displayplayerinformation',
  parent: false,
  maxArgs: 2,
  minArgs: 0,
  require: (player: Player) => verifier(player, c().commands['list']),
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
  }
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
      }),
    );
  });
}
