import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

client.login("aaaaaaaaaaaaaaaaaaaaaaaaaaaa"); 

client.on('ready', () => {
    console.log(`ログインしました！ (${client.user.tag})`);
});

client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand() || interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
        const commandName = interaction.commandName;
        const commandId = interaction.commandId;
        const guildId = '890315487962095637'; // Verify this Guild ID

        const embed = new EmbedBuilder()
            .setColor('ffa500')
            .setTitle('コマンド削除完了')
            .setDescription(`コマンド名: ${commandName}\nコマンドID: ${commandId}`);

        try {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const commands = await guild.commands.fetch();
                const command = commands.get(commandId);
                if (command) {
                    await command.delete();
                    console.log(`Deleted guild command: ${commandName} (${commandId}) in guild ${guildId}`);
                    return interaction.reply({ embeds: [embed] });
                }
            }

            await client.application.commands.delete(commandId);
            console.log(`Deleted global command: ${commandName} (${commandId})`);
            return interaction.reply({ embeds: [embed] });


        } catch (error) {
            console.error("Command deletion failed:", error);
            return interaction.reply({ content: "コマンドの削除に失敗しました。", ephemeral: true });
        }
    }
});