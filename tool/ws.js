import { Server } from 'socket-be';
import { Client, GatewayIntentBits, ChannelType, ActivityType, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionsBitField } from 'discord.js';
import * as fs from 'fs/promises';
import { updateVoiceChannels, initVcFunctions } from './vc.js';
import { config } from 'dotenv';

config();

// Discordの管理者ユーザーID
const adminDiscordIds = ["735854461636837389"];

//Toggle
const featureToggles = {
    discord: true,
    vc: false,
};


//設定値
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages] });
const discordToken = process.env.DISCORD_TOKEN;
const categoryId = '1311184107761438740';
const lobbyVcId = '1152788267910049893';
const TARGET_DISCORD_CHANNEL_ID = '901361525728608277'
const adminRoleId = '1111944859423625257';
const wsDataPath = 'wsData.json';
const userDataPatch = 'User.json';
export let minecraftPlayerDiscordIds = {};
let userData = {};
let guild;
export let updateVoiceChannelsTimeout;
let updatePlayersInterval;
const McommandPrefix = '#';
const MCommands = {};
const McommandsPerPage = 5;




const commands = [
    new SlashCommandBuilder()
        .setName('mc')
        .setDescription('Minecraft サーバーにコマンドを送信します')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('実行するコマンド')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Minecraft のユーザー名と Discord アカウントを紐付けします')
        .addStringOption(option =>
            option.setName('minecraft_username')
                .setDescription('Minecraft のユーザー名')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('機能の有効/無効を切り替えます。管理者権限が必要です。')
        .addStringOption(option =>
            option.setName('feature')
                .setDescription('切り替える機能 (discord, vc)')
                .setRequired(true)
                .addChoices(
                    { name: 'Discord Integration', value: 'discord' },
                    { name: 'Voice Channel Sync', value: 'vc' }
                )
        )

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(discordToken);



discordClient.login(discordToken);

discordClient.on('ready', async () => {
    console.log('Discord bot is ready!');



    guild = discordClient.guilds.cache.get("890315487962095637");
    if (!guild) {
        console.error("ギルドが見つかりません。");
        process.exit(1);
    }


    if (featureToggles.vc) {
        initVcFunctions(guild, categoryId, lobbyVcId);
        updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000);
    }



    discordClient.user.setPresence({
        activities: [{ name: 'WebSocket起動中！', type: ActivityType.Playing }],
        status: 'online'
    });



    const category = guild.channels.cache.get(categoryId);
    if (category) {
        const groupVcs = category.children.cache.filter(c => c.name.startsWith('Group') && c.type === ChannelType.GuildVoice);
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
        discordClient.user.setPresence({ status: 'invisible' });
        try {
            const lobbyChannel = guild.channels.cache.get(lobbyVcId);
            if (lobbyChannel) {
                await Promise.all(lobbyChannel.members.map(member =>
                    member.voice.setMute(false).catch(error => console.error(`Error unmuting ${member.displayName}:`, error))
                ));
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
        await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});


discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'mc') {



        if (!interaction.member.roles.cache.has(adminRoleId)) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Permission Denied')
                .setDescription('このコマンドを実行するには管理者権限が必要です。');
            return interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
        }
        const command = interaction.options.getString('command');

        const world = server.getWorlds()[0];
        if (world) {
            try {
                const commandResult = await world.runCommand(`${command}`);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Minecraft Command Result')
                    .setDescription(`\`\`\`json\n${JSON.stringify(commandResult, null, 2)}\n\`\`\``)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } catch (error) {
                console.error("Error executing command:", error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Error')
                    .setDescription(`An error occurred: ${error.message}`);

                await interaction.reply({ embeds: [errorEmbed] });
            }
        } else {
            await interaction.reply("Minecraft server is not connected.");
        }

    } else if (interaction.commandName === 'link') {
        const minecraftUsername = interaction.options.getString('minecraft_username');
        const playerData = await getData(minecraftUsername);

        if (playerData) {
            const uuid = playerData.uuid;

            const existingPlayer = Object.values(minecraftPlayerDiscordIds).find(p => p.discordId === interaction.user.id);

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
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'このコマンドを実行するには管理者権限が必要です。', ephemeral: true });
        }

        const feature = interaction.options.getString('feature');
        switch (feature) {
            case 'discord':
                featureToggles.discord = !featureToggles.discord;
                await interaction.reply({ content: `Discord連携を${featureToggles.discord ? '有効化' : '無効化'}しました。`, ephemeral: true });
                break;
            case 'vc':
                featureToggles.vc = !featureToggles.vc;
                if (featureToggles.vc) {
                    initVcFunctions(guild, categoryId, lobbyVcId);
                    updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000);
                } else {
                    clearTimeout(updateVoiceChannelsTimeout);
                }

                await interaction.reply({ content: `VC同期を${featureToggles.vc ? '有効化' : '無効化'}しました。`, ephemeral: true });
                break;
        }

    }
});

