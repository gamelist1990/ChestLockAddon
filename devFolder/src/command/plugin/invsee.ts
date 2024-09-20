import { config } from '../../Modules/Util';
import { registerCommand, verifier, isPlayer } from '../../Modules/Handler';
import { Player, system } from '@minecraft/server';
import { projectPlayerInventory } from '../../Modules/inv';

registerCommand({
    name: 'invsee',
    description: 'プレイヤーのインベントリを見る',
    parent: false,
    maxArgs: 1,
    minArgs: 1,
    require: (player: Player) => verifier(player, config().commands['invsee']),
    executor: (player: Player, args: string[]) => {
        const targetPlayerName = args[0];
        const targetPlayer = isPlayer(targetPlayerName);

        if (targetPlayer) {
            system.runTimeout(() => {
                projectPlayerInventory(targetPlayer, player);
            }, 1)
            player.sendMessage(`プレイヤー ${targetPlayerName} のインベントリを開きました`);
        } else {
            player.sendMessage(`プレイヤー ${targetPlayerName} は見つかりませんでした`);
        }
    },
});