import { 
    registerCommand, 
    MINECRAFT_COMMAND_PREFIX, 
    isAdmin,
    minecraftCommands,
    MINECRAFT_COMMANDS_PER_PAGE

 } from '../index';





registerCommand('help', `${MINECRAFT_COMMAND_PREFIX}help [ページ番号]`, 'コマンド一覧を表示します。', false, async (sender, world, args) => {
    const page = Math.max(1, parseInt(args[0] || '1') || 1); //Simplified page number handling

    const isAdmins = await isAdmin(sender);
    const commands = Object.values(minecraftCommands);

    const filteredCommands = isAdmins
        ? commands.sort((a, b) => a.name.localeCompare(b.name)) //Sort all commands if admin
        : commands.filter(cmd => !cmd.adminOnly).sort((a, b) => a.name.localeCompare(b.name)); //Sort only non-admin commands otherwise

    const commandsPerPage = MINECRAFT_COMMANDS_PER_PAGE;
    const startIndex = (page - 1) * commandsPerPage;
    const endIndex = startIndex + commandsPerPage;
    const paginatedCommands = filteredCommands.slice(startIndex, endIndex);

    if (paginatedCommands.length === 0) {
        await world.sendMessage(`ページ ${page} は存在しません。`, sender);
        return;
    }

    const totalPages = Math.ceil(filteredCommands.length / commandsPerPage);
    const header = `=== ヘルプ (ページ ${page}/${totalPages}) ===\n`;
    let message = header;

    if (isAdmins) {
        message += "\n§f[管理者コマンド]\n§r";
        for (const command of paginatedCommands) {
            message += `${command.adminOnly ? '§b' : ''}${command.usage}: ${command.description}\n`;
        }
    } else {
        for (const command of paginatedCommands) {
            message += `${command.usage}: ${command.description}\n`;
        }
    }

    if (totalPages > 1) {
        message += `\n§f全 ${totalPages} ページ: #help [ページ番号] で他のページを表示§r`;
    }

    await world.sendMessage(message, sender);
});