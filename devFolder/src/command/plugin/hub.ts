import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system, world } from '@minecraft/server';

registerCommand({
    name: 'hub',
    description: 'hub_docs',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['hub']),
    executor: (player: Player) => {
       system.runTimeout(()=>{
        const Default = world.getDefaultSpawnLocation();
        //初期リスTP
        player.teleport(Default);

       },20 * 3)
    },
});
