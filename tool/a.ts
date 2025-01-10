import { Client, GatewayIntentBits, Guild, PermissionsBitField, Snowflake, TextChannel, VoiceChannel, ChannelType, Locale, CategoryChannelResolvable, } from 'discord.js';
import fs from 'fs';

interface RoleData {
    id: Snowflake;
    name: string;
    color: number;
    hoist: boolean;
    position: number;
    permissions: bigint;
    mentionable: boolean;
}

interface ChannelData {
    id: Snowflake;
    type: ChannelType;
    name: string;
    topic?: string | undefined;
    nsfw?: boolean;
    rateLimitPerUser?: number;
    bitrate?: number;
    userLimit?: number;
    parentId?: Snowflake | null;
    rtcRegion?: string | null;
    children?: Snowflake[];
}

interface EmojiData {
    id: Snowflake;
    name: string;
    animated: boolean;
    url: string;
}

interface MemberData {
    id: Snowflake;
    nickname: string | null;
    roles: Snowflake[];
    joinedAt: number;
}

interface BackupData {
    timestamp: number;
    name: string;
    icon: string | null;
    // region: string; // v14では非推奨、代わりにpreferredLocaleを使用
    preferredLocale: string;
    afkTimeout: number;
    afkChannel: Snowflake | null;
    systemChannel: Snowflake | null;
    systemChannelFlags: number;
    rulesChannel: Snowflake | null;
    publicUpdatesChannel: Snowflake | null;
    verificationLevel: number;
    defaultMessageNotifications: number;
    explicitContentFilter: number;
    roles: RoleData[];
    channels: ChannelData[];
    emojis: EmojiData[];
    members: MemberData[];
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        // 必要に応じてインテントを追加
    ],
});

const PREFIX = '!';

client.on('ready', () => {
    console.log(`${client.user!.tag} としてログインしました！`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()!.toLowerCase();

    // 管理者のみがコマンドを実行できるようにする (オプション)
    if (!message.member!.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('このコマンドを実行する権限がありません。');
    }

    if (command === 'save') {
        const backupName = args[0];
        if (!backupName) {
            return message.reply('バックアップ名を指定してください！');
        }

        try {
            const backupData = await createBackup(message.guild);
            saveBackup(backupName, backupData);
            message.reply(`サーバーのバックアップを ${backupName}.json として保存しました！`);
        } catch (error) {
            console.error('バックアップの作成中にエラーが発生しました:', error);
            message.reply('バックアップの作成中にエラーが発生しました。');
        }
    } else if (command === 'load') {
        const backupName = args[0];
        const targetGuildId = args[1];

        if (!backupName || !targetGuildId) {
            return message.reply('バックアップ名と復元先のギルドIDを指定してください！');
        }

        try {
            const backupData = loadBackup(backupName);
            if (!backupData) {
                return message.reply(`指定された名前のバックアップが見つかりません: ${backupName}.json`);
            }

            const targetGuild = client.guilds.cache.get(targetGuildId);
            if (!targetGuild) {
                return message.reply(`指定されたギルドIDのサーバーが見つかりません: ${targetGuildId}`);
            }

            if (targetGuild.memberCount > targetGuild.members.cache.size) {
                await targetGuild.members.fetch();
            }

            const botMember = targetGuild.members.cache.get(client.user!.id);
            if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('ボットが対象のギルドで管理者権限を持っていません。');
            }

            message.reply(`${backupName}.json から ${targetGuild.name} にサーバーの状態を復元しています...`);
            await restoreBackup(targetGuild, backupData);
            message.reply(`${backupName}.json から ${targetGuild.name} へのサーバーの状態の復元が完了しました！`);
        } catch (error) {
            console.error('バックアップの読み込みまたは復元中にエラーが発生しました:', error);
            message.reply('バックアップの読み込みまたは復元中にエラーが発生しました。');
        }
    }
});

async function createBackup(guild: Guild): Promise<BackupData> {
    const data: BackupData = {
        timestamp: Date.now(),
        name: guild.name,
        icon: guild.iconURL(),
        preferredLocale: guild.preferredLocale,
        afkTimeout: guild.afkTimeout,
        afkChannel: guild.afkChannelId,
        systemChannel: guild.systemChannelId,
        systemChannelFlags: guild.systemChannelFlags.bitfield,
        rulesChannel: guild.rulesChannelId,
        publicUpdatesChannel: guild.publicUpdatesChannelId,
        verificationLevel: guild.verificationLevel,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        explicitContentFilter: guild.explicitContentFilter,
        roles: guild.roles.cache.map((role) => ({
            id: role.id,
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            position: role.position,
            permissions: role.permissions.bitfield,
            mentionable: role.mentionable,
        })),
        channels: guild.channels.cache.map((channel) => ({
            id: channel.id,
            type: channel.type,
            name: channel.name,
            ...(channel.type === ChannelType.GuildCategory && {
                children: (channel as any).children.cache.map((child: any) => child.id),
            }),
            ...(channel.type === ChannelType.GuildText && {
                topic: (channel as TextChannel).topic || undefined,
                nsfw: (channel as TextChannel).nsfw,
                rateLimitPerUser: (channel as TextChannel).rateLimitPerUser,
                parentId: channel.parentId,
            }),
            ...(channel.type === ChannelType.GuildVoice && {
                bitrate: (channel as VoiceChannel).bitrate,
                userLimit: (channel as VoiceChannel).userLimit,
                parentId: channel.parentId,
                rtcRegion: (channel as VoiceChannel).rtcRegion,
            }),
        })),
        emojis: guild.emojis.cache.map((emoji) => ({
            id: emoji.id,
            name: emoji.name || '',
            animated: emoji.animated!,
            url: emoji.url,
        })),
        members: await (async () => {
            await guild.members.fetch();
            return guild.members.cache.map((member) => ({
                id: member.id,
                nickname: member.nickname,
                roles: member.roles.cache.map((role) => role.id),
                joinedAt: member.joinedTimestamp!,
            }));
        })(),
    };

    return data;
}

