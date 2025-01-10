import { Client, GatewayIntentBits, Guild, PermissionsBitField, Snowflake, TextChannel, VoiceChannel, ChannelType, Locale, CategoryChannelResolvable, Role, GuildChannel, Collection, CategoryChannel } from 'discord.js';
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
    position: number;
    rawPosition: number;
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
        GatewayIntentBits.MessageContent,
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

    // オーナーIDをここに設定
    const OWNER_ID = '735854461636837389';

    // オーナー以外はコマンドを使用できないようにする
    if (message.author.id !== OWNER_ID) {
        if (command === 'save' || command === 'load' || command === 'sort') {
            return message.reply('このコマンドはオーナーのみ使用できます。');
        }
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
        if (!backupName) {
            return message.reply('バックアップ名を指定してください！');
        }

        try {
            const backupData = loadBackup(backupName);
            if (!backupData) {
                return message.reply(`指定された名前のバックアップが見つかりません: ${backupName}.json`);
            }

            const targetGuild = message.guild;

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
    } else if (command === 'sort') {
        const backupName = args[0];
        if (!backupName) {
            return message.reply('バックアップ名を指定してください！');
        }

        const backupData = loadBackup(backupName);
        if (!backupData) {
            return message.reply(`指定された名前のバックアップが見つかりません: ${backupName}.json`);
        }

        try {
            await sortChannels(message.guild, backupData);
            message.reply(`チャンネル/カテゴリーの並び替えが完了しました！`);
        } catch (error) {
            console.error('チャンネル/カテゴリーの並び替え中にエラーが発生しました:', error);
            message.reply('チャンネル/カテゴリーの並び替え中にエラーが発生しました。');
        }
    }
});

