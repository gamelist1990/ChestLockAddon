import { Message, EmbedBuilder } from "discord.js";
import { checkPrefixCommandPermission, registerDisCommand, registeredCommands } from "../discord";
import { world } from "../../../backend";
import e from "express";


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

registerDisCommand({
    name: "list",
    description: "プレイヤー人数を表示します",
    config: {
        enabled: true,
        requireLevel: 0,
    },
    prefixExecutor: async (message: Message) => {
        if (!message.member) return;
        if (checkPrefixCommandPermission(message, 0)) {
            // world が存在するかどうかを確認する (おそらくグローバル変数か何かに格納されていると想定)
            if (typeof world !== 'undefined' && world) { // 型チェックと存在チェックを追加
                const players = await world.getPlayers();
                if (players && players.length > 0) {
                    const playerNames = players.map((player) => player.name).join(", ");
                    const embed = new EmbedBuilder()
                        .setTitle("現在のプレイヤー")
                        .addFields(
                            { name: "人数", value: `${players.length}人` },
                            { name: "プレイヤー名", value: playerNames }
                        )
                        .setColor(0x00ff00);
                    await message.reply({ embeds: [embed] }).catch(console.error);
                } else {
                    await message.reply("現在オンラインのプレイヤーはいません。").catch(console.error);
                }
            } else {
                await message.reply("マイクラサーバーに接続されていません。").catch(console.error);
            }
        } else {
            await message.reply("このコマンドを実行する権限がありません。").catch(console.error);
        }
    },
});