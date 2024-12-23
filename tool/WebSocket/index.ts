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
    GuildMember,

} from 'discord.js';
import * as fs from 'fs/promises';
import { config } from 'dotenv';
import { updateVoiceChannels, initVcFunctions } from './vc';
import path from 'path';
import os from 'os';
import express from 'express';
import { createContext, Script } from 'vm';
import World from 'socket-be/typings/structures/World';



const defaultEnvContent = `# 自動的に.envファイルを作成しました\n
# ここに設定値を書き込んで下さい

DISCORD_TOKEN="これは必須"
TARGET_DISCORD_CHANNEL_ID="これはDiscordのチャットをマイクラに送信する際に使うチャンネル"
GUILD_ID="鯖のID"
CATEGORY_ID="vcのチャンネルを作るカテゴリID"
LOBBY_VC_ID="ロビーvcのiD"
ADMIN_ROLE_ID="管理者権限を持つロールのID"
ADMINUUID=['マイクラでの管理者のID']
ADMINNAME=['マイクラでの管理者のname']
SERVER_STATUS_INTERVAL=5000
SERVER_STATUS_CHANNEL_ID=あなたのチャンネルID
`;

const createDefaultEnvFile = async (filePath: any) => {
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
const SERVER_STATUS_INTERVAL = parseInt(process.env.SERVER_STATUS_INTERVAL || "5000", 10); // デフォルト値を設定
const SERVER_STATUS_CHANNEL_ID = process.env.SERVER_STATUS_CHANNEL_ID;
const serverStartTime = Date.now();

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

interface StatusData {
    messageId: string | null;
}
export interface WarnData {
    uuid: string;
    name: string;
    reason: string;
    warnedBy: string;
    warnedAt: number;
}

// Minecraftコマンド設定
export const MINECRAFT_COMMAND_PREFIX = '#';
export const MINECRAFT_COMMANDS_PER_PAGE = 3;
const adminUUIDs: string[] = process.env.ADMINUUID as any;
const adminNames: string[] = process.env.ADMINNAME as any;
export let warnList: WarnData[] = []
export const warnCount = 5;
let ServerStauts: NodeJS.Timeout;



// データファイルパス
const WS_DATA_PATH = 'wsData.json';
const USER_DATA_PATH = 'User.json';
const BAN_USER_PATH = 'banUser.json';
const STATUS_DATA_PATH = 'statusData.json';



// グローバル変数
let guild;
export let minecraftPlayerDiscordIds: { [uuid: string]: { name: string; discordId: string } } = {};
export let userData: { [username: string]: any } = {};
let updateVoiceChannelsTimeout: NodeJS.Timeout;
let updatePlayersInterval: NodeJS.Timeout;
export let banList: BanData[] = [];
let isWorldLoaded = false; //defaultではワールドにつないでないためoff
let statusData: StatusData = { messageId: null };
let serverStatusMessageId: string | null = null;
const sharedData: { [key: string]: any } = {};
const allowedFunctions: { [key: string]: Function } = {};
const allowedDefinitions: { [key: string]: any } = {};


//APIに渡すデータ値
sharedData['userData'] = userData;








// Discordクライアント
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ],
});


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
    avgpacketloss?: number;
    clientId: string;
    color: string;
    deviceSessionId: string;
    globalMultiplayerCorrelationId: string;
    id?: number;
    maxbps: number;
    name: string;
    packetloss?: number;
    ping?: number;
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

interface InfoPlayerData {
    name: string;
    uuid: string;
}


const app = express();
app.use(express.json());

// プラグイン登録API
app.post('/api/register', (req: any, res: any) => {
    const { name, data } = req.body;  // デストラクチャリングで読みやすく
    if (!name || !data) {
        return res.status(400).json({ error: 'Invalid plugin data. "name" and "data" are required.' });
    }

    sharedData[name] = data;
    console.log(`Plugin "${name}" registered with data:`, data); // データの内容もログに出力
    res.json({ message: 'Plugin registered successfully' });
});

