import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system, world } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

registerCommand({
    name: 'hub',
    description: 'hub_docs',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['hub']),
    executor: (player: Player) => {
        let countdown = 5; // カウントダウンの開始値

        const intervalId = system.runInterval(() => {
            player.sendMessage(translate(player,"command.hub.move",{countdown:`${countdown}`}))
            countdown--;

            if (countdown < 0) {
                system.clearRun(intervalId);
                const Default = world.getDefaultSpawnLocation();
                player.teleport(Default);
            }
        }, 20); 
    },
});
