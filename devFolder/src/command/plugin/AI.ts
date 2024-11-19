import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player } from '@minecraft/server';
import { minecraftChatbot } from '../../Modules/mikaAI';

registerCommand({
    name: 'prompt',
    description: 'prompt Command',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['prompt']),
    executor: (player: Player, args: string[]) => {
        if (args.length > 0) {
            let response = minecraftChatbot(args[0]);
            player.sendMessage(response);
        }
    },
});