// データ取得API
app.get('/api/getData/:dataName', (req, res) => {
    const dataName = req.params.dataName;
    if (sharedData[dataName]) {
        res.json(sharedData[dataName]);
    } else {
        res.status(404).json({ error: 'Data not found for key: ' + dataName }); // エラーメッセージを明確化
    }
});

app.get('/api/get/:itemName', async (req, res) => {
    const itemName = req.params.itemName;

    try {
        if (sharedData[itemName]) {
            res.json(sharedData[itemName]);
        } else if (allowedFunctions[itemName]) {
            const func = allowedFunctions[itemName];
            let result;
            const args = Object.values(req.query);

            if (func.constructor.name === 'AsyncFunction' || func().then) {
                result = await func(...args);
            } else {
                result = func(...args);
            }
            res.json(result);

        } else if (allowedDefinitions[itemName]) {
            // ここでstringifyを使う
            const serializedDefinition = JSON.stringify(allowedDefinitions[itemName]);
            res.json(serializedDefinition);

        } else {
            res.status(404).json({ error: 'Item not found.' });
        }

    } catch (error) {
        console.error(`Error handling item ${itemName}:`, error);
        res.status(500).json({ error: 'Failed to handle item.' + error });
    }
});

app.post('/api/execute', async (req: any, res: any) => {
    const { code, functionName, args } = req.body;

    if (!code || !functionName) {
        return res.status(400).json({ error: 'Code and functionName are required.' });
    }

    try {
        const sandbox = {
            server,
            console,
        };

        const context = createContext(sandbox);


        const script = new Script(code);
        script.runInContext(context);
        const func = sandbox[functionName];

        if (typeof func !== 'function') {
            throw new Error(`'${functionName}' is not a function.`);
        }
        const result = func(server, ...args);
        const resolvedResult = result instanceof Promise ? await result : result;
        res.json({ result: resolvedResult });
    } catch (error) {
        console.error('Error executing code:', error);
        res.status(500).json({ error: 'Failed to execute code.', details: error.message });
    }
});

const httpServer = app.listen(5000, () => {
    console.log('ポート5000でバックエンドAPIを起動しました');
});


export const minecraftCommands: { [commandName: string]: MinecraftCommand } = {};

export function registerCommand(name: string, usage: string, description: string, adminOnly: boolean, execute: (sender: string, world: World, args: string[]) => Promise<void>): void {
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
// ステータスデータの読み込み
async function loadStatusData() {
    try {
        const data = await fs.readFile(STATUS_DATA_PATH, 'utf8');
        statusData = JSON.parse(data);
        serverStatusMessageId = statusData.messageId;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            console.log('statusData.json not found. Creating a new one.');
            await saveStatusData();
        } else {
            console.error('Error loading statusData.json:', error);
        }
    }
}

