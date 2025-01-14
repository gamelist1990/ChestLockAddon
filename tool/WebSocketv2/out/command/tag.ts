import { registerCommand, Player } from '../backend';

registerCommand({
    name: 'tags',
    description: 'タグ情報を表示します。',
    maxArgs: 0,
    minArgs: 0,
    config: { enabled: true, adminOnly: false, requireTag: ['op'] },
    executor: async (player: Player) => {
        const checkOpTag = async () => {
            const hasOpTag = await player.hasTag('op');
            player.sendMessage(`${player.name} has 'op' tag: ${hasOpTag}`);
        };

        const listTags = async () => {
            const tags = (await player.getTags());
            player.sendMessage(`${player.name}'s tags: ${tags.join(', ')}`);
        };

        await checkOpTag();
        await listTags();
    },
});