import { registerCommand, verifier } from '../../Modules/Handler';
import { Player } from '@minecraft/server';
import { getEnderChest } from '../../Modules/viewChest';
import { config } from '../../Modules/Util';

registerCommand({
    name: 'echest',
    description: 'View a player\'s ender chest contents.',
    parent: false,
    maxArgs: 2,
    minArgs: 2,
    require: (player: Player) => verifier(player, config().commands['echest']),
    executor: (player: Player, args: string[]) => {
        if (args[0] !== '-view') {
            player.sendMessage('Invalid usage. Use: /echest -view <playername>');
            return;
        }

        const targetPlayerName = args[1];
        const targetPlayer = player.dimension.getPlayers().find(p => p.name === targetPlayerName);

        if (!targetPlayer) {
            player.sendMessage(`Player ${targetPlayerName} not found.`);
            return;
        }

        const enderChest = getEnderChest(targetPlayer);

        if (!enderChest) {
            player.sendMessage(`${targetPlayerName}'s ender chest is empty.`);
            return;
        }

        player.sendMessage(`${targetPlayerName}'s Ender Chest:`);
        for (let i = 0; i < 27; i++) {
            const item = enderChest.getItem(i);
            if (item) {
                player.sendMessage(`Slot ${i + 1}: ${item}`);
            }
        }
    },
});