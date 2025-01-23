import {
    Message,
    EmbedBuilder,
    User,
    TextChannel,
    CategoryChannel,
    PermissionsBitField,
    ChannelType,
} from "discord.js";
import { checkPrefixCommandPermission, registerDisCommand } from "../discord";
import { addUser, removeUser } from "../../server";

// 認証情報を管理するためのマップ
const authRequests = new Map<
    string,
    { action: string; user: User; channel: TextChannel }
>();

// パスワードの強度をチェックするための正規表現
const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// 認証リクエストの開始処理
async function handleAuthRequest(
    message: Message,
    action: "create" | "remove"
) {
    if (!message.member || !message.guild) return;

    const requestId = message.author.id;

    if (authRequests.has(requestId)) {
        await message
            .reply("既に認証リクエストを処理中です。")
            .catch(console.error);
        return;
    }

    const category = message.guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === "Auth Requests"
    ) as CategoryChannel;
    if (!category) {
        await message
            .reply("Auth Requestsカテゴリが見つかりません。")
            .catch(console.error);
        return;
    }

    const privateChannel = await message.guild.channels
        .create({
            name: `auth-${message.author.username}`,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: message.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: message.author.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                {
                    id: message.client.user!.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.ManageChannels,
                    ],
                },
            ],
        })
        .catch(console.error);

    if (!privateChannel) {
        await message
            .reply("プライベートチャンネルの作成に失敗しました。")
            .catch(console.error);
        return;
    }

    // コマンドが実行された場所でメンション
    await message
        .reply(
            `${privateChannel} に移動して、認証リクエストを続けてください。`
        )
        .catch(console.error);

    authRequests.set(requestId, {
        action,
        user: message.author,
        channel: privateChannel,
    });

    const embed = new EmbedBuilder()
        .setTitle("認証リクエスト")
        .setDescription(
            `${action === "create" ? "認証情報を作成" : "認証情報を削除"
            }する場合は、"yes" と入力してください。キャンセルする場合は "no" と入力してください。`
        )
        .setColor(0x00ff00);

    const authMessage = await privateChannel
        .send({ embeds: [embed] })
        .catch(console.error);
    if (!authMessage) {
        await privateChannel.delete().catch(console.error);
        authRequests.delete(requestId);
        return;
    }

    // yes/no の返答を待機
    try {
        const filter = (m: Message) =>
            m.author.id === requestId &&
            ["yes", "no"].includes(m.content.toLowerCase());
        const collected = await privateChannel.awaitMessages({
            filter,
            max: 1,
            time: 60000,
            errors: ["time"],
        });
        const response = collected.first();

        if (!response) {
            throw new Error(
                "タイムアウトしました。認証リクエストを再度送信してください。"
            );
        }

        // 間違った"yes/no"の入力メッセージは削除
        if (
            response.content.toLowerCase() !== "yes" &&
            response.content.toLowerCase() !== "no"
        ) {
            try {
                await response.delete();
            } catch (error) {
                console.error("メッセージ削除エラー:", error);
            }
        }

        const userResponse = response.content.toLowerCase();

        switch (userResponse) {
            case "yes":
                if (action === "create") {
                    await handleCreateAuth(privateChannel, requestId, authMessage);
                } else {
                    await handleRemoveAuth(privateChannel, requestId, authMessage);
                }
                break;
            case "no":
                await handleAuthRejection(privateChannel, requestId, authMessage);
                break;
            default:
                throw new Error(
                    "無効な応答です: yes か no で答えてください"
                );
        }
    } catch (error) {
        handleAuthError(privateChannel, requestId, error);
    }
}