async function createBackup(guild: Guild): Promise<BackupData> {
    // カテゴリーとそれ以外のチャンネルを分離
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    const nonCategoryChannels = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory);

    // カテゴリーごとにチャンネルを整理
    const categorizedChannels: Collection<Snowflake, ChannelData[]> = new Collection();
    categories.forEach(category => {
        const categoryId = category.id;
        const children = guild.channels.cache
            .filter(c => c.parentId === categoryId)
            .filter(channel => 'position' in channel)
            .sort((a, b) => (a as GuildChannel).position - (b as GuildChannel).position)
            .map(channel => ({
                id: channel.id,
                type: channel.type,
                name: channel.name,
                position: 'position' in channel ? channel.position : 0,
                rawPosition: 'rawPosition' in channel ? channel.rawPosition : 0,
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
            }));
        categorizedChannels.set(categoryId, children);
    });

    // カテゴリー化されていないチャンネルのデータを取得
    const uncategorizedChannels = nonCategoryChannels
        .filter(channel => 'position' in channel)
        .sort((a, b) => (a as GuildChannel).position - (b as GuildChannel).position)
        .map(channel => ({
            id: channel.id,
            type: channel.type,
            name: channel.name,
            position: 'position' in channel ? channel.position : 0,
            rawPosition: 'rawPosition' in channel ? channel.rawPosition : 0, // その他のチャンネル
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
        }));

    // カテゴリーのデータを取得し、対応するチャンネルデータを結合
    const categoryData = categories
        .sort((a, b) => a.position - b.position)
        .map(category => ({
            id: category.id,
            type: category.type,
            name: category.name,
            position: category.position,
            rawPosition: 'rawPosition' in category ? category.rawPosition : 0,
            children: categorizedChannels.get(category.id) || [],
        }));

    // カテゴリーデータとカテゴリー化されていないチャンネルデータを結合して、最終的なチャンネルデータを作成
    const channels = [...categoryData, ...uncategorizedChannels];

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
        channels: channels, // 更新された channels 配列を使用
        emojis: guild.emojis.cache.map((emoji) => ({
            id: emoji.id,
            name: emoji.name || '',
            animated: emoji.animated!,
            url: emoji.imageURL(),
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
    const backupsDir = './backups';
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir);
    }

    const jsonData = JSON.stringify(data, (key, value) => {
        return typeof value === 'bigint' ? value.toString() : value;
    }, 2);

    fs.writeFileSync(`${backupsDir}/${name}.json`, jsonData);
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

    const excludedRoleIds: string[] = [];

    const restoreRoles = async () => {
        const uniqueRoles = data.roles.reduce((acc, role) => {
            acc[role.name] = role;
            return acc;
        }, {} as { [key: string]: RoleData });

        const rolePromises = Object.values(uniqueRoles).map(async (roleData) => {
            if (roleData.name === '@everyone') {
                console.warn('Skipping @everyone role');
                return;
            }

            const existingRole = existingRoles.find(r => r.name === roleData.name);

            if (
                roleData.permissions.toString().includes('8') ||
                guild.members.cache.get(client.user!.id)?.roles.cache.some(r => r.name === roleData.name) ||
                existingRole?.managed ||
                excludedRoleIds.includes(roleData.id)
            ) {
                console.warn(`Skipping role ${roleData.name} (ID: ${roleData.id})`);
                return;
            }

            try {
                if (existingRole) {
                    console.log(`Editing role: ${existingRole.name} (ID: ${existingRole.id})`);
                    await existingRole.edit({
                        name: roleData.name,
                        color: roleData.color,
                        hoist: roleData.hoist,
                        permissions: roleData.permissions,
                        mentionable: roleData.mentionable,
                    });
                    console.log(`Successfully edited role: ${existingRole.name}`);
                } else {
                    console.log(`Creating role: ${roleData.name} (ID: ${roleData.id})`);
                    const newRole = await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color,
                        hoist: roleData.hoist,
                        permissions: roleData.permissions,
                        mentionable: roleData.mentionable,
                    });
                    console.log(`Successfully created role: ${newRole.name}`);
                }
            } catch (error) {
                console.error(`Error processing role: ${roleData.name} (ID: ${roleData.id})`, error);
                excludedRoleIds.push(roleData.id);
                console.warn(`Role ${roleData.name} (ID: ${roleData.id}) will be excluded from further processing.`);
            }
        });

        await Promise.all(rolePromises);

        for (const existingRole of existingRoles.values()) {
            if (
                existingRole.name === '@everyone' ||
                data.roles.some(roleData => roleData.name === existingRole.name) ||
                excludedRoleIds.includes(existingRole.id) ||
                existingRole.managed
            ) {
                continue;
            }
            try {
                await existingRole.delete();
                console.log(`Deleted role: ${existingRole.name} (ID: ${existingRole.id})`);
            } catch (error) {
                console.error(`Error deleting role: ${existingRole.name} (ID: ${existingRole.id})`, error);
            }
        }
    };

    const restoreChannels = async () => {
        const deletePromises = existingChannels.map(async (existingChannel) => {
            if (!data.channels.some(channelData => channelData.name === existingChannel.name)) {
                try {
                    await existingChannel.delete();
                    console.log(`Deleted channel: ${existingChannel.name} (ID: ${existingChannel.id})`);
                } catch (error) {
                    console.error(`Error deleting channel: ${existingChannel.name} (ID: ${existingChannel.id})`, error);
                }
            }
        });
        await Promise.all(deletePromises);

        const sortedChannels = data.channels.sort((a, b) => a.rawPosition - b.rawPosition);

        const updatePositionPromises = sortedChannels.map(async (channelData) => {
            const channel = guild.channels.cache.find(c => c.name === channelData.name);
            if (channel) {
                try {
                    // 親チャンネル（カテゴリー）がある場合、その中でのポジションを更新
                    if (channel.parent) {
                        await (channel as GuildChannel).setPosition(channelData.position, { relative: true });
                        console.log(`Updated relative position of channel: ${channel.name} to ${channelData.position} within category ${channel.parent.name}`);
                    } else {
                        await (channel as GuildChannel).setPosition(channelData.rawPosition);
                        console.log(`Updated raw position of channel: ${channel.name} to ${channelData.rawPosition}`);
                    }
                } catch (error) {
                    console.error(`Error updating position of channel: ${channel.name}`, error);
                }
            }
        });

        const channelPromises = sortedChannels
            .map(channelData => restoreChannel(guild, channelData, existingChannels, data));

        await Promise.all([...channelPromises, ...updatePositionPromises]);
    };

    const restoreEmojis = async () => {
        const emojiPromises = data.emojis.map(async (emojiData) => {
            const existingEmoji = existingEmojis.find(e => e.name === emojiData.name);
            if (!existingEmoji) {
                try {
                    console.log(`Creating emoji: ${emojiData.name}`);
                    await guild.emojis.create({ attachment: emojiData.url, name: emojiData.name });
                    console.log(`Successfully created emoji: ${emojiData.name}`);
                } catch (error) {
                    console.error(`Error creating emoji: ${emojiData.name}`, error);
                }
            }
        });

        await Promise.all(emojiPromises);

        const deleteEmojiPromises = Array.from(existingEmojis.values()).map(async (existingEmoji) => {
            if (!data.emojis.some(emojiData => emojiData.name === existingEmoji.name)) {
                try {
                    await existingEmoji.delete();
                    console.log(`Deleted emoji: ${existingEmoji.name}`);
                } catch (error) {
                    console.error(`Error deleting emoji: ${existingEmoji.name}`, error);
                }
            }
        });

        await Promise.all(deleteEmojiPromises);
    };

    const restoreMemberRoles = async () => {
        const memberPromises = data.members.map(async (memberData) => {
            console.log(`Processing member: ${memberData.id}`);
            const member = await guild.members.fetch(memberData.id).catch(() => null);
            if (member) {
                const rolesToAddPromises = memberData.roles
                    .map(async (roleId): Promise<Role | null> => {
                        if (excludedRoleIds.includes(roleId)) {
                            console.warn(`Skipping role assignment for ${roleId} to member ${memberData.id} as it's in the exclusion list.`);
                            return null;
                        }
                        const role = guild.roles.cache.find(role => role.name === data.roles.find(r => r.id === roleId)?.name);
                        if (role) {
                            return role;
                        } else {
                            console.warn(`Role not found: ${roleId}`);
                            return null;
                        }
                    });

                const rolesToAdd = await Promise.all(rolesToAddPromises);
                const validRolesToAdd = rolesToAdd.filter((role): role is Role => role !== null);

                console.log(`Adding roles to member ${member.user.tag}: ${validRolesToAdd.map(r => r.name).join(', ')}`);
                try {
                    await member.roles.add(validRolesToAdd);
                } catch (error) {
                    console.error(`Error adding roles to member ${member.user.tag}`, error);
                }
            }
        });

        await Promise.all(memberPromises);
    };

    await Promise.all([restoreRoles(), restoreChannels(), restoreEmojis(), restoreMemberRoles()]);

    console.log('サーバーの復元が完了しました。');
};

