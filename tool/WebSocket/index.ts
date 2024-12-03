import { Server } from 'socket-be';
import {
    Client,
    GatewayIntentBits,
    ChannelType,
    ActivityType,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    PermissionsBitField,
    GuildMember,
} from 'discord.js';
import * as fs from 'fs/promises';
import { config } from 'dotenv';
import { updateVoiceChannels, initVcFunctions } from './vc';
import path from 'path';


const defaultEnvContent = `# 自動的に.envファイルを作成しました\n
# ここに設定値を書き込んで下さい

DISCORD_TOKEN="xxxxxxxx"
TARGET_DISCORD_CHANNEL_ID="xxxxxxxx"
GUILD_ID="xxxxxxxx"
CATEGORY_ID="xxxxxxxx"
LOBBY_VC_ID="xxxxxxxx"
ADMIN_ROLE_ID="xxxxxxxx"
ADMINUUID=['xxxxxxxx']
ADMINNAME=['xxxxxxxx']
`;

const createDefaultEnvFile = async (filePath) => {
    try {
        await fs.writeFile(filePath, defaultEnvContent);
        console.log(`Created default .env file at ${filePath}`);
    } catch (error) {
        console.error(`Error creating default .env file:`, error);
        process.exit(1); // Exit if default creation fails
    }
};

const initEnv = async () => {
    const currentDirEnvPath = path.resolve(process.cwd(), '.env');

    try {
        await fs.access(currentDirEnvPath);
        config({ path: currentDirEnvPath });
        console.log("環境変数を.envファイルから読み込みました。");
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn("システムまたは.envファイルから環境変数を読み込めませんでした。");
            createDefaultEnvFile(currentDirEnvPath);
            config({ path: currentDirEnvPath }); // Load from newly created file.
            console.warn("デフォルトの.envファイルを作成しました。設定値を入力して再起動してください。");
            process.exit(1); // Exit after creation
        } else {
            console.error(".envファイルへのアクセス中にエラーが発生しました:", error);
            process.exit(1);
        }
    }


    const requiredVars = ["DISCORD_TOKEN", "TARGET_DISCORD_CHANNEL_ID", "GUILD_ID"];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error(`必須の環境変数が設定されていません: ${missingVars.join(", ")}`);
        console.warn(".envファイルを編集し、必要な情報を設定してください。");
        process.exit(1);
    }
};



initEnv();

// Discord設定
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_DISCORD_CHANNEL_ID = process.env.TARGET_DISCORD_CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID as string;
const CATEGORY_ID = process.env.CATEGORY_ID as string;
const LOBBY_VC_ID = process.env.LOBBY_VC_ID as string;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID as string;

// 機能トグル
interface FeatureToggles {
    discord: boolean;
    vc: boolean;
}
const featureToggles: FeatureToggles = {
    discord: true,
    vc: false,
};

// Minecraftコマンド設定
export const MINECRAFT_COMMAND_PREFIX = '#';
export const MINECRAFT_COMMANDS_PER_PAGE = 3;
const adminUUIDs: string[] = process.env.ADMINUUID as any;
const adminNames: string[] = process.env.ADMINNAME as any;


// データファイルパス
const WS_DATA_PATH = 'wsData.json';
const USER_DATA_PATH = 'User.json';
const BAN_USER_PATH = 'banUser.json';


// グローバル変数
let guild;
export let minecraftPlayerDiscordIds: { [uuid: string]: { name: string; discordId: string } } = {};
export let userData: { [username: string]: any } = {};
let updateVoiceChannelsTimeout: NodeJS.Timeout;
let updatePlayersInterval: NodeJS.Timeout;
export let banList: BanData[] = [];


// Discordクライアント
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ],
});

