import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX,
    playerList,
    userData
} from '../index';

registerCommand('check', `${MINECRAFT_COMMAND_PREFIX}check <info|list> [time]`, 'プレイヤー情報をチェックします。', true, async (sender, world, args) => {
    if (args.length === 0) {
        world.sendMessage(`使用方法: ${MINECRAFT_COMMAND_PREFIX}check <info|list> [time]`, sender);
        return;
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === 'info') {
        const timeFilter = args[1] === 'time' ? true : false;
        let page = 1;
        if (args[2] !== undefined) { // ページ番号が指定されているかチェック
            page = parseInt(args[2]);
            if (isNaN(page) || page < 1) {
                page = 1;
            }
        }


        const onlinePlayers = await playerList();
        const onlinePlayerNames = onlinePlayers ? onlinePlayers.map(p => p.name) : [];

        let playersToShow = Object.values(userData)
            .filter(player => !onlinePlayerNames.includes(player.name));

        if (timeFilter) {
            playersToShow = playersToShow.sort((a, b) => new Date(b.lastLeave).getTime() - new Date(a.lastLeave).getTime());
        }

        const startIndex = (page - 1) * 5;
        const endIndex = startIndex + 5;
        const paginatedPlayers = playersToShow.slice(startIndex, endIndex);
        if (paginatedPlayers.length === 0) {
            world.sendMessage(`ページ ${page} は存在しません。`, sender);
            return;
        }
        let message = `=== プレイヤー情報 (ページ ${page}) ===\n`;
        for (const player of paginatedPlayers) {
            message += `\n${player.name}:`;
            if (timeFilter) {
                message += ` 最後に参加した時間: ${player.lastLeave}`;
            } else {
                message += ` UUID: ${player.uuid}, Ping: ${player.ping}, パケットロス: ${player.PacketLoss}, 平均Ping: ${player.Avgping}, 平均パケットロス: ${player.Avgpacketloss}, 最終ログイン: ${player.lastLeave}`;
            }
        }
        const totalPages = Math.ceil(playersToShow.length / 5);
        if (totalPages > 1) {
            message += `\n\n全 ${totalPages} ページ: #check info time [ページ番号] で他のページを表示`;
        }

        world.sendMessage(message, sender);
    }

    else if (subcommand === 'list') {
        const onlinePlayers = await playerList();
        if (onlinePlayers) {
            world.sendMessage(`オンラインプレイヤー: ${onlinePlayers.map(p => p.name).join(', ')}`, sender);
        } else {
            world.sendMessage("オンラインプレイヤーの取得に失敗しました。", sender);
        }
    } else {
        world.sendMessage(`不明なサブコマンドです: ${subcommand}`, sender);
    }
});