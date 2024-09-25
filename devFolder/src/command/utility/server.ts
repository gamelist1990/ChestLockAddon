import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, system, world } from '@minecraft/server';

let isServerPaused = false; // サーバーが一時停止されているかどうかを追跡する変数

export function toggleServerPause() {
    isServerPaused = !isServerPaused; // 一時停止状態を反転

    if (isServerPaused) {
        system.runTimeout(() => { // 1 ティック遅延させてゲームルールを変更
            // 一時停止 
            world.gameRules.mobGriefing = false;
            world.gameRules.doFireTick = false;
            world.gameRules.tntExplodes = false;
            world.gameRules.respawnBlocksExplode = false;
            world.sendMessage('Server paused. Protection enabled');

            // 全プレイヤーの現在地
            for (const player of world.getPlayers()) {
                const { x, y, z } = player.location;
                world.sendMessage(`§f>>§a${player.name}'s   §blocation: x= ${Math.floor(x)}, y= ${Math.floor(y)}, z= ${Math.floor(z)}`);
            }
        }, 1);
    } else {
        system.runTimeout(() => { // 1 ティック遅延させてゲームルールを変更
            // 再開
            world.gameRules.mobGriefing = true;
            world.gameRules.doFireTick = true;
            world.gameRules.tntExplodes = true;
            world.gameRules.respawnBlocksExplode = true;
            world.sendMessage('Server resumed. Protection disabled');
        }, 1);
    }
}

registerCommand({
    name: 'server',
    description: 'server_command_description',
    parent: false,
    maxArgs: 1,
    minArgs: 1,
    require: (player: Player) => verifier(player, config().commands['server']),
    executor: (player: Player, args: string[]) => {
        if (args[0] === '-pause') {
            toggleServerPause();
        } else {
            player.sendMessage('Invalid argument. Use "-pause" to toggle server pause. | 無効な引数です。"-pause"を使用してサーバーの一時停止を切り替えます。');
        }
    },
});