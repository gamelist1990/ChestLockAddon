import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX,
    getData
} from '../index';

registerCommand('ping', `${MINECRAFT_COMMAND_PREFIX}ping`, '自分のping値を確認します', false, async (sender, world) => {
    try {
        const data = await getData(sender);
        if (data) {
            let ping: number | undefined;
            if (Array.isArray(data)) {
                const player = data.find(p => p.name === sender);
                ping = player?.ping;
            } else {
                ping = data.ping;
            }

            if (ping !== undefined) { // pingがundefinedでないことを確認
                await world.sendMessage(`${sender} has ping ${ping}`, sender);
            } else {
                await world.sendMessage(`Could not get ping for ${sender}`, sender);
            }

        } else {
            await world.sendMessage(`Could not get ping for ${sender}`, sender);
        }
    } catch (error) {
        console.error("[Server] Error getting player ping:", error);
        await world.sendMessage(`[Server] Ping取得エラー`, sender);
    }
});