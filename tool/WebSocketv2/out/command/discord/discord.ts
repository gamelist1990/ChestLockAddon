import {
    Client,
    TextChannel,
    Message,
    GatewayIntentBits,
    ActivityType,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    Interaction,
} from "discord.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import * as ngrok from "ngrok";
import { world } from "../../backend";
import { calculateUptime } from "../../module/Data";

// .envファイルのパスを現在のディレクトリに設定
const envPath = path.resolve(__dirname, ".env");

// .envファイルが存在するか確認し、なければ作成
if (!fs.existsSync(envPath)) {
    const sampleEnvContent = `DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE\nDISCORD_CHANNEL_ID=YOUR_CHANNEL_ID_HERE\nDISCORD_GUILD_ID=YOUR_GUILD_ID_HERE\nDISCORD_STATUS_CHANNEL_ID=YOUR_STATUS_CHANNEL_ID_HERE\nDISCORD_STATUS_MESSAGE_ID=YOUR_STATUS_MESSAGE_ID_HERE\nROLE_LEVEL_1=ROLE_ID_1\nROLE_LEVEL_2=ROLE_ID_2,ROLE_ID_3\nROLE_LEVEL_3=ROLE_ID_4,ROLE_ID_5\n`;
    fs.writeFileSync(envPath, sampleEnvContent);
    console.warn(
        "警告: .envファイルが作成されました。YOUR_BOT_TOKEN_HERE, YOUR_CHANNEL_ID_HERE, YOUR_GUILD_ID_HERE, YOUR_STATUS_CHANNEL_ID_HERE, YOUR_STATUS_MESSAGE_ID_HERE, ROLE_ID_1, ROLE_ID_2, ROLE_ID_3 を適切な値に更新してください。"
    );
}

dotenv.config({ path: envPath });

export let discordClient: Client;
let discordChannelId: string;
let discordGuildId: string;
let discordStatusChannelId: string;
let discordStatusMessageId: string;
let serverStatusMessage: Message | null = null;
let serverStartTime: Date | null = null;

// ngrok関連の変数
const PORT_WEB = 80;
const PORT_API = 19133;
export let ngrokUrls: {
    web: { port: number; url: string };
    api: { port: number; url: string };
} | null = null;
export let ngrokEnabled = true; // ngrokの起動状態を管理する変数

// 権限レベルを.envから読み込む
const ROLE_LEVEL_1 = process.env.ROLE_LEVEL_1
    ? process.env.ROLE_LEVEL_1.split(",")
    : [];
const ROLE_LEVEL_2 = process.env.ROLE_LEVEL_2
    ? process.env.ROLE_LEVEL_2.split(",")
    : [];
const ROLE_LEVEL_3 = process.env.ROLE_LEVEL_3
    ? process.env.ROLE_LEVEL_3.split(",")
    : [];

// 登録されたコマンドを保存する配列
export const registeredCommands: any[] = [];


/**
 * サーバーのステータス情報を更新する関数
 */
async function updateServerStatus() {
    if (!discordClient || !discordStatusChannelId) return;

    const isOnline = world && (await world.getPlayers()).length > 0;
    const status = isOnline ? "Online ⭕" : "Offline ✖";
    const playerCount = world ? (await world.getPlayers()).length : 0;
    const uptime = serverStartTime ? calculateUptime(serverStartTime) : "不明";
    const lastUpdated = new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
    });

    const embed = new EmbedBuilder()
        .setTitle(`Minecraft Server Status: ${status}`)
        .setColor(isOnline ? 0x00ff00 : 0xff0000)
        .addFields(
            { name: "起動時間", value: uptime },
            { name: "現在のオンラインのプレイヤー数", value: playerCount.toString() },
            { name: "最終更新時間", value: lastUpdated }
        )
        .setTimestamp();

    try {
        const channel = (await discordClient.channels.fetch(
            discordStatusChannelId
        )) as TextChannel;
        if (!channel) {
            console.error(
                `エラー: ステータス更新用のチャンネル ${discordStatusChannelId} が見つかりません。`
            );
            return;
        }
        if (serverStatusMessage) {
            await serverStatusMessage.edit({ embeds: [embed] });
        } else {
            serverStatusMessage = await channel.send({ embeds: [embed] });
            discordStatusMessageId = serverStatusMessage.id;
            updateEnvFile("DISCORD_STATUS_MESSAGE_ID", discordStatusMessageId);
        }
    } catch (error) {
        console.error("サーバー情報の更新に失敗しました:", error);
    }
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
        .map((k) => `${k}=${envConfig[k]}`)
        .join("\n");
    fs.writeFileSync(envPath, newEnvContent);
    dotenv.config({ path: envPath }); // 更新した.envファイルを再読み込み
}

