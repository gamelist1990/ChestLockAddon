import pkg from 'discord.js';
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = pkg;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

client.login("fd196cd4cb9f45feb2b6d02827738d2acde1e99c3d1c33fef2a67e4b13751ba8");

client.on('ready', () => {
    console.log(`login!! (${client.user.tag})`);
});

client.on("interactionCreate", interaction => {
    if (interaction.isCommand() || interaction.isContextMenu()) {
        const embed = new EmbedBuilder()
            .setColor('ffa500')
            .setTitle('コマンド削除完了')
            .setDescription(`コマンド名: ${interaction.commandName}\nコマンドID: ${interaction.commandId}`);
        interaction.reply({ embeds: [embed] }); 
        console.log(`コマンド名: ${interaction.commandName}\nコマンドID: ${interaction.commandId}\nコマンドを削除しました`); 

        client.application.commands.delete(interaction.commandId).catch(error => {
            if (error) {
                client.guilds.cache.get(interaction.guildId).commands.delete(interaction.commandId);
            }
        });
    }
});