discordClient.on('messageCreate', async (message) => {
    if (!featureToggles.discord || message.author.bot || message.channel.id !== TARGET_DISCORD_CHANNEL_ID) return;
    const displayName = message.member?.displayName || message.author.username;

    const world = server.getWorlds()[0];
    if (world) {
        if (!(message.content.length <= 45)) return
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


export const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
});


// コマンド登録関数
function registerCommand(name, usage, description, adminOnly, execute) {
    MCommands[name] = { name, usage, description, adminOnly, execute }; 
}


const isAdmin = async (playerName) => {
    try {
        const playerData = await getData(playerName);
        if (!playerData) return false;
        // 特定のUUIDまたは名前のリストと照合
        const adminUUIDs = ["your-admin-uuid-1", "your-admin-uuid-2"]; // 管理者UUIDのリスト
        const adminNames = ["adminPlayer1", "adminPlayer2"]; // 管理者プレイヤー名のリスト

        return adminUUIDs.includes(playerData.uuid) || adminNames.includes(playerData.name);


    } catch (error) {
        console.error("権限検証エラー:", error);
        return false;
    }
};


async function loadWsData() {
    try {
        const data = await fs.readFile(wsDataPath, 'utf8');
        minecraftPlayerDiscordIds = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            minecraftPlayerDiscordIds = {};
            console.log('wsData.json not found. Creating a new one.');
            await saveWsData();
        } else {
            console.error('Error loading wsData.json:', error);
        }
    }
}

async function loadUserData() {
    try {
        const data = await fs.readFile(userDataPatch, 'utf8');
        userData = JSON.parse(data);
        console.log("userData loaded.");

    } catch (error) {

        if (error.code === 'ENOENT') {
            userData = {};
            console.log('User.json not found. Creating a new one.');
            await saveUserData();

        } else {

            console.error('Error loading User.json:', error);
        }
    }
}

async function saveUserData() {
    try {
        const data = JSON.stringify(userData, null, 2);
        await fs.writeFile(userDataPatch, data, 'utf8');
    } catch (error) {
        console.error('Error saving user.json:', error);
    }
}

async function saveWsData() {
    try {
        const data = JSON.stringify(minecraftPlayerDiscordIds, null, 2);
        await fs.writeFile(wsDataPath, data, 'utf8');
    } catch (error) {
        console.error('Error saving wsData.json:', error);
    }
}

server.events.on('serverOpen', async () => {
    console.log('Minecraft server is connected via websocket!');
    await loadWsData();
    await loadUserData();



    updatePlayersInterval = setInterval(updatePlayers, 5000);

});





