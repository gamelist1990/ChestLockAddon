import { registerCommand, wsserver, Command, prefix } from '../backend';
import { Player } from '../module/player';


function showHelp(player: Player, commands: Record<string, Command>, commandPrefix: string, pageOrCommand: string | number = 1) {
    const commandsPerPage = 5;

    if (typeof pageOrCommand === 'string') {
        const command = commands[pageOrCommand.toLowerCase()];
        if (command) {
            // 特定のコマンドの詳細情報を表示
            player.sendMessage(`§e--- コマンド詳細: ${commandPrefix}${command.name} ---`);
            player.sendMessage(`§a${commandPrefix}${command.name}§r: ${command.description}`);
            player.sendMessage(`§e使用法:§r ${command.usage ? `§a${commandPrefix}${command.usage}§r` : 'なし'}`);
        } else {
            player.sendMessage(`§cコマンド '${pageOrCommand}' は存在しません。`);
        }
    } else {
        // ページネーションされたコマンドリストを表示
        const page = pageOrCommand;
        const availableCommands = Object.values(commands);

        const startIndex = (page - 1) * commandsPerPage;
        const endIndex = startIndex + commandsPerPage;
        const commandsToShow = availableCommands.slice(startIndex, endIndex);

        const totalPages = Math.ceil(availableCommands.length / commandsPerPage);

        if (page > totalPages) {
            player.sendMessage(`§cページ ${page} は存在しません。`);
            return;
        }

        player.sendMessage(`§e--- コマンド一覧 (ページ ${page}/${totalPages}) ---`);
        commandsToShow.forEach(command => {
            player.sendMessage(`§a${commandPrefix}${command.name}§r: ${command.description}`);
        });

        if (totalPages > 1) {
            if (page > 1) {
                player.sendMessage(`§b前のページ: ${commandPrefix}help ${page - 1}`);
            }
            if (page < totalPages) {
                player.sendMessage(`§b次のページ: ${commandPrefix}help ${page + 1}`);
            }
        }
    }
}

registerCommand({
    name: 'help',
    description: '利用可能なコマンド一覧を表示します。または、特定のコマンドの詳細を表示します。',
    maxArgs: 1,
    minArgs: 0,
    usage: "help [page | command]",
    config: { enabled: true, adminOnly: false, requireTag: [] },
    executor: (player: Player, args: string[]) => {
        const commandPrefix = prefix;
        const arg = args[0];

        if (arg) {
            const maybePage = parseInt(arg);
            if (isNaN(maybePage)) {
                showHelp(player, wsserver.commands, commandPrefix, arg);
            } else {
                showHelp(player, wsserver.commands, commandPrefix, maybePage);
            }
        } else {
            showHelp(player, wsserver.commands, commandPrefix, 1);
        }
    },
});