// Discordスラッシュコマンド
const commands = [
    new SlashCommandBuilder().setName('mc').setDescription('Minecraft サーバーにコマンドを送信します').addStringOption((option) => option.setName('command').setDescription('実行するコマンド').setRequired(true)),
    new SlashCommandBuilder().setName('link').setDescription('Minecraft のユーザー名と Discord アカウントを紐付けします').addStringOption((option) => option.setName('minecraft_username').setDescription('Minecraft のユーザー名').setRequired(true)),
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('機能の有効/無効を切り替えます。管理者権限が必要です。')
        .addStringOption((option) =>
            option.setName('feature').setDescription('切り替える機能 (discord, vc)').setRequired(true).addChoices({ name: 'Discord Integration', value: 'discord' }, { name: 'Voice Channel Sync', value: 'vc' })
        ),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN as string);

// Minecraftコマンド登録
interface MinecraftCommand {
    name: string;
    usage: string;
    description: string;
    adminOnly: boolean;
    execute: (sender: string, world: any, args: string[]) => Promise<void>;
}

interface PlayerData {
    activeSessionId: string;
    avgpacketloss: number;
    avgping: number;
    clientId: string;
    color: string;
    deviceSessionId: string;
    globalMultiplayerCorrelationId: string;
    id: number;
    maxbps: number;
    name: string;
    packetloss: number;
    ping: number;
    randomId: number;
    uuid: string;
}

export interface BanData {
    uuid: string;
    name: string;
    reason: string;
    bannedBy: string;
    bannedAt: number;
    expiresAt: number | null;
}

export const minecraftCommands: { [commandName: string]: MinecraftCommand } = {};

export function registerCommand(name: string, usage: string, description: string, adminOnly: boolean, execute: (sender: string, world: any, args: string[]) => Promise<void>): void {
    minecraftCommands[name] = { name, usage, description, adminOnly, execute };
}

// isAdmin関数 (管理者権限チェック)
export const isAdmin = async (playerName: string): Promise<boolean> => {
    try {
        const playerData = await WorldPlayer(playerName);

        if (!playerData || playerData.length === 0) return false;

        const playerInfo = playerData[0];
        const uuid = playerInfo.uniqueId;

        return adminUUIDs.includes(uuid) || adminNames.includes(playerName);

    } catch (error) {
        console.error("権限検証エラー:", error);
        return false;
    }
};


// データ読み込み/保存関数
async function loadWsData(): Promise<void> {
    try {
        const data = await fs.readFile(WS_DATA_PATH, 'utf8');
        minecraftPlayerDiscordIds = JSON.parse(data);
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            minecraftPlayerDiscordIds = {};
            console.log('wsData.json not found. Creating a new one.');
            await saveWsData();
        } else {
            console.error('Error loading wsData.json:', error);
        }
    }
}

async function loadUserData(): Promise<void> {
    try {
        const data = await fs.readFile(USER_DATA_PATH, 'utf8');
        userData = JSON.parse(data);
        console.log("userData loaded.");
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            userData = {};
            console.log('User.json not found. Creating a new one.');
            await saveUserData();
        } else {
            console.error('Error loading User.json:', error);
        }
    }
}
async function loadBanList(): Promise<void> {
    try {
        const data = await fs.readFile(BAN_USER_PATH, 'utf8');
        banList = JSON.parse(data);
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            banList = [];
            console.log('banUser.json not found. Creating a new one.');
            await saveBanList();
        } else {
            console.error('Error loading banUser.json:', error);
        }
    }
}
export const getBanList = async (): Promise<BanData[]> => {
    try {
        const data = await fs.readFile(BAN_USER_PATH, 'utf8');
        banList = JSON.parse(data);
        return banList;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn('Ban list file not found. Starting with an empty list.');
            return [];
        } else {
            console.error('Error reading ban list:', error);
            throw error;
        }
    }
};



export async function saveBanList(): Promise<void> {
    try {
        const data = JSON.stringify(banList, null, 2);
        await fs.writeFile(BAN_USER_PATH, data, 'utf8');
    } catch (error) {
        console.error('Error saving banUser.json:', error);
    }
}


