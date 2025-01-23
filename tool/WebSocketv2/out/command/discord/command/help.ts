import { Message, EmbedBuilder } from "discord.js";
import { checkPrefixCommandPermission, registerDisCommand, registeredCommands } from "../discord";


registerDisCommand({
    name: "help",
    description: "コマンド一覧を表示します。",
    config: {
        enabled: true,
        requireLevel: 0,
    },
    prefixExecutor: async (message: Message, args: string[]) => {
        if (!message.member) return;
        if (checkPrefixCommandPermission(message, 0)) {
            const helpEmbed = new EmbedBuilder()
                .setTitle("コマンド一覧")
                .setDescription("利用可能なコマンドの一覧です。")
                .addFields(
                    registeredCommands
                        .filter((command) => command.config.enabled)
                        .map((command) => ({
                            name: `#>>${command.name}`, // プレフィックスコマンドに変更
                            value: `${command.description} (権限レベル: ${command.config.requireLevel})`,
                        }))
                )
                .setColor(0x00ff00);
            await message.reply({ embeds: [helpEmbed] }).catch(console.error);
        } else {
            await message.reply("このコマンドを実行する権限がありません。").catch(console.error);
        }
    },
});

registerDisCommand({
    name: "ping",
    description: "Ping値を返します",
    config: {
        enabled: true,
        requireLevel: 0,
    },
    prefixExecutor: async (message: Message, args: string[]) => {
        if (!message.member) return;
        if (checkPrefixCommandPermission(message, 0)) {
            const ping = Date.now() - message.createdTimestamp;
            await message.reply(`Pong! 現在のping値は ${ping}ms です。`).catch(console.error);
        } else {
            await message.reply("このコマンドを実行する権限がありません。").catch(console.error);
        }
    },
});