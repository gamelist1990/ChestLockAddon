import { Client, TextChannel, Message, GatewayIntentBits, ActivityType, EmbedBuilder } from 'discord.js';
import { world } from '../backend'; // world の型定義は適切に行ってください
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// .envファイルのパスを現在のディレクトリに設定
const envPath = path.resolve(__dirname, '.env');

// .envファイルが存在するか確認し、なければ作成
if (!fs.existsSync(envPath)) {
    const sampleEnvContent = `DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE\nDISCORD_CHANNEL_ID=YOUR_CHANNEL_ID_HERE\nDISCORD_GUILD_ID=YOUR_GUILD_ID_HERE\nDISCORD_STATUS_CHANNEL_ID=YOUR_STATUS_CHANNEL_ID_HERE\nDISCORD_STATUS_MESSAGE_ID=YOUR_STATUS_MESSAGE_ID_HERE\n`;
    fs.writeFileSync(envPath, sampleEnvContent);
    console.warn('警告: .envファイルが作成されました。YOUR_BOT_TOKEN_HERE, YOUR_CHANNEL_ID_HERE, YOUR_GUILD_ID_HERE, YOUR_STATUS_CHANNEL_ID_HERE, YOUR_STATUS_MESSAGE_ID_HERE を適切な値に更新してください。');
}

dotenv.config({ path: envPath });

let discordClient: Client;
let discordChannelId: string;
let discordGuildId: string;
let discordStatusChannelId: string;
let discordStatusMessageId: string;
let serverStatusMessage: Message | null = null;
let serverStartTime: Date | null = null;

/**
 * サーバーのステータス情報を更新する関数
 */
async function updateServerStatus() {
    if (!discordClient || !discordStatusChannelId) return;

    const isOnline = world && (await world.getPlayers()).length > 0;
    const status = isOnline ? "Online ⭕" : "Offline ✖";
    const playerCount = world ? (await world.getPlayers()).length : 0;
    const uptime = serverStartTime ? calculateUptime(serverStartTime) : "不明";
    const lastUpdated = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const embed = new EmbedBuilder()
        .setTitle(`Minecraft Server Status: ${status}`)
        .setColor(isOnline ? 0x00ff00 : 0xff0000)
        .addFields(
            { name: '起動時間', value: uptime },
            { name: '現在のオンラインのプレイヤー数', value: playerCount.toString() },
            { name: '最終更新時間', value: lastUpdated }
        )
        .setTimestamp();

    try {
        const channel = await discordClient.channels.fetch(discordStatusChannelId) as TextChannel;
        if (!channel) {
            console.error(`エラー: ステータス更新用のチャンネル ${discordStatusChannelId} が見つかりません。`);
            return;
        }
        if (serverStatusMessage) {
            await serverStatusMessage.edit({ embeds: [embed] });
        } else {
            serverStatusMessage = await channel.send({ embeds: [embed] });
            discordStatusMessageId = serverStatusMessage.id;
            updateEnvFile('DISCORD_STATUS_MESSAGE_ID', discordStatusMessageId);
        }

    } catch (error) {
        console.error('サーバー情報の更新に失敗しました:', error);
    }
}

/**
 * 起動時間から経過時間を計算する関数
 * @param startTime サーバーの起動時間
 * @returns 経過時間を表す文字列 (例: "0日 4時間 21分 11秒")
 */
function calculateUptime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;
}

/**
 * .envファイルを更新する関数
 * @param key 更新するキー
 * @param value 更新する値
 */
function updateEnvFile(key: string, value: string) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    envConfig[key] = value;
    const newEnvContent = Object.keys(envConfig)
        .map(k => `${k}=${envConfig[k]}`)
        .join('\n');
    fs.writeFileSync(envPath, newEnvContent);
    dotenv.config({ path: envPath }); // 更新した.envファイルを再読み込み
}

/**
 * DiscordボットとチャンネルIDを設定します。
 * .envファイルからトークン、チャンネルID、ギルドID、ステータスチャンネルID、ステータスメッセージIDを読み込みます。
 */