async function saveUserData(): Promise<void> {
    try {
        const data = JSON.stringify(userData, null, 2);
        await fs.writeFile(USER_DATA_PATH, data, 'utf8');
    } catch (error) {
        console.error('Error saving user.json:', error);
    }
}

async function saveWsData(): Promise<void> {
    try {
        const data = JSON.stringify(minecraftPlayerDiscordIds, null, 2);
        await fs.writeFile(WS_DATA_PATH, data, 'utf8');
    } catch (error) {
        console.error('Error saving wsData.json:', error);
    }
}


// deepEqual関数
function deepEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}


// getData関数
export async function getData(playerName?: string): Promise<PlayerData | undefined> {
    try {
        const world = server.getWorlds()[0];
        if (!world) {
            return undefined;
        }
        const res = await world.runCommand('listd stats');
        if (res.statusCode !== 0) {
            return undefined;
        }

        try {
            const jsonString = res.details.replace(/^###\*|\*###$/g, '');
            const parsed = JSON.parse(jsonString.replace(/-?Infinity|-?nan\(ind\)|NaN/g, '0'));

            if (parsed && Array.isArray(parsed.result)) {
                const details: PlayerData[] = parsed.result.map((player: any) => {
                    const fixedPlayer: PlayerData = { ...player };
                    for (const key in fixedPlayer) {
                        if (typeof fixedPlayer[key] === 'number' && !Number.isFinite(fixedPlayer[key])) {
                            fixedPlayer[key] = 0;
                        }
                    }

                    // randomIdがbigintの場合、numberに変換
                    if (typeof fixedPlayer.randomId === 'bigint') {
                        fixedPlayer.randomId = Number(fixedPlayer.randomId);
                    }


                    return fixedPlayer;
                });


                if (playerName) {
                    return details.find(p => p.name && p.name.includes(playerName));
                } else {
                    return details[0];
                }
            } else {
             //   console.warn("Invalid 'listd stats' output format:", parsed);
                return undefined;
            }
        } catch (parseError) {
           // console.error("Error parsing player details:", parseError, res.details);
            return undefined;
        }
    } catch (outerError) {
      //  console.error("Outer error getting player:", outerError);
        return undefined;
    }
}


// WorldPlayer関数
export async function WorldPlayer(player?: string): Promise<any[] | undefined> {
    try {
        const world = server.getWorlds()[0];

        if (!world) {
            return undefined;
        }

        const command = player ? `querytarget "${player}"` : 'querytarget @a';
        const res = await world.runCommand(command);

        if (res.statusCode !== 0) {
        //    console.error(`querytarget failed: ${res.statusMessage}`);
            return undefined;
        }

        try {
            const data = JSON.parse(res.details);

            if (Array.isArray(data)) {
                return data;
            } else {
//console.warn("Invalid 'querytarget' output format:", data);
                return undefined;
            }
        } catch (parseError) {
           // console.error("Error parsing 'querytarget' details:", parseError, res.details);
            return undefined;
        }

    } catch (error) {
       // console.error("Error in WorldPlayer function:", error);
        return undefined;
    }
}

//PlayerList

export async function playerList(): Promise<{ name: string, uuid: string }[] | null> {
    try {
        const world = server.getWorlds()[0];
        if (!world) {
            return null;
        }

        const testforResult = await world.runCommand(`testfor @a`);

        if (testforResult.statusCode !== 0 || !testforResult.victim || testforResult.victim.length === 0) {
         //   console.warn("No players found or testfor command failed.", testforResult);
            return null;
        }

        const playerList: { name: string; uuid: string }[] = [];

        for (const playerName of testforResult.victim) {
            const queryResult = await world.runCommand(`querytarget @a[name=${playerName}]`);

            if (queryResult.statusCode === 0 && queryResult.details !== "[]") {
                const playerData = JSON.parse(queryResult.details);
                if (playerData && playerData.length > 0) {
                    playerList.push({ name: playerName, uuid: playerData[0].uniqueId });
                } else {
                 //   console.warn(`querytarget returned empty data for ${playerName}:`, queryResult)
                }

            } else {
               // console.error(`querytarget failed for ${playerName}:`, queryResult);

            }
        }
        return playerList;


    } catch (error) {
       // console.error("Error in playerList function:", error);
        return null;
    }
}


// updatePlayers関数
async function updatePlayers(): Promise<void> {
    try {
        const allPlayerData = await getData();
        if (!allPlayerData) return;

        let hasChanges = false;
        const playerDataArray: PlayerData[] = Array.isArray(allPlayerData) ? allPlayerData : [allPlayerData];

        playerDataArray.forEach((playerData) => {
            const existingData = userData[playerData.name] || {};

            const pingHistory = existingData.pingHistory || [];
            if (Number.isFinite(playerData.ping) && playerData.ping !== null) {
                pingHistory.push(playerData.ping);
            }
            if (pingHistory.length > 5) {
                pingHistory.shift();
            }
            const avgping = pingHistory.reduce((sum, p) => sum + p, 0) / pingHistory.length || 0;


            const newData = {
                ...existingData,
                name: playerData.name,
                entityId: playerData.id,
                uuid: playerData.uuid,
                ping: playerData.ping,
                PacketLoss: playerData.packetloss,
                Avgping: avgping,
                Avgpacketloss: Number.isFinite(playerData.avgpacketloss) && playerData.avgpacketloss !== null ? playerData.avgpacketloss : 0,
                pingHistory: pingHistory,
            };

            if (!deepEqual(existingData, newData)) {
                userData[playerData.name] = newData;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            saveUserData();
        }

    } catch (error) {
        console.error("Error updating player data:", error);
    }
}




// updateVoiceChannelWrapper関数
async function updateVoiceChannelWrapper(): Promise<void> {
    if (!featureToggles.vc) return;

    const world = server.getWorlds()[0];
    if (!world) {
        updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000) as NodeJS.Timeout;
        return;
    }

    try {
        const minecraftPlayers = await Promise.all(
            Object.keys(minecraftPlayerDiscordIds).map(async (uuid) => {
                const playerData = await WorldPlayer(minecraftPlayerDiscordIds[uuid].name);
                return playerData ? { ...playerData, uniqueId: uuid } : null;
            })
        ).then((results) => results.filter((player) => player !== null));

        const playersByDiscordId: { [discordId: string]: any } = {};
        minecraftPlayers.forEach((player: any) => {
            const discordId = minecraftPlayerDiscordIds[player.uniqueId]?.discordId;
            if (discordId) {
                playersByDiscordId[discordId] = player;
            }
        });


        await updateVoiceChannels();
    } catch (error) {
        console.error("Error updating voice channels:", error);
    } finally {
        updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000) as NodeJS.Timeout;
    }
}




// Minecraftサーバー
export const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
});



