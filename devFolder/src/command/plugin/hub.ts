import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system } from '@minecraft/server';

registerCommand({
    name: 'hub',
    description: 'Hubコマンド',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['hub']),
    executor: (player: Player) => {
       system.runTimeout(()=>{
           const hub = { x: 3, y: -59, z: 11 }; 
           player.teleport(hub);
       })
    },
});