/**
 * ngrok URLを再生成する関数
 */
export async function recreateNgrok() {
    try {
        await ngrok.kill(); // 既存のngrokプロセスを終了
        ngrokUrls = await startNgrok();
        console.log("ngrok URLが再生成されました:", ngrokUrls);
        saveNgrokUrls(ngrokUrls);
    } catch (error) {
        console.error("ngrok URLの再生成に失敗しました:", error);
    }
}

/**
 * ngrokを開始する関数
 * @returns ngrokのURLオブジェクト
 */
async function startNgrok() {
    try {
        // Connect to ngrok, specifying both ports
        const webUrl = await ngrok.connect({
            proto: "http",
            addr: PORT_WEB,
            region: "jp", // You can specify your region here, e.g., 'us', 'eu', 'ap', 'au', 'sa', 'in'
        });

        const apiUrl = await ngrok.connect({
            proto: "http",
            addr: PORT_API,
            region: "jp", // You can specify your region here
        });

        return {
            web: {
                port: PORT_WEB,
                url: webUrl,
            },
            api: {
                port: PORT_API,
                url: apiUrl,
            },
        };
    } catch (error) {
        console.error("Error starting ngrok:", error);
        throw error; // Re-throw the error to be handled later
    }
}

/**
 * ngrokを停止する関数
 */
async function stopNgrok() {
    try {
        await ngrok.kill();
        console.log("ngrokを停止しました。");
    } catch (error) {
        console.error("ngrokの停止に失敗しました:", error);
    }
}

/**
 * ngrok URLをファイルに保存する関数
 * @param urls ngrokのURLオブジェクト
 */
function saveNgrokUrls(urls: {
    web: { port: number; url: string };
    api: { port: number; url: string };
} | null) {
    const filePath = path.join(__dirname, "ngrok_urls.json");
    try {
        fs.writeFileSync(filePath, JSON.stringify(urls, null, 2));
        console.log("ngrok URLを保存しました: ngrok_urls.json");
    } catch (error) {
        console.error("ngrok URLの保存に失敗しました:", error);
    }
}

/**
 * バックグラウンドでngrokとWebサーバーを開始する関数
 */
async function startOrStopBackgroundProcesses() {
    try {
        if (ngrokEnabled) {
            ngrokUrls = await startNgrok();
            saveNgrokUrls(ngrokUrls);
            console.log("ngrokを開始しました:", ngrokUrls);
        } else {
            console.log("ngrokは開始されていません。");
        }
    } catch (error) {
        console.error("バックグラウンドプロセスの開始/停止に失敗しました:", error);
    }
}

/**
 * DiscordボットとチャンネルIDを設定します。
 * .envファイルからトークン、チャンネルID、ギルドID、ステータスチャンネルID、ステータスメッセージIDを読み込みます。
 */