// 認証情報作成処理
async function handleCreateAuth(
    privateChannel: TextChannel,
    requestId: string,
    authMessage: Message
) {
    try {
        // ステップ 1: ユーザー名入力
        const usernameFilter = (m: Message) => m.author.id === requestId;
        const usernameCollected = await privateChannel.awaitMessages({
            filter: usernameFilter,
            max: 1,
            time: 60000,
            errors: ["time"],
        });
        const usernameMessage = usernameCollected.first();
        const username = usernameMessage?.content;

        if (!username) {
            throw new Error("ユーザー名が入力されませんでした。");
        }

        // ステップ 2: パスワード入力
        const passwordFilter = (m: Message) => m.author.id === requestId;
        let passwordCollected = await privateChannel.awaitMessages({
            filter: passwordFilter,
            max: 1,
            time: 60000,
            errors: ["time"],
        });
        let passwordMessage = passwordCollected.first();
        let password = passwordMessage?.content;

        // パスワードの再入力ループ
        while (true) {
            if (passwordMessage) {
                try {
                    await passwordMessage.delete();
                } catch (error) {
                    console.error("メッセージ削除エラー:", error);
                }
            }
            if (!password) {
                await privateChannel.send(
                    "パスワードが入力されませんでした。再度入力してください。"
                );
            } else if (!strongPasswordRegex.test(password)) {
                await privateChannel.send(
                    "パスワードは8文字以上で、大文字、小文字、数字、特殊文字をそれぞれ1つ以上含める必要があります。再度入力してください。"
                );
            } else {
                break; // 正しいパスワードが入力されたらループを抜ける
            }

            // 再度入力を促す
            passwordCollected = await privateChannel.awaitMessages({
                filter: passwordFilter,
                max: 1,
                time: 60000,
                errors: ["time"],
            });
            passwordMessage = passwordCollected.first();
            password = passwordMessage?.content;
        }

        // ステップ 3: 登録完了
        addUser(username, password);
        await privateChannel.send(
            `(3/3) 認証情報が作成されました: ユーザー名: ${username}`
        );
        await cleanupAuthRequest(privateChannel, requestId);
    } catch (error) {
        handleAuthError(privateChannel, requestId, error);
    }
}

// 認証情報削除処理
async function handleRemoveAuth(
    privateChannel: TextChannel,
    requestId: string,
    authMessage: Message
) {
    try {
        const usernameFilter = (m: Message) => m.author.id === requestId;
        const usernameCollected = await privateChannel.awaitMessages({
            filter: usernameFilter,
            max: 1,
            time: 60000,
            errors: ["time"],
        });
        const usernameMessage = usernameCollected.first();
        const username = usernameMessage?.content;

        if (!username) {
            throw new Error("ユーザー名が入力されませんでした。");
        }

        if (removeUser(username)) {
            await privateChannel.send(
                `(2/2) 認証情報が削除されました: ユーザー名: ${username}`
            );
        } else {
            throw new Error(`指定されたユーザー名 ${username} は存在しません。`)
        }

        await cleanupAuthRequest(privateChannel, requestId);
    } catch (error) {
        handleAuthError(privateChannel, requestId, error);
    }
}

// 認証リクエスト拒否時の処理
async function handleAuthRejection(
    privateChannel: TextChannel,
    requestId: string,
    authMessage: Message
) {
    await authMessage
        .edit({
            content: "認証リクエストがキャンセルされました。",
            embeds: [],
            components: [],
        })
        .catch(console.error);
    await cleanupAuthRequest(privateChannel, requestId);
}

// タイムアウト時の処理

// エラー発生時の処理
function handleAuthError(
    privateChannel: TextChannel,
    requestId: string,
    error: any) {
    console.error(error);
    privateChannel
        .send(
            error.message ||
            "エラーが発生しました。認証リクエストを再度送信してください。"
        )
        .catch(console.error);
    cleanupAuthRequest(privateChannel, requestId);
}

// 認証リクエストの後処理 (チャンネル削除、リクエスト削除)
async function cleanupAuthRequest(
    privateChannel: TextChannel,
    requestId: string
) {
    setTimeout(() => {
        privateChannel.delete().catch(console.error);
        authRequests.delete(requestId);
    }, 5000);
}

registerDisCommand({
    name: "auth",
    description: "認証情報の作成・削除を行います (権限レベル2以上)",
    config: {
        enabled: true,
        requireLevel: 2,
    },
    prefixExecutor: async (message: Message, args: string[]) => {
        if (!message.member || !message.guild) return;

        if (!checkPrefixCommandPermission(message, 2)) {
            await message
                .reply("このコマンドを実行する権限がありません。")
                .catch(console.error);
            return;
        }

        const action = args[0] as "create" | "remove";
        if (action === "create" || action === "remove") {
            await handleAuthRequest(message, action);
        } else {
            await message
                .reply(
                    "無効な操作です。`!auth create` または `!auth remove` を使用してください。"
                )
                .catch(console.error);
        }
    },
});