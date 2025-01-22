import { registerCommand, Player } from '../backend';
import { ver } from '../version';
import * as os from 'os';

registerCommand({
    name: 'ver',
    description: 'バックエンドサーバーのバージョン情報を表示します。',
    maxArgs: 0,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: [] },
    executor: async (player: Player) => {
        player.sendMessage(`§e§lバックエンドサーバーのバージョン情報§r`);
        player.sendMessage(`§7--------------------------------§r`);
        player.sendMessage(`§6npmバージョン:§r ${process.env.npm_package_version}`);

        if (os.platform() === 'win32') {
            player.sendMessage(`§6Windowsバージョン:§r ${os.release()}`);
        } else {
            player.sendMessage(`§6OS:§r ${os.platform()}`);
        }

        player.sendMessage(`§6Serverシステム:§r ${ver}`);
        player.sendMessage(`§7--------------------------------§r`);
    },
});