async function setDiscordBridge() {
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    discordChannelId = process.env.DISCORD_CHANNEL_ID || "";
    discordGuildId = process.env.DISCORD_GUILD_ID || "";
    discordStatusChannelId = process.env.DISCORD_STATUS_CHANNEL_ID || "";
    discordStatusMessageId = process.env.DISCORD_STATUS_MESSAGE_ID || "";

    if (
        !discordBotToken ||
        !discordChannelId ||
        !discordGuildId ||
        !discordStatusChannelId ||
        discordBotToken === "YOUR_BOT_TOKEN_HERE" ||
        discordChannelId === "YOUR_CHANNEL_ID_HERE" ||
        discordGuildId === "YOUR_GUILD_ID_HERE" ||
        discordStatusChannelId === "YOUR_STATUS_CHANNEL_ID_HERE"
    ) {
        console.error(
            "エラー: .envファイルにDISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DISCORD_GUILD_ID, DISCORD_STATUS_CHANNEL_ID が正しく設定されていません。"
        );
        return;
    }

    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,  
            GatewayIntentBits.DirectMessageReactions
        ],
    });

    discordClient.login(discordBotToken).catch((error) => {
        console.error("Discordへのログインに失敗しました:", error);
    });

    discordClient.on("ready", async () => {
        if (!discordClient.user) return;
        console.log(`Discordボットが ${discordClient.user.tag} としてログインしました。`);

        discordClient.user.setActivity("WebSocket Client V2 を実験中", {
            type: ActivityType.Playing,
        });

        const guild = await discordClient.guilds.fetch(discordGuildId).catch(() => null);
        if (!guild) {
            console.error(`エラー: 指定されたギルドID ${discordGuildId} が見つかりません。`);
            return;
        }

        const channel = guild.channels.cache.get(discordChannelId) as TextChannel;
        if (!channel) {
            console.error(
                `エラー: 指定されたチャンネルID ${discordChannelId} がギルド ${guild.name} に見つかりません。`
            );
            return;
        }
        console.log(
            `指定されたギルド: ${guild.name}, チャンネル: ${channel.name} を監視します。`
        );

        const statusChannel = guild.channels.cache.get(
            discordStatusChannelId
        ) as TextChannel;
        if (!statusChannel) {
            console.error(
                `エラー: 指定されたステータスチャンネルID ${discordStatusChannelId} がギルド ${guild.name} に見つかりません。`
            );
            return;
        }
        console.log(`指定されたステータスチャンネル: ${statusChannel.name} を監視します。`);

        // ステータスメッセージの取得または送信
        try {
            if (
                discordStatusMessageId !== "YOUR_STATUS_MESSAGE_ID_HERE" &&
                discordStatusMessageId !== ""
            ) {
                serverStatusMessage = await statusChannel.messages.fetch(
                    discordStatusMessageId
                );
            }
            if (!serverStatusMessage) {
                serverStatusMessage = await statusChannel.send("サーバー情報を初期化しています...");
                discordStatusMessageId = serverStatusMessage.id;
                updateEnvFile("DISCORD_STATUS_MESSAGE_ID", discordStatusMessageId);
            }
        } catch (error) {
            console.error("ステータスメッセージの取得または送信中にエラーが発生しました:", error);
            serverStatusMessage = await statusChannel.send("サーバー情報を初期化しています...");
            discordStatusMessageId = serverStatusMessage.id;
            updateEnvFile("DISCORD_STATUS_MESSAGE_ID", discordStatusMessageId);
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
            const channel = (await discordClient.channels.fetch(
                discordChannelId
            )) as TextChannel;
            if (channel) {
                channel.send(`**${playerName}**: ${message}`);
            }
        } catch (error) {
            console.error("Discordへのメッセージ送信に失敗しました:", error);
        }
    }
}

/**
 * 指定された数値を使って、結果が必ず114514に近づくようなより高度な計算を行う関数
 * @param num 入力された数値 (小数点を許可)
 * @param showCalculation 計算過程を表示するかどうかのフラグ
 * @returns 計算結果と計算過程を含むオブジェクト
 */
function GenNumber(
    num: number,
    showCalculation: boolean = false
): { result: number; calculation?: string } {
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
        const calculation =
            `計算過程:\n` +
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

            // HTMLタグを取り除く (mentions と attachments の処理後に行う)
            const cleanedContent = content.replace(/<[^>]+>/g, '');

            // メッセージを構築して送信
            const mes = `§l§f<§b${message.member.displayName}§f>§r ${cleanedContent}`
            world.sendMessage(mes);
        }
    } else {
        console.warn("サーバーが起動していないか、プレイヤーがオンラインでないか、メンバー情報が取得できないため、DiscordからMinecraftへのメッセージ送信をスキップしました。");
    }
}

/**
 * コマンドを登録する関数
 * @param command コマンドオブジェクト
 */
export function registerDisCommand(command: any) {
    registeredCommands.push(command);
}

// 使用可能なcommand

async function loadDisCommands() {
    const load = await import("./import");
    load;
    console.log("Loaded Discord Commands");
}

