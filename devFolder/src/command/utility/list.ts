import { world, Player, EntityHealthComponent } from '@minecraft/server';
import { clientdevice, config, getDimension, getMemoryTier, InputType } from '../../Modules/Util';
import { registerCommand, isPlayer, verifier, prefix } from '../../Modules/Handler';
import { getGamemode } from '../../Modules/Util';
import { translate } from '../langs/list/LanguageManager';
import { getPing } from './server';

registerCommand({
  name: 'list',
  description: 'Display player information',
  parent: false,
  maxArgs: 2,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['list']),
  executor: async (player, args) => {
    if (args.length === 1 && args[0] === 'all') {
      sendPlayersInfoToChat(player);
      return;
    }

    if (args.length === 2 && args[0] === 'show') {
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
      sendPlayersInfoToChat(player, targetPlayer);
    } else {
      player.sendMessage(translate(player, 'commands.list.usage', { prefix: `${prefix}` }));
    }
  },
});

async function sendPlayersInfoToChat(player: Player, targetPlayer?: Player): Promise<void> {
  const allPlayers = world.getPlayers();
  const playersToSend = targetPlayer ? [targetPlayer] : allPlayers;

  for (const targetPlayerData of playersToSend) {
    const healthComponent = targetPlayerData.getComponent(
      'minecraft:health',
    ) as EntityHealthComponent;
    const health = healthComponent ? Math.floor(healthComponent.currentValue) : '';

    const gameModeIndex = getGamemode(targetPlayerData.name);
    const gameMode = ['Survival', 'Creative', 'Adventure', 'Spectator'][gameModeIndex];

    const { ping } = await getPing(targetPlayerData);

    const device = clientdevice(targetPlayerData);
    const deviceName = device === 0 ? "Desktop" : device === 1 ? "Mobile" : device === 2 ? "Console" : "Unknown";

    const dimension = getDimension(targetPlayerData);

    const memoryTier = getMemoryTier(targetPlayerData);
    const memoryTierName =
      memoryTier === 0 ? "Memory:1.5GB" :
        memoryTier === 1 ? "Memory:2GB" :
          memoryTier === 2 ? "Memory:4GB" :
            memoryTier === 3 ? "Memory:8GB" :
              memoryTier === 4 ? "Memory:8GB or more" : "Memory:Unknown";

    const inputmode = InputType(targetPlayerData);
    const inputmodeTierName =
      inputmode === 0 ? "keyboard" :
        inputmode === 1 ? "GamePad" :
          inputmode === 2 ? "MotionController(VR)" :
            inputmode === 3 ? "Touch" : "InputType:Unknown";


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
                    inputType: `${inputmodeTierName}`,
                    dimension: `${dimension}`,
                    memory: `${memoryTierName}`
                  }),
                );
  }
}