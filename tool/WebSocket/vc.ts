import { ChannelType, GuildMember, VoiceChannel } from 'discord.js';
import { server, WorldPlayer, minecraftPlayerDiscordIds } from './index';

let guild;
let categoryId: string;
let lobbyVcId: string;
const groupChannels = new Map<number, string>();

export function initVcFunctions(discordGuild, categoryIdParam: string, lobbyVcIdParam: string): void {
    guild = discordGuild;
    categoryId = categoryIdParam;
    lobbyVcId = lobbyVcIdParam;
}

export async function updateVoiceChannels(): Promise<void> {
    try {
        const world = server.getWorlds()[0];
        if (!world) {
            return;
        }

        const playersByDiscordId = await fetchPlayerData();

        if (!guild) {
            return;
        }

        const lobbyChannel = guild.channels.cache.get(lobbyVcId);
        if (!lobbyChannel || !lobbyChannel.isVoiceBased()) { // 型ガードを追加
            return;
        }

        const proximityGroups = createProximityGroups(playersByDiscordId);

        // 既存のグループVCへの移動
        for (const [groupNumber, members] of proximityGroups) {
            const proximityVc = await getOrCreateProximityVc(groupNumber);
            if (!proximityVc) continue;

            for (const member of members) {
                try {
                    if (member.voice.channel?.id !== proximityVc.id) {
                        await member.voice.setChannel(proximityVc);
                        await member.voice.setMute(false);
                    }
                } catch (error) {
                    console.error(`Member ${member.displayName} の状態変更エラー:`, error);
                }
            }
        }

        // ロビー移動処理
        const inProximityGroups = [...proximityGroups.values()].flat();
        for (const member of guild.members.cache.filter((m) => m.voice.channel && !inProximityGroups.includes(m) && playersByDiscordId[m.id]).values()) {
            try {
                if (member.voice.channel.id !== lobbyChannel.id) {
                    await member.voice.setChannel(lobbyChannel);
                    await member.voice.setMute(true);
                }
            } catch (error) {
                console.error(`メンバー ${member.displayName} の移動に失敗:`, error);
            }
        }

        // 不要なVCの削除
        await deleteUnusedVcs(proximityGroups);
    } catch (error) {
        console.error("updateVoiceChannels でエラーが発生しました:", error);
    }
}

async function fetchPlayerData(): Promise<{ [discordId: string]: any }> {
    const playersByDiscordId: { [discordId: string]: any } = {};

    await Promise.all(
        Object.entries(minecraftPlayerDiscordIds).map(async ([uuid, { name }]) => {
            try {
                const playerData = await WorldPlayer(name);
                if (playerData) {
                    playersByDiscordId[minecraftPlayerDiscordIds[uuid].discordId] = { ...playerData, uniqueId: uuid };
                }
            } catch (error) {
                console.error(`Minecraftプレイヤーデータ取得エラー(${name}):`, error);
            }
        })
    );

    return playersByDiscordId;
}

function createProximityGroups(playersByDiscordId: { [discordId: string]: any }): Map<number, GuildMember[]> {
    const proximityGroups = new Map<number, GuildMember[]>();
    const DISTANCE_THRESHOLD = 10;
    let groupNumber = 1;

    for (const discordId in playersByDiscordId) {
        const member = guild.members.cache.get(discordId);
        if (!member || !member.voice.channel) continue;

        let assigned = false;
        for (const [existingGroupNumber, existingMembers] of proximityGroups) {
            for (const existingMember of existingMembers) {
                const distance = calculateDistance(playersByDiscordId[discordId].position, playersByDiscordId[existingMember.id]?.position); //nullチェックを追加
                if (distance <= DISTANCE_THRESHOLD) {
                    proximityGroups.get(existingGroupNumber)!.push(member);
                    assigned = true;
                    break;
                }
            }
            if (assigned) break;
        }

        if (!assigned) {
            proximityGroups.set(groupNumber++, [member]);
        }
    }
    return proximityGroups;
}

async function getOrCreateProximityVc(groupNumber: number): Promise<VoiceChannel | null> {
    try {
        let existingVc: VoiceChannel | undefined;
        const existingVcId = groupChannels.get(groupNumber);
        if (existingVcId) {
            existingVc = guild.channels.cache.get(existingVcId) as VoiceChannel | undefined;
        }


        if (!existingVc) {
            existingVc = guild.channels.cache.find(
                (channel:any) => channel.name === `Group${groupNumber} VC` && channel.type === ChannelType.GuildVoice && channel.parentId === categoryId
            ) as VoiceChannel | undefined;
        }



        if (!existingVc) {
            existingVc = await guild.channels.create({
                name: `Group${groupNumber} VC`,
                type: ChannelType.GuildVoice,
                parent: categoryId,
            }) as VoiceChannel; //型アサーションを追加
            groupChannels.set(groupNumber, existingVc.id);
        }

        return existingVc;
    } catch (error) {
        console.error("近接VCの作成/取得エラー:", error);
        return null;
    }
}

async function deleteUnusedVcs(proximityGroups: Map<number, GuildMember[]>): Promise<void> {
    const category = guild.channels.cache.get(categoryId);
    if (!category) return;


    const usedGroupVcs = [...proximityGroups.values()]
        .map((members) => members[0].voice?.channel)
        .filter((vc) => vc !== null && vc !== undefined) as VoiceChannel[]; //nullチェックと型アサーションを追加

    const allGroupVcs = category.children.cache.filter((c) => c.name.startsWith('Group') && c.type === ChannelType.GuildVoice);

    const unusedGroupVcs = allGroupVcs.filter((vc) => !usedGroupVcs.includes(vc as VoiceChannel)); //型アサーションを追加
    for (const vc of unusedGroupVcs.values()) {
        try {

            await vc.delete();
            for (const [key, value] of groupChannels.entries()) {
                if (value === vc.id) {
                    groupChannels.delete(key);
                    break;
                }
            }


        } catch (error) {
            console.error(`VC ${vc.name} の削除エラー:`, error);
        }
    }
}

function calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number } | undefined | null): number { //型定義を追加
    if (!pos2) return 0; //pos2がnullまたはundefinedの場合は0を返す

    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz));
}