// Prefixコマンド用の権限チェック関数を定義
export function checkPrefixCommandPermission(
    message: Message,
    requiredLevel: number
): boolean {
    if (!message.member) return false;

    switch (requiredLevel) {
        case 0:
            return true; // 全員許可
        case 1:
            return message.member.roles.cache.some((role) =>
                ROLE_LEVEL_1.includes(role.id)
            );
        case 2:
            return message.member.roles.cache.some((role) =>
                ROLE_LEVEL_2.includes(role.id)
            );
        case 3:
            return (
                message.member.permissions.has(PermissionFlagsBits.Administrator) ||
                message.member.roles.cache.some((role) => ROLE_LEVEL_3.includes(role.id))
            );
        default:
            return false;
    }
}


registerDisCommand({
    name: "ngrok",
    description: "ngrokを開始または停止します。",
    config: {
        enabled: true,
        requireLevel: 3,
    },
    prefixExecutor: async (message: Message, args: string[]) => {
        // プレフィックスコマンドとしての処理内容（権限レベルなどを変えたい場合はここを調整）
        if (!message.member) return;
        if (checkPrefixCommandPermission(message, 3)) {
            // 権限レベル3を要求
            const enable = args[0] === "true"; // 文字列 'true' を boolean に変換

            ngrokEnabled = enable;
            if (ngrokEnabled) {
                await startOrStopBackgroundProcesses();
                await message.reply("ngrokを開始しました。").catch(console.error);
            } else {
                await stopNgrok();
                await message.reply("ngrokを停止しました。").catch(console.error);
            }
        } else {
            await message
                .reply("このコマンドを実行する権限がありません。")
                .catch(console.error);
        }
    },
});



class TriggerEmitter {
    private listeners: { [event: string]: ((message: Message, ...args: any[]) => void)[] } = {};

    on(event: string, listener: (messageOrInteraction: Message | Interaction, ...args: any[]) => void) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    emit(event: string, message: Message, ...args: any[]) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(listener => listener(message, ...args));
        }
    }

    removeListener(event: string, listener: (message: Message, ...args: any[]) => void) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(l => l !== listener);
        }
    }
}
export const triggerDiscord = new TriggerEmitter();

/**
 * Discordメッセージイベントとインタラクションイベントの監視を設定します。
 */
function setupDiscordListener() {
    if (discordClient) {
        discordClient.on("messageCreate", async (message) => {
            if (message.channel.type === ChannelType.DM) {
                triggerDiscord.emit("messageCreate", message);
            }
            if (
                message.channel.id === discordChannelId &&
                message.guild?.id === discordGuildId
            ) {
                // Prefixコマンドを処理
                handlePrefixCommand(message);

                if (message.author.bot) return;
                sendDiscordToMinecraft(message);
            }
        });
    }
}

/**
 * プレフィックスコマンドを処理する関数
 * @param message メッセージオブジェクト
 */
async function handlePrefixCommand(message: Message) {
    if (!message.content.startsWith("#>>") || message.author.bot) return;

    const args = message.content.slice(3).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    console.log(`Received prefix command: ${commandName}`);

    const command = registeredCommands.find((cmd) => cmd.name === commandName);

    // コマンドが存在し、かつprefixExecutorが定義されている場合、実行する
    if (command && command.prefixExecutor) {
        command.prefixExecutor(message, args);
    } else {
        try {
            if (message.channel instanceof TextChannel) {
                const sentMessage = await message.channel.send("コマンドが見つかりません");
                setTimeout(async () => {
                    try {
                        await sentMessage.delete();
                    } catch (deleteError) {
                        console.error("メッセージの削除に失敗しました:", deleteError);
                    }
                }, 5000); // 5秒後にメッセージを削除
            }
        } catch (error) {
            console.error("一時的なメッセージの送信に失敗しました:", error);
            // フォールバックとして、通常のメッセージを送信 (全員に見える)
            if (message.channel instanceof TextChannel) {
                await message.channel.send("コマンドが見つかりません");
            }
        }
    }
}


// 起動時にDiscordブリッジを設定し、リスナーをセットアップ
setDiscordBridge();
setupDiscordListener();
loadDisCommands();
// バックグラウンドでngrokとWebサーバーを開始または停止
startOrStopBackgroundProcesses();

if (world) {
    world.on(
        "playerChat",
        async (sender: string, message: string, type: string, receiver: string) => {
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
        }
    );
}