async function updatePlayers() {
    try {
        const allPlayerData = await getData();
        if (!allPlayerData) return;

        let hasChanges = false;

        allPlayerData.forEach(playerData => {
            const existingData = userData[playerData.name] || {};

            const pingHistory = existingData.pingHistory || [];
            if (isFinite(playerData.ping) && playerData.ping !== null) {
                pingHistory.push(playerData.ping);
            }
            if (pingHistory.length > 5) {
                pingHistory.shift();
            }
            const avgping = pingHistory.reduce((sum, p) => sum + p, 0) / pingHistory.length || 0;

            const newData = {
                name: playerData.name,
                entityId: playerData.id,
                uuid: playerData.uuid,
                ping: playerData.ping,
                PacketLoss: playerData.packetloss,
                Avgping: avgping,
                Avgpacketloss: isFinite(playerData.avgpacketloss) && playerData.avgpacketloss !== null ? playerData.avgpacketloss : 0,
                lastJoin: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
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

function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}





server.events.on('playerChat', async (event) => {
    const { sender, world, message, type } = event;
    if (sender === 'External') return;






    const channel = guild.channels.cache.get(TARGET_DISCORD_CHANNEL_ID);
    if (featureToggles.discord) {
        if (channel && channel.isTextBased()) {
            if (type === 'chat') {
                channel.send(`<${sender}> ${message}`);
            }
        }
    }


    if (message.startsWith(McommandPrefix)) {
        const args = message.slice(McommandPrefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();

        const command = MCommands[commandName];

        if (command) {

            // isAdmin 関数を使用して権限を確認
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


//Minecraft コマンドシステム

registerCommand('ping', `${McommandPrefix}ping`, '自分のping値を確認します', false, async (sender, world, _args) => {
    try {
        const data = await getData(sender);
        if (data !== undefined) {
            await world.sendMessage(`${sender} has ping ${data.ping}`, sender);
            console.log(JSON.stringify(data,null,2))
        } else {
            await world.sendMessage(`Could not get ping for ${sender}`, sender); // senderを追加
        }
    } catch (error) {
        console.error("[Server] Error getting player ping:", error);
        await world.sendMessage(`[Server] Ping取得エラー`, sender); // エラーメッセージを簡略化
    }
});

registerCommand('help', `${McommandPrefix}help [ページ番号]`, 'コマンド一覧を表示します。', false, async (sender, world, args) => {
    let page = 1;
    if (args.length > 0) {
        page = parseInt(args[0]);
        if (isNaN(page) || page < 1) {
            page = 1;
        }
    }

    const commandList = Object.values(MCommands) 
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice((page - 1) * McommandsPerPage, page * McommandsPerPage);


    if (commandList.length === 0) {
        await world.sendMessage(`ページ ${page} は存在しません。`, sender);
        return;
    }

    let helpMessage = `=== ヘルプ (ページ ${page}) ===\n`;
    for (const command of commandList) {
        helpMessage += `\n${command.usage}: ${command.description} (${command.adminOnly ? '管理者専用' : '全員'})`;
    }

    const totalPages = Math.ceil(Object.keys(commands).length / McommandsPerPage);
    if (totalPages > 1) {
        helpMessage += `\n全 ${totalPages} ページ: #help [ページ番号] で他のページを表示`;
    }

    await world.sendMessage(helpMessage, sender);

});


async function main() {
    for (const world of server.getWorlds()) {
        const data = await world.ping
        const name = world.name
        const playerCount = await server.ip
        console.log(JSON.stringify(data));
        world.sendMessage(`[定期] PEXKurannからの情報(WebSocket) => \n
          §bワールド名: §a${name}§r\n
          §bPing: §a${JSON.stringify(data)}§6ms\n
          §bWsServerip: §a${playerCount}§r\n\n`)
    }

}








async function getData(playerName = null) {
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
                const details = parsed.result.map(player => {
                    const fixedPlayer = { ...player };
                    for (const key in fixedPlayer) {
                        if (typeof fixedPlayer[key] === 'number' && !isFinite(fixedPlayer[key])) {
                            fixedPlayer[key] = 0;
                        }
                    }
                    return fixedPlayer;
                });

                if (playerName) {
                    return details.find(p => p.name && p.name.includes(playerName));
                } else {
                    return details;
                }

            } else {
                console.warn("Invalid 'listd stats' output format:", parsed);
                return undefined;
            }
        } catch (parseError) {
            console.error("Error parsing player details:", parseError, res.details);
            return undefined;
        }
    } catch (outerError) {
        console.error("Outer error getting player:", outerError);
        return undefined;
    }
}

export async function WorldPlayer(player) {
    try {
        const world = server.getWorlds()[0];

        if (!world) {
            console.error("No world found.");
            return undefined;
        }

        const res = await world.runCommand(`querytarget ${player}`);

        if (res.statusCode !== 0) {
            return undefined;
        }

        try {
            const data = JSON.parse(res.details);
            if (data && data.length > 0) {
                return data[0];

            } else {
                console.warn("Invalid 'querytarget' output format:", data);
                return undefined;
            }
        } catch (parseError) {
            console.error("Error parsing 'querytarget' details:", parseError, res.details);
            return undefined;
        }

    } catch (error) {
        console.error("Error in UserData function:", error);
        return undefined;
    }
}



async function updateVoiceChannelWrapper() {
    if (!featureToggles.vc) return;

    const world = server.getWorlds()[0];
    if (!world) {
        updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000);
        return;
    }

    try {
        const minecraftPlayers = await Promise.all(
            Object.keys(minecraftPlayerDiscordIds).map(async (uuid) => {
                const playerData = await WorldPlayer(minecraftPlayerDiscordIds[uuid].name);
                return playerData ? { ...playerData, uniqueId: uuid } : null;
            })
        ).then(results => results.filter(player => player !== null));


        const playersByDiscordId = {};
        minecraftPlayers.forEach(player => {
            const discordId = minecraftPlayerDiscordIds[player.uniqueId]?.discordId;
            if (discordId) {
                playersByDiscordId[discordId] = player;
            }
        });

        await updateVoiceChannels(playersByDiscordId);
    } catch (error) {
        console.error("Error updating voice channels:", error);
    } finally {
        updateVoiceChannelsTimeout = setTimeout(updateVoiceChannelWrapper, 2000);
    }
}