server.events.on('serverOpen', async () => {
    console.log('Minecraft server is connected via websocket!');
    const load = await import('./import');
    //Load Command
    load;
    // Load Data
    await loadWsData();
    await loadUserData();
    await loadBanList();
    updatePlayersInterval = setInterval(updatePlayers, 500) as NodeJS.Timeout;
});

server.events.on('worldAdd', async (event) => {
    const { world } = event;
    world.subscribeEvent("PlayerTravelled")
});

server.events.on('playerChat', async (event) => {
    const { sender, world, message, type } = event;
    if (sender === 'External') return;

    const channel = guild.channels.cache.get(TARGET_DISCORD_CHANNEL_ID);
    if (featureToggles.discord) {
        if (channel && channel.isTextBased() && !message.startsWith(MINECRAFT_COMMAND_PREFIX)) {
            if (type === 'chat') {
                channel.send(`<${sender}> ${message}`);
            }
        }
    }
    if (message.startsWith(MINECRAFT_COMMAND_PREFIX)) {
        const prefix = MINECRAFT_COMMAND_PREFIX;
        const args = message
            .slice(prefix.length)
            .replace('@', '')
            .match(/(".*?"|\S+)/g)
            ?.map((match: string) => match.replace(/"/g, ''));

        if (!args) return; // argsがnullまたはundefinedの場合は処理をスキップ

        const commandName = args.shift()!.toLowerCase();
        const command = minecraftCommands[commandName];

        if (command) {
            if (command.adminOnly && !(await isAdmin(sender))) {
                world.sendMessage('このコマンドを実行する権限がありません。', sender);
                return;
            }
            try {
                await command.execute(sender, world, args);
            } catch (error) {
                console.error(`Error executing command ${commandName}:`, error);
                world.sendMessage(`コマンドの実行中にエラーが発生しました。`, sender);
            }
        } else {
            world.sendMessage(`不明なコマンドです: ${commandName}`, sender);
        }
    }
});

interface PlayerTravelled {
    isUnderwater: boolean;       // 水中にいるかどうか
    metersTravelled: number;     // 移動距離（メートル）
    newBiome: number;            // 新しいバイオームのID
    player: {
        color: string;             // プレイヤーの色
        dimension: number;         // 次元
        id: number;                // プレイヤーのID
        name: string;              // プレイヤーの名前
        position: {
            x: number;               // X座標
            y: number;               // Y座標
            z: number;               // Z座標
        };
        type: string;              // エンティティの種類
        variant: number;           // バリアント
        yRot: number;              // Y軸の回転
    };
    travelMethod: number;        // 移動方法 0 =歩き 2=ジャンプ 8=走り 飛行=5 えりとら=通常時2 ダッシュ後使用で8
}

//@ts-ignore
server.events.on('PlayerTravelled', async (event: PlayerTravelled) => {
    const { isUnderwater, metersTravelled, player } = event;

    const flag = false;
    //if (player.name !== 'PEXkurann') return; 

    
    if (flag) {
        console.log(`Player: ${player.name}`);
        console.log(`Underwater: ${isUnderwater}`);
        console.log(`Distance: ${metersTravelled} meters`);
        console.log(`Position: x=${player.position.x}, y=${player.position.y}, z=${player.position.z}`);
    } 

});










// Minecraftコマンド
//トグル機能 {それ以外のコマンドは ./import でロードする}
registerCommand('toggle', `${MINECRAFT_COMMAND_PREFIX}toggle <Module>`, '機能の有効/無効を切り替えます。', true, async (sender, world, args) => { // adminOnlyをtrueに設定
    if (args.length === 0) {
        world.sendMessage(`使用方法: ${MINECRAFT_COMMAND_PREFIX}toggle <Module>`, sender);
        return;
    }

    const feature = args[0].toLowerCase();

    switch (feature) {
        case 'discord':
            featureToggles.discord = !featureToggles.discord;
            world.sendMessage(`Discord連携を${featureToggles.discord ? '有効' : '無効'}にしました。`, sender);
            break;
        case 'vc':
            featureToggles.vc = !featureToggles.vc;
            world.sendMessage(`VC同期を${featureToggles.vc ? '有効' : '無効'}にしました。`, sender);
            if (featureToggles.vc) {
                if (guild) initVcFunctions(guild, CATEGORY_ID, LOBBY_VC_ID);
                updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000) as NodeJS.Timeout;
            } else {
                clearTimeout(updateVoiceChannelsTimeout);
            }
            break;
        default:
            world.sendMessage(`不明な機能です: ${feature}`, sender);
    }
});

//BANシステムでの自動キック処理
server.events.on('playerJoin', async (event) => {
    const world = server.getWorlds()[0];
    if (!world) return;

    for (const playerWithTag of event.players) {
        try {
            const playerListResult = await playerList();

            if (playerListResult) {
                const playerInfo = playerListResult.find(player => playerWithTag.includes(player.name));

                if (playerInfo) {
                    const playerName = playerInfo.name;
                    const uuid = playerInfo.uuid;

                    userData[playerInfo.name].lastJoin = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                    await saveUserData();

                    const ban = banList.find(ban => ban.uuid === uuid);

                    if (ban) {
                        if (ban.expiresAt && ban.expiresAt < Date.now()) {
                            banList = banList.filter(b => b.uuid !== uuid);
                            await saveBanList();
                            console.log(`Expired ban for ${playerName} removed.`);
                            continue;
                        }

                        if (!world) continue;

                        const kickMessage = `§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${ban.reason}\n§fBANした管理者: §b${ban.bannedBy}\n§f期限: §e${ban.expiresAt ? new Date(ban.expiresAt).toLocaleString() : '永久'}`;
                        await world.runCommand(`kick "${playerName}" ${kickMessage}`);
                        console.log(`Banned player ${playerName} tried to join.`);
                        return;
                    }
                }
            } else {
                console.error("Failed to get player list.");
            }
        } catch (error) {
            console.error(`Error processing player ${playerWithTag}:`, error);
        }
    }
});


server.events.on('playerLeave', async (event) => {
    const players = event.players;

    if (Array.isArray(players)) {
        for (const player of players) {
            for (const playerName in userData) {
                if (player && player.includes(playerName)) { 
                    try {
                        userData[playerName].lastLeave = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                        await saveUserData();
                        break; 
                    } catch (error) {
                        console.error(`Error recording lastLeave for ${playerName}:`, error);
                    }
                }
            }
        }
    } else {
        console.error("event.players is not an array. Check your BeAPI version or configuration.");
    }
});




// Discord bot起動時の処理
discordClient.login(DISCORD_TOKEN);

discordClient.on('ready', async () => {
    console.log('Discord bot is ready!');

    guild = discordClient.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error("ギルドが見つかりません。");
        process.exit(1);
    }

    if (featureToggles.vc) {
        initVcFunctions(guild, CATEGORY_ID, LOBBY_VC_ID);
        updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000) as NodeJS.Timeout;
    }


    discordClient.user?.setPresence({
        activities: [{ name: 'WebSocket起動中！', type: ActivityType.Playing }],
        status: 'online',
    });


    const category = guild.channels.cache.get(CATEGORY_ID);
    if (category) {
        const groupVcs = category.children.cache.filter((c) => c.name.startsWith('Group') && c.type === ChannelType.GuildVoice);
        for (const vc of groupVcs.values()) {
            try {
                await vc.delete();
            } catch (error) {
                console.error(`VC ${vc.name} の削除エラー:`, error);
            }
        }
    }


    process.on('SIGINT', async () => {
        console.log("Process Clear.");
        clearTimeout(updateVoiceChannelsTimeout);
        clearInterval(updatePlayersInterval);
        discordClient.user?.setPresence({ status: 'invisible' });
        try {
            const lobbyChannel = guild.channels.cache.get(LOBBY_VC_ID);
            if (lobbyChannel && lobbyChannel.isVoiceBased()) { //型ガードを追加
                await Promise.all(lobbyChannel.members.map(async (member) => member.voice.setMute(false).catch((error) => console.error(`Error unmuting ${member.displayName}:`, error))));
            }
        } catch (error) {
            console.error("Error unmuting members on exit:", error);
        } finally {
            console.log("Exiting Discord bot.");
            discordClient.destroy();
            process.exit(0);
        }
    });


    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(discordClient.user?.id ?? ""),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});


discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'mc') {
        if (interaction.inGuild() && interaction.member instanceof GuildMember && !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Permission Denied')
                .setDescription('このコマンドを実行するには管理者権限が必要です。');
            return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
        } else if (!interaction.inGuild()) { //ギルド外の場合
            const dmEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('Error').setDescription('このコマンドはサーバー内でのみ実行できます。');
            return interaction.reply({ embeds: [dmEmbed], ephemeral: true });
        }


        const command = interaction.options.getString('command', true); // 第二引数にtrueを追加

        const world = server.getWorlds()[0];
        if (world) {
            try {
                const commandResult = await world.runCommand(`${command}`);

                const embed = new EmbedBuilder().setColor('#0099ff').setTitle('Minecraft Command Result').setDescription(`\`\`\`json\n${JSON.stringify(commandResult, null, 2)}\n\`\`\``).setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error("Error executing command:", error);
                const errorEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('Error').setDescription(`An error occurred: ${(error as Error).message}`); //型アサーションを追加
                await interaction.reply({ embeds: [errorEmbed] });
            }
        } else {
            await interaction.reply("Minecraft server is not connected.");
        }
    } else if (interaction.commandName === 'link') {

        const minecraftUsername = interaction.options.getString('minecraft_username', true); // 第二引数にtrueを追加
        const playerData = await WorldPlayer(minecraftUsername);


        if (playerData) {

            const uuid = playerData[0].uniqueId;
            const existingPlayer = Object.values(minecraftPlayerDiscordIds).find((p) => p.discordId === interaction.user.id);

            if (existingPlayer) {
                return interaction.reply({ content: `あなたのDiscordアカウントはすでに Minecraft ユーザー名 ${existingPlayer.name} と紐付けられています。`, ephemeral: true });
            }


            if (minecraftPlayerDiscordIds[uuid]) {
                return interaction.reply({ content: `Minecraft ユーザー名 ${minecraftUsername} はすでに他のDiscordアカウントに紐付けられています。`, ephemeral: true });
            }

            minecraftPlayerDiscordIds[uuid] = {
                name: minecraftUsername,
                discordId: interaction.user.id,
            };
            await saveWsData();
            await interaction.reply({ content: `Minecraft ユーザー名 ${minecraftUsername} を Discord アカウント ${interaction.user} に紐付けました。`, ephemeral: true });
        } else {
            await interaction.reply({ content: `Minecraft ユーザー ${minecraftUsername} は見つかりませんでした。`, ephemeral: true });
        }


    } else if (interaction.commandName === 'toggle') {

        if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) { //nullチェックを追加
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const feature = interaction.options.getString('feature', true); // 第二引数にtrueを追加
        switch (feature) {
            case 'discord':
                featureToggles.discord = !featureToggles.discord;
                await interaction.reply({ content: `Discord連携を${featureToggles.discord ? '有効化' : '無効化'}しました。`, ephemeral: true });
                break;
            case 'vc':
                featureToggles.vc = !featureToggles.vc;
                if (featureToggles.vc) {
                    initVcFunctions(guild, CATEGORY_ID, LOBBY_VC_ID);
                    updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000) as NodeJS.Timeout;
                } else {
                    clearTimeout(updateVoiceChannelsTimeout);
                }

                await interaction.reply({ content: `VC同期を${featureToggles.vc ? '有効化' : '無効化'}しました。`, ephemeral: true });
                break;
        }
    }
});


discordClient.on('messageCreate', async (message) => {
    if (!featureToggles.discord || message.author.bot || message.channel.id !== TARGET_DISCORD_CHANNEL_ID || !message.member) return;
    const displayName = message.member.displayName || message.author.username;

    const world = server.getWorlds()[0];
    if (world) {
        if (message.content.length > 45) return; //45文字以上はreturn
        for (const uuid in minecraftPlayerDiscordIds) {
            if (minecraftPlayerDiscordIds[uuid].discordId === message.author.id) {
                try {
                    await world.sendMessage(`§l§f<§b${displayName}§2(§a${minecraftPlayerDiscordIds[uuid].name}§2)§f>§r ${message.content}`);
                } catch (error) {
                    console.error("Minecraftへのメッセージ送信エラー:", error);
                }
                return;
            }
        }

        try {
            await world.sendMessage(`§l§f<§b${displayName}§f>§r ${message.content}`);
        } catch (error) {
            console.error("Minecraftへのメッセージ送信エラー:", error);
        }

    } else {
        console.error('Minecraftサーバーに接続されていません。');
    }
});