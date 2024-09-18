import { c } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system, world } from '@minecraft/server';
import { checkReports } from './report';
import { translate } from '../langs/list/LanguageManager';

function announce(player: Player, message: string) {
    world.sendMessage(`§l§f[§bServer§f]: ${message}`);
    player.sendMessage(`World Send Done..`);
}

registerCommand({
    name: 'staff',
    description: 'staff_command_description',
    parent: false,
    maxArgs: 100,
    minArgs: 1,
    require: (player: Player) => verifier(player, c().commands['staff']),
    executor: (player: Player, args: string[]) => {
        const subCommand = args[0];
        const option = args[1];
        

        if (subCommand === 'world') {
            if (option === '-send') {
                const message = args[2];
                announce(player, message);
            }
        } else if (subCommand === 'report') {
            if (option === '-check') {
                player.sendMessage(translate(player,"closeChat"))
                system.runTimeout(()=>{
                    checkReports(player);
                },60)
            }

        } else {
            player.sendMessage(translate(player,"commnad.staff.UsageCom"))
        }
    },
});