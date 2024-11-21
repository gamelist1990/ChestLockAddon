import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player } from '@minecraft/server';
import { getPing } from './server';

registerCommand({
    name: 'ping',
    description: 'Pingdocs',
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['ping']),
    executor: async (player) => {
        const ping = await getPing();
        player.sendMessage(`you are Ping:${ping}`)
        
    },
});