// ステータスデータの保存
async function saveStatusData() {
    try {
        statusData.messageId = serverStatusMessageId;
        const data = JSON.stringify(statusData, null, 2);
        await fs.writeFile(STATUS_DATA_PATH, data, 'utf8');
    } catch (error) {
        console.error('Error saving statusData.json:', error);
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
        let playerDataList: (PlayerData | InfoPlayerData)[] = []; // PlayerDataまたはPartialPlayerDataの配列
        const dataFromGetData = await getData();

        if (dataFromGetData) {
            playerDataList = Array.isArray(dataFromGetData) ? dataFromGetData : [dataFromGetData];
        } else {
            const dataFromPlayerList = await playerList();
            if (dataFromPlayerList) {
                playerDataList = dataFromPlayerList; // playerListはPartialPlayerData[]を返す
            } else {
                return;
            }
        }

        let hasChanges = false;

        for (const playerData of playerDataList) {
            userData[playerData.name] = userData[playerData.name] || {}; // userDataにプレイヤーが存在しない場合の初期化

            userData[playerData.name].name = playerData.name;
            userData[playerData.name].uuid = playerData.uuid;

            if ('ping' in playerData && playerData.ping !== undefined) { // pingプロパティが存在する場合のみ更新
                const pingHistory = [...(userData[playerData.name].pingHistory || []), playerData.ping];

                if (pingHistory.length > 5) {
                    pingHistory.shift();
                }

                userData[playerData.name].ping = playerData.ping;
                userData[playerData.name].pingHistory = pingHistory;
                userData[playerData.name].Avgping =
                    pingHistory.reduce((sum, p) => sum + p, 0) / pingHistory.length || 0;
            }
            // packetloss, avgpacketlossなども同様に処理

            if ('activeSessionId' in playerData) {
                userData[playerData.name] = {
                    ...userData[playerData.name],
                    ...playerData,
                };
            }


            // 変更を検知
            if (!deepEqual(userData[playerData.name], playerData)) {

                hasChanges = true;
            }

        }



        if (hasChanges) {
            sharedData['userData'] = userData;
            await saveUserData(); // awaitを追加
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



//渡す権限(関数)

allowedFunctions['playerList'] = playerList;
allowedFunctions['isAdmin'] = isAdmin;
allowedFunctions['getBanList'] = getBanList;
allowedFunctions['WorldPlayer'] = WorldPlayer;
allowedFunctions['getData'] = getData;








server.events.on('serverOpen', async () => {
    console.log('Minecraft server is connected via websocket!');
    const load = await import('./import');
    //Load Command
    load;
    // Load Data
    await loadWsData();
    await loadUserData();
    await loadBanList();
    await loadStatusData();
    updatePlayersInterval = setInterval(updatePlayers, 500) as NodeJS.Timeout;
});



server.events.on('worldAdd', async () => {
    isWorldLoaded = true;
    ServerStauts = setInterval(sendServerStatus, SERVER_STATUS_INTERVAL);

});

server.events.on('worldRemove', async () => {
    isWorldLoaded = false;
    clearInterval(ServerStauts);
    await sendServerStatus(true);
})

server.events.on('playerChat', async (event) => {
    const { sender, world, message, type } = event;
    if (sender === 'External') return;



    const channel = guild.channels.cache.get(TARGET_DISCORD_CHANNEL_ID);
    if (featureToggles.discord) {
        if (channel && channel.isTextBased() && !message.startsWith(MINECRAFT_COMMAND_PREFIX)) {
            if (type === "chat") {
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


        if (!args) return;

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

const playerListCache = {};





//BANシステムでの自動キック処理
server.events.on('playerJoin', async (event) => {
    const world = server.getWorlds()[0];
    if (!world) return;

    for (const playerNameWithTags of event.players) {
        try {
            let playerInfo: { name: string; uuid: string; } | undefined;
            for (const realPlayerName in playerListCache) {
                if (playerNameWithTags.includes(realPlayerName)) {
                    playerInfo = playerListCache[realPlayerName]
                    break;
                }
            }

            if (!playerInfo) {
                let attempts = 0;
                const maxAttempts = 10;

                while (!playerInfo && attempts < maxAttempts) {
                    const playerListResult = await playerList();

                    if (playerListResult) {
                        playerInfo = playerListResult.find(p => playerNameWithTags.includes(p.name));
                    } else {
                        console.error("Failed to get player list.");
                    }


                    if (!playerInfo) {
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }


                if (!playerInfo) {
                    console.warn(`Player ${playerNameWithTags} not found in player list after ${maxAttempts} attempts.`);
                    continue;
                }

                playerListCache[playerInfo.name] = playerInfo;

            }

            const realPlayerName = playerInfo.name;
            const uuid = playerInfo.uuid;

            if (!userData[realPlayerName]) {
                userData[realPlayerName] = { lastJoin: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) };
            } else if (!playerListCache[realPlayerName]) {
                userData[realPlayerName].lastJoin = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
            }
            await saveUserData();

            const ban = banList.find(ban => ban.uuid === uuid);

            if (ban) {
                if (ban.expiresAt && ban.expiresAt < Date.now()) {
                    banList = banList.filter(b => b.uuid !== uuid);
                    await saveBanList();
                    console.log(`Expired ban for ${realPlayerName} removed.`);
                    continue;
                }

                const kickMessage = `§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${ban.reason}\n§fBANした管理者: §b${ban.bannedBy}\n§f期限: §e${ban.expiresAt ? new Date(ban.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '永久'}`;
                await world.runCommand(`kick "${realPlayerName}" ${kickMessage}`);
                await world.sendMessage(`§l§f[Server]§r\n§c X §aユーザー §b${realPlayerName}§a はBANされています。§r\n§c参加を拒否しました。`);
                console.log(`Banned player ${realPlayerName} tried to join.`);
                continue;
            }
        } catch (error) {
            console.error(`Error processing player ${playerNameWithTags}:`, error);
        }
    }
});

server.events.on('playerLeave', async (event) => {
    const playersWithTags = event.players;

    if (Array.isArray(playersWithTags)) {
        for (const playerNameWithTags of playersWithTags) {

            let realPlayerName: any;
            for (const name in playerListCache) {
                if (playerNameWithTags.includes(name)) {
                    realPlayerName = name;
                    break;
                }
            }

            if (realPlayerName && userData[realPlayerName]) {
                try {
                    userData[realPlayerName].lastLeave = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                    await saveUserData();
                } catch (error) {
                    console.error(`Error recording lastLeave for ${realPlayerName}:`, error);
                }
            }

            const playerListResult = await playerList();
            if (playerListResult && realPlayerName && !playerListResult.find(p => p.name === realPlayerName)) {
                delete playerListCache[realPlayerName];
                console.log(`Player ${realPlayerName} (${playerNameWithTags}) removed from cache.`);
            } else if (!playerListResult) {
                console.error("Failed to get player list on playerLeave.");
            }
        }
    } else {
        console.error("event.players is not an array. Check your BeAPI version or configuration.");
    }
});

// Discord bot起動時の処理
discordClient.login(DISCORD_TOKEN);



const commands = [
    new SlashCommandBuilder().setName('mc').setDescription('Minecraft サーバーにコマンドを送信します').addStringOption((option) => option.setName('command').setDescription('実行するコマンド').setRequired(true)),
    new SlashCommandBuilder().setName('link').setDescription('Minecraft のユーザー名と Discord アカウントを紐付けします').addStringOption((option) => option.setName('minecraft_username').setDescription('Minecraft のユーザー名').setRequired(true)),
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('機能の有効/無効を切り替えます。管理者権限が必要です。')
        .addStringOption((option) =>
            option.setName('feature').setDescription('切り替える機能 (discord, vc)').setRequired(true).addChoices({ name: 'Discord Integration', value: 'discord' }, { name: 'Voice Channel Sync', value: 'vc' })
        ),
    new SlashCommandBuilder().setName('list').setDescription('オンラインプレイヤーのリストを表示します。'),
    new SlashCommandBuilder().setName('ban').setDescription('プレイヤーをBANします。').addStringOption(option => option.setName('player').setDescription('プレイヤー名').setRequired(true)).addStringOption(option => option.setName('reason').setDescription('理由').setRequired(true)).addStringOption(option => option.setName('duration').setDescription('期間 (例: 1d, 2h, 30m)')),
    new SlashCommandBuilder().setName('unban').setDescription('プレイヤーのBANを解除します。').addStringOption(option => option.setName('player').setDescription('プレイヤー名').setRequired(true)),
    new SlashCommandBuilder()
        .setName('check')
        .setDescription('プレイヤー情報を確認します。管理者権限が必要です。')
        .addSubcommand(subcommand =>
            subcommand.setName('time').setDescription('オフラインプレイヤーの情報を確認します。').addIntegerOption(option => option.setName('page').setDescription('ページ番号'))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('banlist').setDescription('BANリストを確認します。').addIntegerOption(option => option.setName('page').setDescription('ページ番号'))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('data').setDescription('特定のプレイヤーのデータを確認します。').addStringOption(option => option.setName('player').setDescription('プレイヤー名').setRequired(true))
        ),
    new SlashCommandBuilder().setName('warn').setDescription('プレイヤーに警告を追加します。').addStringOption(option => option.setName('player').setDescription('プレイヤー名').setRequired(true)).addStringOption(option => option.setName('reason').setDescription('理由').setRequired(true)),
].map(command => command.toJSON());




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
        activities: [{ name: 'WebSocketが起動中!!', type: ActivityType.Playing }],
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

    //プロセス終了時の動作

    process.on('SIGINT', async () => {
        await handleShutdown('SIGINT');
    });

    process.on('SIGTERM', async () => {
        await handleShutdown('SIGTERM');
    });

    process.on('exit', async (code) => {
        if (code !== 0) {
            await handleShutdown('exit with error code: ' + code);
        }
    });

    // Windows specific event for handling console closing
    if (process.platform === 'win32') {
        process.on('SIGHUP', async () => {
            await handleShutdown('SIGHUP');
        });
    }



    async function handleShutdown(signal) {
        console.log(`Received ${signal}. Process Clear.`);

        const world = server.getWorlds()[0];
        if (world) {
            world.sendMessage(`§l§f[Server]§r:§bWebSocket§aが正常に終了しました`);
        }

        clearTimeout(updateVoiceChannelsTimeout);
        clearInterval(updatePlayersInterval);
        clearInterval(ServerStauts);

        discordClient.user?.setPresence({ status: 'invisible' });

        try {
            const lobbyChannel = guild.channels.cache.get(LOBBY_VC_ID);
            if (lobbyChannel && lobbyChannel.isVoiceBased()) {
                await Promise.all(lobbyChannel.members.map(async (member) => member.voice.setMute(false).catch((error) => console.error(`Error unmuting ${member.displayName}:`, error))));
            }
        } catch (error) {
            console.error("Error unmuting members on exit:", error);
        } finally {
            console.log("Exiting Discord bot.");
            console.log('HTTP server closed.');
            httpServer.close();
            await sendServerStatus(true);
            discordClient.destroy();
            process.exit(0);
        }
    }


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
    const isAdmin = interaction.inGuild() && interaction.member instanceof GuildMember && interaction.member.roles.cache.has(ADMIN_ROLE_ID);

    if (interaction.commandName === 'mc') {
        if (!isAdmin) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Permission Denied')
                .setDescription('このコマンドを実行するには管理者権限が必要です。');
            return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
        }



        const command = interaction.options.getString('command', true);

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

        if (!isAdmin) {
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
    else if (interaction.commandName === 'list') {
        const playerListResult = await playerList();
        if (playerListResult && playerListResult.length > 0) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`(${playerListResult.length}) Online Players`)
                .setDescription(
                    playerListResult
                        .map(player => `• ${player.name}  (${player.uuid})`)
                        .join('\n')
                );
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply(
                'プレイヤーがいないもしくはServerがtestforコマンドに対応しておらず(取得できませんでした).'
            );
        }
    } else if (interaction.commandName === 'ban' || interaction.commandName === 'unban') {
        if (!isAdmin) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const playerName = interaction.options.getString('player', true);

        if (interaction.commandName === 'ban') {
            const reason = interaction.options.getString('reason', true);
            const duration = interaction.options.getString('duration');

            let expiresAt: number | null = null;
            if (duration) {
                const durationParts = duration.split(',');
                let totalMilliseconds = 0;
                for (const part of durationParts) {
                    const durationMatch = part.trim().match(/(\d+)([dhm])/);
                    if (durationMatch) {
                        const durationValue = parseInt(durationMatch[1]);
                        const unit = durationMatch[2];
                        let multiplier = 1000; // milliseconds
                        switch (unit) {
                            case 'm': multiplier *= 60; break; // minutes
                            case 'h': multiplier *= 60 * 60; break; // hours
                            case 'd': multiplier *= 60 * 60 * 24; break; // days
                        }
                        totalMilliseconds += durationValue * multiplier;
                    } else {
                        return interaction.reply({ content: `期間の指定が正しくありません: ${part}`, ephemeral: true });
                    }
                }
                expiresAt = Date.now() + totalMilliseconds;
            }



            let banList = await getBanList();

            const playerData = await WorldPlayer(playerName);
            if (!playerData || playerData.length === 0) {
                return interaction.reply({ content: `プレイヤー ${playerName} は見つかりませんでした。`, ephemeral: true });
            }

            const playerInfo = playerData[0];
            const uuid = playerInfo.uniqueId;

            const existingBan = banList.find(ban => ban.uuid === uuid);
            if (existingBan) {
                return interaction.reply({ content: `プレイヤー ${playerName} はすでにBANされています。`, ephemeral: true });
            }

            const newBan: BanData = {
                uuid: uuid,
                name: playerName,
                reason: reason,
                bannedBy: interaction.user.username,
                bannedAt: Date.now(),
                expiresAt: expiresAt,
            };

            banList.push(newBan);
            await saveBanList();


            const world = server.getWorlds()[0];
            if (world) {
                try {
                    const kickMessage = `§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${reason}\n§fBANした管理者: §b${interaction.user.username}\n§f期限: §e${newBan.expiresAt ? new Date(newBan.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '永久'}`;
                    await world.runCommand(`kick "${playerName}" ${kickMessage}`);
                    const broadcastMessage = `§6===============================\n§a[BAN通知] §e${playerName}§a ユーザーがBANされました！\n§f理由: §e${reason}\n§fBANした管理者: §b${interaction.user.username}\n§6===============================`;
                    world.sendMessage(broadcastMessage);
                } catch (error) {
                    console.error("キックコマンドの実行エラー:", error);
                    interaction.followUp({ content: 'プレイヤーのキック中にエラーが発生しました。', ephemeral: true }).catch(console.error); // followUpのエラー処理も追加
                }
            }


            await interaction.reply({ content: `プレイヤー ${playerName} をBANしました。`, ephemeral: true });

        } else if (interaction.commandName === 'unban') {
            if (!isAdmin) {
                return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
            }
            let banList = await getBanList();
            const targetBan = banList.find(ban => ban.name === playerName);

            if (!targetBan) {
                return interaction.reply({ content: `プレイヤー ${playerName} はBANされていません。`, ephemeral: true });
            }


            banList = banList.filter(ban => ban.name !== playerName);
            await saveBanList();

            return interaction.reply({ content: `プレイヤー ${playerName} のBANを解除しました。`, ephemeral: true });
        }
    } else if (interaction.commandName === 'check') {
        if (!isAdmin) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const page = interaction.options.getInteger('page') || 1;

        switch (subcommand) {
            case 'time': {
                if (!isWorldLoaded) {
                    return interaction.reply('Minecraftサーバーに接続されていません。');
                }


                const onlinePlayers = await playerList();
                const onlinePlayerNames = onlinePlayers?.map(p => p.name) || [];

                let playersToShow = Object.values(userData).filter(player => !onlinePlayerNames.includes(player.name));

                playersToShow.sort((a, b) => new Date(b.lastLeave ?? 0).getTime() - new Date(a.lastLeave ?? 0).getTime());


                const totalPages = Math.ceil(playersToShow.length / 3);
                if (page > totalPages) {
                    return interaction.reply({ content: `ページ ${page} は存在しません。`, ephemeral: true });
                }

                const startIndex = (page - 1) * 3;
                const endIndex = startIndex + 3;
                const paginatedPlayers = playersToShow.slice(startIndex, endIndex);


                const embed = new EmbedBuilder()
                    .setTitle(`オフラインプレイヤー情報 (ページ ${page}/${totalPages})`)
                    .setColor('#0099ff');

                for (const player of paginatedPlayers) {
                    const lastJoin = player.lastJoin || "データなし";
                    const lastLeave = player.lastLeave || "データなし";
                    const fields = [
                        { name: '名前', value: player.name, inline: true },
                        { name: '最終参加', value: lastJoin, inline: true },
                        { name: '最終退出', value: lastLeave, inline: true },
                    ];
                    embed.addFields(...fields);
                }

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            case 'banlist': {
                const banList = await getBanList();
                const totalPages = Math.ceil(banList.length / 5);

                if (page > totalPages) {
                    return interaction.reply({ content: banList.length === 0 && page === 1 ? "BANされているプレイヤーはいません。" : `ページ ${page} は存在しません。`, ephemeral: true });
                }

                const startIndex = (page - 1) * 5;
                const endIndex = startIndex + 5;
                const paginatedBans = banList.slice(startIndex, endIndex);

                const embed = new EmbedBuilder()
                    .setTitle(`BANリスト (ページ ${page}/${totalPages})`)
                    .setColor('#ff0000');


                for (const ban of paginatedBans) {
                    const banDate = new Date(ban.bannedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                    const expiryDate = ban.expiresAt ? new Date(ban.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : "永久";
                    embed.addFields({
                        name: `${ban.name} (UUID: ${ban.uuid})`,
                        value: `BAN日: ${banDate}\n期限: ${expiryDate}\n理由: ${ban.reason}\nBANした人: ${ban.bannedBy}`,
                        inline: false
                    });

                }

                return interaction.reply({ embeds: [embed], ephemeral: false });
            }
            case 'data': {
                const playerName = interaction.options.getString('player', true);

                const playerData = userData[playerName];

                if (!playerData) {
                    return interaction.reply({ content: `プレイヤー ${playerName} のデータが見つかりません。`, ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${playerName} のデータ`)
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Name', value: playerData.name, inline: true },
                        { name: 'UUID', value: playerData.uuid, inline: true },
                        { name: 'Avgping', value: playerData.Avgping !== undefined ? playerData.Avgping.toString() : "データなし", inline: true },
                        { name: 'ID', value: playerData.id !== undefined ? playerData.id.toString() : "データなし", inline: true },
                        { name: '最終参加', value: playerData.lastJoin || "データなし", inline: true },
                        { name: '最終退出', value: playerData.lastLeave || "データなし", inline: true },
                    );


                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            default:
                return interaction.reply({ content: '無効なサブコマンドです。', ephemeral: true });
        }
    } else if (interaction.commandName === 'warn') {
        if (!isAdmin) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const playerName = interaction.options.getString('player', true);
        const reason = interaction.options.getString('reason', true);

        const playerData = await WorldPlayer(playerName);
        if (!playerData || playerData.length === 0) {
            return interaction.reply({ content: `プレイヤー ${playerName} は見つかりませんでした。`, ephemeral: true });
        }

        const playerInfo = playerData[0];
        const uuid = playerInfo.uniqueId;

        const newWarn: WarnData = {
            uuid: uuid,
            name: playerName,
            reason: reason,
            warnedBy: interaction.user.username,
            warnedAt: Date.now(),
        };

        warnList.push(newWarn);

        const playerWarns = warnList.filter(warn => warn.uuid === uuid);
        const world = server.getWorlds()[0];

        if (world) {
            world.sendMessage(`§l§f[Server]§r §e${playerName} §aに警告を追加しました。(§e理由:§c${reason}§a) §fby §b${interaction.user.username}`);
            world.sendMessage(`§eあなたは警告を受けました。理由: §c${reason} §fby §b${interaction.user.username} `, playerName);
            await interaction.reply({ content: `プレイヤー ${playerName} に警告を追加しました。現在${playerWarns.length}`, ephemeral: true });
        } else {
            return interaction.reply({ content: `ワールドと接続されていない可能性があります`, ephemeral: true });
        }





        if (playerWarns.length >= warnCount) {
            world.sendMessage(`§l§f[Server] §cプレイヤー §e${playerName} §cは${warnCount}回警告を受けたため、一時的にBANされます。`);

            let banList = await getBanList();
            const newBan: BanData = {
                uuid: uuid,
                name: playerName,
                reason: `§e${warnCount}回§c警告を受けたため`,
                bannedBy: "Server",
                bannedAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            };
            banList.push(newBan);
            await saveBanList();

            // 警告リストから該当プレイヤーの警告を削除
            warnList.filter(warn => warn.uuid !== uuid);

            try {
                const kickMessage = `\n§4[§cBAN通知§4]\n§fあなたはBANされました。\n§f理由: §e${warnCount}回警告を受けたため\n§fBANした管理者: §bServer\n§f期限: §e24時間`;
                await world.runCommand(`kick "${playerName}" ${kickMessage}`);
                const broadcastMessage = `§6===============================\n§a[BAN通知] §e${playerName}§a ユーザーがBANされました！\n§f理由: §e${warnCount}回警告を受けたが改善しなかった為\n§fBANした管理者: §bServer\n§6===============================`;
                world.sendMessage(broadcastMessage);
            } catch (error) {
                console.error("キックコマンドの実行エラー:", error);
            }


            await interaction.reply({ content: `プレイヤー ${playerName} に警告を追加しました。`, ephemeral: true });
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



async function sendServerStatus(status?: boolean) {
    if (!guild) return;

    const statusChannel = guild.channels.cache.get(SERVER_STATUS_CHANNEL_ID);
    if (!statusChannel?.isTextBased()) {
        console.error("指定されたチャンネルが見つからないか、テキストチャンネルではありません。");
        return;
    }

    try {
        const world = await server.getWorlds()[0];
        const playerListResult = await playerList();
        const playerCount = playerListResult?.length ?? 0;
        let StatusIco: string;
        const now = new Date();
        const formattedTime = now.toLocaleTimeString();



        const cpus = os.cpus();
        let totalCpuTime = 0;
        let totalIdleTime = 0;
        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalCpuTime += cpu.times[type as keyof typeof cpu.times];
            }
            totalIdleTime += cpu.times.idle;
        }
        const cpuUsage = 100 - (100 * totalIdleTime / totalCpuTime);

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsage = Math.round((usedMem / totalMem) * 100);

        const serverUptime = Math.floor((Date.now() - serverStartTime) / 1000);
        const days = Math.floor(serverUptime / (3600 * 24));
        const hours = Math.floor((serverUptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((serverUptime % 3600) / 60);
        const seconds = serverUptime % 60;
        const uptimeString = `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;

        const loadavg = os.loadavg();
        const cpuCount = os.cpus().length;
        const loadAverage = loadavg[0] / cpuCount;
        const loadStatus = loadAverage < 0.7 ? "低" : loadAverage < 1.0 ? "中" : "高";

        let currentHighestPingPlayer = "";
        let currentHighestPing = 0;

        if (playerListResult) {
            for (const player of playerListResult) {
                const playerData = userData[player.name];
                if (playerData && playerData.ping && playerData.ping > currentHighestPing) {
                    currentHighestPing = playerData.ping;
                    currentHighestPingPlayer = player.name;
                }
            }
        }




        let serverPing: number;
        if (status) {
            serverPing = 999;
        } else {
            const wsping = world.ping;
            serverPing = wsping - 50;
        }



        if (status) {
            StatusIco = `(Offline)❌`
        } else {
            StatusIco = `(Online)⭕`
        }







        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Minecraft Server Status:${StatusIco}`)
            .addFields(
                { name: '起動時間', value: uptimeString },
                { name: 'ワールド人数', value: playerCount.toString(), inline: true },
                { name: 'ワールド最高Ping', value: currentHighestPingPlayer ? `${currentHighestPingPlayer} (${currentHighestPing}ms)` : "なし", inline: true },
                { name: 'CPU 使用率', value: `${cpuUsage.toFixed(2)}%`, inline: true },
                { name: 'メモリ使用率', value: `${memUsage}%`, inline: true },
                { name: '使用メモリ', value: `${Math.round(usedMem / 1024 / 1024)}MB`, inline: true },
                { name: '負荷', value: `${loadStatus} (${loadAverage.toFixed(2)})`, inline: true },
                { name: 'wsのping値', value: `${serverPing}ms`, inline: true },



            )
            .setFooter({ text: `最終更新: ${formattedTime}` });

        try {
            const existingMessage = serverStatusMessageId && await statusChannel.messages.fetch(serverStatusMessageId);

            if (existingMessage) {
                await existingMessage.edit({ embeds: [embed] });
            } else {
                const newMessage = await statusChannel.send({ embeds: [embed] });
                serverStatusMessageId = newMessage.id;
                await saveStatusData();
            }

        } catch (error) {
            console.error("メッセージの送信/編集エラー:", error);
            serverStatusMessageId = null;
        }

    } catch (error) {
        console.error("Server Status Error:", error);
    }
}

