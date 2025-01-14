import { registerCommand, Player } from "../backend";

registerCommand({
    name: 'run',
    description: 'Minecraftサーバーでコマンドを実行します。',
    minArgs: 1,
    config: { enabled: true, adminOnly: true, requireTag: [] },
    executor: async (player: Player, args: string[]) => {
        const command = args.join(' ');
        const result = await player.runCommand(command);
        player.sendMessage(`Command Result: ${JSON.stringify(result)}`);
    },
});