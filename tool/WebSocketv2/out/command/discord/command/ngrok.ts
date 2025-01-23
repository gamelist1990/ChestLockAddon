import { Message, EmbedBuilder } from "discord.js";
import {
    checkPrefixCommandPermission,
    ngrokEnabled,
    ngrokUrls,
    recreateNgrok,
    registerDisCommand,
} from "../discord";



registerDisCommand({
    name: "get_url",
    description: "ngrokのURLを取得します。",
    config: {
        enabled: true,
        requireLevel: 0, // 全員が使えるように
    },
    prefixExecutor: async (message: Message, args: string[]) => {
        if (!message.member) return;

        let requiredPermissionLevel = 0; // デフォルトの権限レベル

        // 引数で権限レベルが指定されているかチェック
        if (args.length > 0) {
            const levelArg = parseInt(args[0]);
            if (!isNaN(levelArg) && levelArg >= 0 && levelArg <= 3) {
                requiredPermissionLevel = levelArg;
            }
        }

        if (
            checkPrefixCommandPermission(message, requiredPermissionLevel)
        ) {
            if (ngrokUrls && ngrokEnabled) {
                const embed = new EmbedBuilder()
                    .setTitle("ngrok URLs")
                    .addFields({ name: "Web URL", value: ngrokUrls.web.url })
                    .addFields({ name: "Status URL", value: ngrokUrls.web.url + "/api" })
                    .addFields({ name: "API URL", value: ngrokUrls.api.url })
                    .setColor(0x00ff00)
                    .setTimestamp();
                await message.author.send({ embeds: [embed] }).catch(console.error);
                await message
                    .reply({ content: "ngrokのURLをDMに送信しました。" })
                    .catch(console.error);
            } else {
                await message
                    .reply({
                        content:
                            "ngrok URLが取得できませんでした。ngrokが起動していない可能性があります。",
                    })
                    .catch(console.error);
            }
        } else {
            await message
                .reply({ content: "このコマンドを実行する権限がありません。" })
                .catch(console.error);
        }
    },
});

registerDisCommand({
    name: "new_ngrok",
    description: "ngrokのURLを再生成します。",
    config: {
        enabled: true,
        requireLevel: 3, // 管理者権限
    },
    prefixExecutor: async (message: Message, args: string[]) => {
        if (!message.member) return;
        if (checkPrefixCommandPermission(message, 3)) {
            if (ngrokEnabled) {
                await recreateNgrok();
                await message
                    .reply({ content: "ngrok URLを再生成しました。#>>get_url で確認してください。" })
                    .catch(console.error);
            } else {
                await message
                    .reply({
                        content:
                            "ngrok URLを再生成する為には、まずngrokを起動してください。",
                    })
                    .catch(console.error);
            }
        } else {
            await message
                .reply({ content: "このコマンドを実行する権限がありません。" })
                .catch(console.error);
        }
    },
});