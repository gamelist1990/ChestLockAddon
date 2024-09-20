import { isPlayer, registerCommand, verifier } from '../../Modules/Handler';
import { Player } from '@minecraft/server';
import { getEnderChest } from '../../Modules/viewChest';
import { config } from '../../Modules/Util';
import { translate } from '../langs/list/LanguageManager';

registerCommand({
    name: 'echest',
    description: 'command.echestDocs',
    parent: false,
    maxArgs: 2,
    minArgs: 2,
    require: (player: Player) => verifier(player, config().commands['echest']),
    executor: (player: Player, args: string[]) => {
        if (args[0] !== '-view') {
            player.sendMessage(translate(player,"command.echestInvalid"));
            return;
        }

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

        const enderChest = getEnderChest(targetPlayer);

        if (!enderChest) {
            player.sendMessage(
                translate(player, 'commands.echestEmpty', {
                    tragetplayer: `${targetPlayerName}`,
                }),
            );
            return;
        }

        player.sendMessage(
            translate(player, 'commands.echest', {
                tragetplayer: `${targetPlayerName}`,
            }),
        );
        for (let i = 0; i < 27; i++) {
            const item = enderChest.getItem(i);
            if (item) {
                player.sendMessage(`Slot ${i + 1}: ${item}`);
            }
        }
    },
});