function saveBackup(name: string, data: BackupData): void {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(`./backups/${name}.json`, jsonData);
}

function loadBackup(name: string): BackupData | null {
    try {
        const jsonData = fs.readFileSync(`./backups/${name}.json`, 'utf8');
        return JSON.parse(jsonData) as BackupData;
    } catch (error) {
        console.error(`バックアップファイル ${name}.json の読み込みに失敗しました:`, error);
        return null;
    }
}

async function restoreBackup(guild: Guild, data: BackupData): Promise<void> {
    await guild.setName(data.name);
    if (data.icon) {
        await guild.setIcon(data.icon);
    }
    if (data.preferredLocale) {
        await guild.setPreferredLocale(data.preferredLocale as Locale);
    }
    await guild.setAFKTimeout(data.afkTimeout);
    await guild.setVerificationLevel(data.verificationLevel);
    await guild.setDefaultMessageNotifications(data.defaultMessageNotifications);
    await guild.setExplicitContentFilter(data.explicitContentFilter);

    const existingRoles = guild.roles.cache;
    const existingChannels = guild.channels.cache;
    const existingEmojis = guild.emojis.cache;

    for (const roleData of data.roles) {
        const existingRole = existingRoles.find(r => r.name === roleData.name);

        if (existingRole) {
            await existingRole.edit({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                permissions: roleData.permissions,
                mentionable: roleData.mentionable,
            });
        } else {
            await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                permissions: roleData.permissions,
                mentionable: roleData.mentionable,
            });
        }
    }

    for (const existingRole of existingRoles.values()) {
        if (!data.roles.some(roleData => roleData.name === existingRole.name) && existingRole.name !== '@everyone') {
            await existingRole.delete();
        }
    }

    const channelPromises: Promise<void>[] = [];
    for (const channelData of data.channels) {
        if (channelData.type === ChannelType.GuildCategory) {
            channelPromises.push(restoreChannel(guild, channelData, existingChannels, data));
        }
    }
    await Promise.all(channelPromises);

    for (const channelData of data.channels) {
        if (channelData.type !== ChannelType.GuildCategory) {
            await restoreChannel(guild, channelData, existingChannels, data);
        }
    }

    for (const existingChannel of existingChannels.values()) {
        if (!data.channels.some(channelData => channelData.name === existingChannel.name)) {
            await existingChannel.delete();
        }
    }

    for (const emojiData of data.emojis) {
        const existingEmoji = existingEmojis.find(e => e.name === emojiData.name);
        if (!existingEmoji) {
            await guild.emojis.create({ attachment: emojiData.url, name: emojiData.name });
        }
    }

    for (const existingEmoji of existingEmojis.values()) {
        if (!data.emojis.some(emojiData => emojiData.name === existingEmoji.name)) {
            await existingEmoji.delete();
        }
    }

    for (const memberData of data.members) {
        const member = await guild.members.fetch(memberData.id).catch(() => null);
        if (member) {
            const rolesToAdd = memberData.roles
                .map(roleId => guild.roles.cache.find(role => role.name === data.roles.find(r => r.id === roleId)?.name))
                .filter((role): role is NonNullable<typeof role> => role !== undefined);
            await member.roles.add(rolesToAdd);
        }
    }
    console.log('サーバーの復元が完了しました。');
}

async function restoreChannel(guild: Guild, channelData: ChannelData, existingChannels: Map<Snowflake, any>, backupData: BackupData): Promise<void> {
    const existingChannel = Array.from(existingChannels.values()).find(c => c.name === channelData.name && c.type === channelData.type);

    if (existingChannel) {
        await existingChannel.edit({
            name: channelData.name,
            topic: channelData.topic,
            nsfw: channelData.nsfw,
            rateLimitPerUser: channelData.rateLimitPerUser,
            bitrate: channelData.bitrate,
            userLimit: channelData.userLimit,
            rtcRegion: channelData.rtcRegion,
            parent: channelData.parentId ? guild.channels.cache.find(c => c.name === backupData.channels.find(cd => cd.id === channelData.parentId)?.name && c.type === ChannelType.GuildCategory) as CategoryChannelResolvable | undefined : undefined,
        });
    } else {
        await guild.channels.create({
            name: channelData.name,
            type: channelData.type as ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory | ChannelType.GuildAnnouncement | ChannelType.GuildStageVoice | ChannelType.GuildDirectory | ChannelType.GuildForum | ChannelType.GuildMedia,
            topic: channelData.topic,
            nsfw: channelData.nsfw,
            rateLimitPerUser: channelData.rateLimitPerUser,
            bitrate: channelData.bitrate,
            userLimit: channelData.userLimit,
            rtcRegion: channelData.rtcRegion || undefined,
            parent: channelData.parentId ? guild.channels.cache.find(c => c.name === backupData.channels.find(cd => cd.id === channelData.parentId)?.name && c.type === ChannelType.GuildCategory) as CategoryChannelResolvable || undefined : undefined,
        });
    }
}

client.login('MTE5Njc2OTM1NDQzNjU3NTMyMw.GBkyLL.psnqRlPEWjmr7ER9MZ7Wr79QIlNSXPQey7uGUk');