function setDiscordBridge() {
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    discordChannelId = process.env.DISCORD_CHANNEL_ID || '';
    discordGuildId = process.env.DISCORD_GUILD_ID || '';
    discordStatusChannelId = process.env.DISCORD_STATUS_CHANNEL_ID || '';
    discordStatusMessageId = process.env.DISCORD_STATUS_MESSAGE_ID || '';

    if (!discordBotToken || !discordChannelId || !discordGuildId || !discordStatusChannelId ||
        discordBotToken === 'YOUR_BOT_TOKEN_HERE' || discordChannelId === 'YOUR_CHANNEL_ID_HERE' || discordGuildId === 'YOUR_GUILD_ID_HERE' || discordStatusChannelId === 'YOUR_STATUS_CHANNEL_ID_HERE') {
        console.error('エラー: .envファイルにDISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DISCORD_GUILD_ID, DISCORD_STATUS_CHANNEL_ID が正しく設定されていません。');
        return;
    }

    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    discordClient.login(discordBotToken).catch(error => {
        console.error('Discordへのログインに失敗しました:', error);
    });

    discordClient.on('ready', async () => {
        if (!discordClient.user) return;
        console.log(`Discordボットが ${discordClient.user.tag} としてログインしました。`);

        discordClient.user.setActivity('WebSocket Client V2 を実験中', { type: ActivityType.Playing });

        const guild = await discordClient.guilds.fetch(discordGuildId).catch(() => null);
        if (!guild) {
            console.error(`エラー: 指定されたギルドID ${discordGuildId} が見つかりません。`);
            return;
        }

        const channel = guild.channels.cache.get(discordChannelId) as TextChannel;
        if (!channel) {
            console.error(`エラー: 指定されたチャンネルID ${discordChannelId} がギルド ${guild.name} に見つかりません。`);
            return;
        }
        console.log(`指定されたギルド: ${guild.name}, チャンネル: ${channel.name} を監視します。`);

        const statusChannel = guild.channels.cache.get(discordStatusChannelId) as TextChannel;
        if (!statusChannel) {
            console.error(`エラー: 指定されたステータスチャンネルID ${discordStatusChannelId} がギルド ${guild.name} に見つかりません。`);
            return;
        }
        console.log(`指定されたステータスチャンネル: ${statusChannel.name} を監視します。`);

        // ステータスメッセージの取得または送信
        try {
            if (discordStatusMessageId !== 'YOUR_STATUS_MESSAGE_ID_HERE' && discordStatusMessageId !== '') {
                serverStatusMessage = await statusChannel.messages.fetch(discordStatusMessageId);
            }
            if (!serverStatusMessage) {
                serverStatusMessage = await statusChannel.send('サーバー情報を初期化しています...');
                discordStatusMessageId = serverStatusMessage.id;
                updateEnvFile('DISCORD_STATUS_MESSAGE_ID', discordStatusMessageId);
            }
        } catch (error) {
            console.error('ステータスメッセージの取得または送信中にエラーが発生しました:', error);
            serverStatusMessage = await statusChannel.send('サーバー情報を初期化しています...');
            discordStatusMessageId = serverStatusMessage.id;
            updateEnvFile('DISCORD_STATUS_MESSAGE_ID', discordStatusMessageId);
        }

        // サーバー起動時間を初期化
        serverStartTime = new Date();

        // 定期的にサーバー情報を更新 (例: 30秒ごと)
        setInterval(updateServerStatus, 30 * 1000);
        updateServerStatus(); // 初回実行
    });
}

/**
 * MinecraftチャットからDiscordへのメッセージ送信処理
 */
async function sendMinecraftToDiscord(playerName: string, message: string) {
    if (discordClient && discordChannelId) {
        try {
            const channel = await discordClient.channels.fetch(discordChannelId) as TextChannel;
            if (channel) {
                channel.send(`**${playerName}**: ${message}`);
            }
        } catch (error) {
            console.error('Discordへのメッセージ送信に失敗しました:', error);
        }
    }
}

/**
 * 指定された数値を使って、結果が必ず114514に近づくようなより高度な計算を行う関数
 * @param num 入力された数値 (小数点を許可)
 * @param showCalculation 計算過程を表示するかどうかのフラグ
 * @returns 計算結果と計算過程を含むオブジェクト
 */
function GenNumber(num: number, showCalculation: boolean = false): { result: number, calculation?: string } {
    // 1. 入力値の絶対値を取得
    const absNum = Math.abs(num);

    // 2. 対数スケールでの変換
    const logValue = Math.log10(absNum + 1); // 0 にならないように +1

    // 3. 無理数を掛け合わせて複雑な計算をシミュレート
    const complexValue = logValue * Math.PI * Math.E;

    // 4. 114514に近づけるための調整係数を計算
    const adjustmentFactor = 114514 / (complexValue === 0 ? 1 : complexValue); // ゼロ除算を回避

    // 5. 最終結果を計算（小数点以下2桁に丸める）
    const result = parseFloat((complexValue * adjustmentFactor).toFixed(2));

    if (showCalculation) {
        const calculation = `計算過程:\n` +
            `1. 入力値の絶対値: ${absNum}\n` +
            `2. 対数スケールでの変換: log10(${absNum} + 1) = ${logValue}\n` +
            `3. 無理数を掛け合わせて複雑な計算をシミュレート: ${logValue} * π * e ≈ ${complexValue}\n` +
            `4. 114514に近づけるための調整係数を計算: 114514 / ${complexValue} ≈ ${adjustmentFactor}\n` +
            `5. 最終結果を計算: ${complexValue} * ${adjustmentFactor} ≈ ${result} (小数点以下2桁に丸める)\n`;
        return { result, calculation };
    } else {
        return { result };
    }
}