async function restoreChannel(guild: Guild, channelData: ChannelData, existingChannels: Collection<Snowflake, any>, backupData: BackupData): Promise<void> {
    let existingChannel: any;
    existingChannels.forEach(ch => {
        if (ch.name === channelData.name) {
            existingChannel = ch;
        }
    });

    if (existingChannel) {
        console.log(`Editing channel: ${existingChannel.name} (ID: ${existingChannel.id})`);

        const commonOptions = {
            name: channelData.name,
            parent: channelData.parentId ? guild.channels.cache.find(c => c.name === backupData.channels.find(cd => cd.id === channelData.parentId)?.name && c.type === ChannelType.GuildCategory) as CategoryChannelResolvable | undefined : undefined,
        };

        switch (existingChannel.type) {
            case ChannelType.GuildText:
                await existingChannel.edit({
                    ...commonOptions,
                    topic: channelData.topic,
                    nsfw: channelData.nsfw,
                    rateLimitPerUser: channelData.rateLimitPerUser,
                });
                break;
            case ChannelType.GuildVoice:
                await existingChannel.edit({
                    ...commonOptions,
                    bitrate: channelData.bitrate,
                    userLimit: channelData.userLimit,
                    rtcRegion: channelData.rtcRegion,
                });
                break;
            case ChannelType.GuildCategory:
                await existingChannel.edit(commonOptions);
                break;
            default:
                console.warn(`Unsupported channel type for editing: ${existingChannel.type}`);
        }
        console.log(`Successfully edited channel: ${existingChannel.name}`);

    } else {
        console.log(`Creating channel: ${channelData.name} (ID: ${channelData.id})`);

        const channelType = getChannelType(channelData.type);

        let createOptions: any;
        if (channelType === ChannelType.GuildText) {
            createOptions = {
                name: channelData.name,
                type: ChannelType.GuildText,
                topic: channelData.topic,
                nsfw: channelData.nsfw,
                rateLimitPerUser: channelData.rateLimitPerUser,
                parent: channelData.parentId ? guild.channels.cache.find(c => c.name === backupData.channels.find(cd => cd.id === channelData.parentId)?.name && c.type === ChannelType.GuildCategory) as CategoryChannelResolvable || undefined : undefined,
            };
        } else if (channelType === ChannelType.GuildVoice) {
            createOptions = {
                name: channelData.name,
                type: ChannelType.GuildVoice,
                bitrate: channelData.bitrate,
                userLimit: channelData.userLimit,
                rtcRegion: channelData.rtcRegion || undefined,
                parent: channelData.parentId ? guild.channels.cache.find(c => c.name === backupData.channels.find(cd => cd.id === channelData.parentId)?.name && c.type === ChannelType.GuildCategory) as CategoryChannelResolvable || undefined : undefined,
            };
        } else if (channelType === ChannelType.GuildCategory) {
            createOptions = {
                name: channelData.name,
                type: ChannelType.GuildCategory,
                parent: channelData.parentId ? guild.channels.cache.find(c => c.name === backupData.channels.find(cd => cd.id === channelData.parentId)?.name && c.type === ChannelType.GuildCategory) as CategoryChannelResolvable || undefined : undefined,
            };
        } else {
            console.error(`Invalid channel type: ${channelData.type} for channel: ${channelData.name}`);
            return;
        }

        try {
            await guild.channels.create(createOptions);
            console.log(`Successfully created channel: ${channelData.name}`);
        } catch (error) {
            console.error(`Error creating channel: ${channelData.name}`, error);
        }
    }
}

