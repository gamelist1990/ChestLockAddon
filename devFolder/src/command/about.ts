import { Player } from '@minecraft/server';
import { registerCommand, verifier } from '../Modules/Handler';
import { config } from '../Modules/Util';
import { translate } from './langs/list/LanguageManager';
import { ver } from '../Modules/version';

registerCommand({
    name: 'about',
    description: 'aboutCom',
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['about']),
    executor: (player: Player) => {
        player.sendMessage(translate(player, 'command.about'));
        player.sendMessage(translate(player, 'ServerVersion', { version: `${ver}` }));
    },
});