/**
 * DiscordからMinecraftへのメッセージ送信処理
 */
async function sendDiscordToMinecraft(message: Message) {
    if (world && discordClient.user && message.member) {
        if (message.author.id !== discordClient.user.id && message.guild?.id === discordGuildId) {
            let content = message.content;

            if (message.mentions.has(discordClient.user!) && !message.author.bot) {
                const content = message.content;
                const match = content.match(/<@!?\d+>\s*([\d.]+)(?:\s+(true))?/i); 
                if (match) {
                    const num = parseFloat(match[1]);
                    const showCalculation = match[2] === 'true';

                    const { result, calculation } = GenNumber(num, showCalculation);
                    let replyMessage = `結果: ${result}`;
                    if (showCalculation && calculation) {
                        replyMessage += `\n${calculation}`;
                    }

                    message.reply(replyMessage).catch(console.error);
                }
            }

            // メンションを処理
            if (message.mentions.members) {
                message.mentions.members.forEach((mentionedMember) => {
                    const id = mentionedMember.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const mentionRegex = new RegExp(`<@!?${id}>`, 'g');
                    content = content.replace(mentionRegex, `§l§eメッション:§a[§f@${mentionedMember.displayName}§a]`);
                });
            }

            // 添付ファイル名の取得
            const attachmentNames: string[] = [];
            if (message.attachments.size > 0) {
                message.attachments.forEach((attachment) => {
                    attachmentNames.push(attachment.name);
                });
            }

            // HTMLタグを取り除く (mentions と attachments の処理後に行う)
            const cleanedContent = content.replace(/<[^>]+>/g, '');

            // メッセージを45文字以下に制限 (ファイル名も考慮)
            const maxLength = 45;
            let truncatedContent = cleanedContent;

            // 添付ファイル名がある場合のみ処理
            if (attachmentNames.length > 0) {
                const attachmentString = ` 添付ファイル: ${attachmentNames.join(', ')}`;
                // メッセージと添付ファイル名の合計長を計算
                const totalLength = cleanedContent.length + attachmentString.length;

                if (totalLength > maxLength) {
                    // メッセージが制限内に収まるかどうかで処理を分岐
                    if (cleanedContent.length > maxLength) {
                        truncatedContent = cleanedContent.substring(0, maxLength - 3) + '...';
                    } else {
                        truncatedContent += ` 添付ファイル: ${attachmentNames.length}個`;
                    }
                } else {
                    truncatedContent += attachmentString;
                }
            } else if (cleanedContent.length > maxLength) {
                // 添付ファイル名が無く、メッセージが制限文字数を超える場合は省略
                truncatedContent = cleanedContent.substring(0, maxLength - 3) + "...";
            }

            // メッセージを構築して送信
            const mes = `§l§f<§b${message.member.displayName}§f>§r ${truncatedContent}`
            world.sendMessage(mes);
        }
    } else {
        console.warn("サーバーが起動していないか、プレイヤーがオンラインでないか、メンバー情報が取得できないため、DiscordからMinecraftへのメッセージ送信をスキップしました。");
    }
}

/**
 * Discordメッセージイベントの監視を設定します。
 */
function setupDiscordListener() {
    if (discordClient) {
        discordClient.on('messageCreate', async (message) => {
            if (message.channel.id === discordChannelId && message.guild?.id === discordGuildId) {
                await sendDiscordToMinecraft(message);
            }
        });
    }
}

// 起動時にDiscordブリッジを設定し、リスナーをセットアップ
setDiscordBridge();
setupDiscordListener();

if (world) {
    world.on("playerChat", async (sender: string, message: string, type: string, receiver: string) => {
        if (sender !== "外部") {
            if (type === "chat") {
                const player = await world.getEntityByName(sender);
                if (player) {
                    sendMinecraftToDiscord(player.name, message);
                }
            } else {
                let formattedMessage = "";
                if (type === "say") {
                    formattedMessage = `*${message}*`;
                    sendMinecraftToDiscord("**Server**", formattedMessage);
                } else {
                   // console.log(`Unknown type: ${type}, Message: ${sender}:${message}`);
                }
            }
        }
    });
}