function getChannelType(type: number): ChannelType {
    switch (type) {
        case 0: return ChannelType.GuildText;
        case 2: return ChannelType.GuildVoice;
        case 4: return ChannelType.GuildCategory;
        case 5: return ChannelType.GuildAnnouncement;
        case 6: return ChannelType.GuildDirectory;
        case 13: return ChannelType.GuildStageVoice;
        case 14: return ChannelType.GuildForum;
        case 15: return ChannelType.GuildMedia;
        case 16: return ChannelType.PublicThread;
        default:
            console.error(`Unknown channel type: ${type}`);
            return ChannelType.GuildText;
    }
}

async function sortChannels(guild: Guild, backupData: BackupData): Promise<void> {
    // カテゴリを rawPosition でソート
    const sortedCategories = backupData.channels
        .filter(c => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.rawPosition - b.rawPosition);

    // カテゴリを移動
    for (const categoryData of sortedCategories) {
        const existingCategory = guild.channels.cache.find(c => c.name === categoryData.name);
        if (existingCategory) {
            try {
                await (existingCategory as CategoryChannel).setPosition(categoryData.rawPosition);
                console.log(`Updated raw position of category: ${existingCategory.name} to ${categoryData.rawPosition}`);
            } catch (error) {
                console.error(`Error updating raw position of category: ${existingCategory.name}`, error);
            }
        }
    }

    // カテゴリ内のチャンネルを position でソート
    const sortedChannels = backupData.channels
        .filter(c => c.type !== ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);

    // チャンネルを移動
    for (const channelData of sortedChannels) {
        const existingChannel = guild.channels.cache.find(c => c.name === channelData.name);
        if (existingChannel) {
            try {
                if (existingChannel.parent) {
                    // 親チャンネル（カテゴリー）がある場合、その中でのポジションを更新
                    const newPosition = channelData.position;
                    if (existingChannel.type === ChannelType.GuildText || existingChannel.type === ChannelType.GuildVoice) {
                        await existingChannel.setPosition(newPosition, { relative: true });
                    }
                    console.log(`Updated relative position of channel: ${existingChannel.name} to ${newPosition} within category ${existingChannel.parent.name}`);
                } else {
                    // 親チャンネルがない場合、rawPosition を更新
                    await (existingChannel as GuildChannel).setPosition(channelData.rawPosition);
                    console.log(`Updated raw position of channel: ${existingChannel.name} to ${channelData.rawPosition}`);
                }
            } catch (error) {
                console.error(`Error updating position of channel: ${existingChannel.name}`, error);
            }
        }
    }
}
client.login('');