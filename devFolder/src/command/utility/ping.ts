import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player } from '@minecraft/server';
import { getPing } from './server';

registerCommand({
    name: 'ping',
    description: 'Pingdocs',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['ping']),
    executor: async (player, args) => {
        const { ping } = await getPing();
        if (args[0] === '-my' || args[0] === '-m') {
            player.sendMessage(`Your Ping: ${ping}`);
        } else {
        }
    },
});