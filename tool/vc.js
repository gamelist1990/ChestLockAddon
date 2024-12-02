// vc.js
import { ChannelType } from 'discord.js';
import { server, WorldPlayer, minecraftPlayerDiscordIds } from './ws.js'

let guild;
let categoryId;
let lobbyVcId;
let groupChannels = new Map();


export function initVcFunctions(discordGuild, categoryIdParam, lobbyVcIdParam) { // 初期化関数
    guild = discordGuild;
    categoryId = categoryIdParam;
    lobbyVcId = lobbyVcIdParam;
}



export async function updateVoiceChannels() {
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
        if (!lobbyChannel) {
            return;
        }

        const proximityGroups = createProximityGroups(playersByDiscordId);

        // 既存のグループVCへの移動 (修正)
        for (const [groupNumber, members] of proximityGroups) {
            const proximityVc = await getOrCreateProximityVc(groupNumber);
            if (!proximityVc) continue;

            for (const member of members) {
                try {
                    if (member.voice.channel?.id !== proximityVc.id) { // nullチェックを追加
                        await member.voice.setChannel(proximityVc);
                        await member.voice.setMute(false);
                    }
                } catch (error) {
                    console.error(`Member ${member.displayName} の状態変更エラー:`, error.stack);
                }
            }
        }

        // ロビー移動処理
        const inProximityGroups = [...proximityGroups.values()].flat();
        for (const member of guild.members.cache.filter(m => m.voice.channel && !inProximityGroups.includes(m) && playersByDiscordId[m.id]).values()) {
            try {
                if (member.voice.channel.id !== lobbyChannel.id) {
                    await member.voice.setChannel(lobbyChannel);
                    await member.voice.setMute(true);
                }
            } catch (error) {
                console.error(`メンバー ${member.displayName} の移動に失敗:`, error.stack);
            }
        }


        // 不要なVCの削除
        await deleteUnusedVcs(proximityGroups);

    } catch (error) {
        console.error("updateVoiceChannels でエラーが発生しました:", error);
    }
}


async function fetchPlayerData() {
    const playersByDiscordId = {};
    const promises = [];

    for (const uuid in minecraftPlayerDiscordIds) {
        const promise = WorldPlayer(minecraftPlayerDiscordIds[uuid].name)
            .then(playerData => {
                if (playerData) {
                    playersByDiscordId[minecraftPlayerDiscordIds[uuid].discordId] = { ...playerData, uniqueId: uuid };
                }
            })
            .catch(error => {
                console.error(`Minecraftプレイヤーデータ取得エラー(${minecraftPlayerDiscordIds[uuid].name}):`, error);
            });
        promises.push(promise);
    }

    await Promise.all(promises); // 全てのプレイヤーデータ取得が完了するのを待つ
    return playersByDiscordId;
}



function createProximityGroups(playersByDiscordId) {
    const proximityGroups = new Map();
    const DISTANCE_THRESHOLD = 10;
    let groupNumber = 1;

    for (const discordId in playersByDiscordId) {
        const member = guild.members.cache.get(discordId);
        if (!member || !member.voice.channel) continue;

        let assigned = false;
        for (const [existingGroupNumber, existingMembers] of proximityGroups) {
            for (const existingMember of existingMembers) {
                const distance = calculateDistance(playersByDiscordId[discordId].position, playersByDiscordId[existingMember.id].position);
                if (distance <= DISTANCE_THRESHOLD) {
                    proximityGroups.get(existingGroupNumber).push(member);
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



async function getOrCreateProximityVc(groupNumber) {
    try {
        let existingVc = groupChannels.get(groupNumber);

        if (!existingVc) {
            existingVc = guild.channels.cache.find(channel => channel.name === `Group${groupNumber} VC` && channel.type === ChannelType.GuildVoice && channel.parentId === categoryId);
            if (existingVc) {
                groupChannels.set(groupNumber, existingVc.id);
            }
        } else {
            existingVc = guild.channels.cache.get(existingVc);
        }

        if (!existingVc) {
            existingVc = await guild.channels.create({
                name: `Group${groupNumber} VC`,
                type: ChannelType.GuildVoice,
                parent: categoryId,
            });
            groupChannels.set(groupNumber, existingVc.id);
        }

        return existingVc;

    } catch (error) {
        console.error("近接VCの作成/取得エラー:", error);
        return null;
    }
}





async function deleteUnusedVcs(proximityGroups) {
    const category = guild.channels.cache.get(categoryId);
    if (!category) return;

    const usedGroupVcs = [...proximityGroups.values()].map(members => members[0].voice?.channel).filter(vc => vc !== null && vc !== undefined);
    const allGroupVcs = category.children.cache.filter(c => c.name.startsWith('Group') && c.type === ChannelType.GuildVoice);

    const unusedGroupVcs = allGroupVcs.filter(vc => !usedGroupVcs.includes(vc));
    for (const vc of unusedGroupVcs.values()) {
        try {
            await vc.delete();
            groupChannels.delete([...groupChannels].find(([_, val]) => val === vc.id)?.[0]); // groupChannelsからも削除
        } catch (error) {
            console.error(`VC ${vc.name} の削除エラー:`, error);
        }
    }
}




function calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz));
}
