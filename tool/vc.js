// vc.js
import { ChannelType } from 'discord.js';
import { server, WorldPlayer, minecraftPlayerDiscordIds } from './ws.js'

let guild;
let categoryId;
let lobbyVcId;
let groupChannels = new Map();
const membersToMove = [];


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

        const playersByDiscordId = {};
        for (const uuid in minecraftPlayerDiscordIds) {
            try {
                const playerData = await WorldPlayer(minecraftPlayerDiscordIds[uuid].name);
                if (playerData) {
                    playersByDiscordId[minecraftPlayerDiscordIds[uuid].discordId] = { ...playerData, uniqueId: uuid };
                } else {
                  //  console.warn(`Minecraftプレイヤーデータ取得失敗: ${minecraftPlayerDiscordIds[uuid].name}`);
                }
            } catch (error) {
              //  console.error(`Minecraftプレイヤーデータ取得エラー(${minecraftPlayerDiscordIds[uuid].name}):`, error.stack);
            }
        }

        if (!guild) {
            return;
        }

        const lobbyChannel = guild.channels.cache.get(lobbyVcId);
        if (!lobbyChannel) {
            return;
        }

        const proximityGroups = new Map();
        const DISTANCE_THRESHOLD = 10;

        membersToMove.length = 0;

        for (const uuid in minecraftPlayerDiscordIds) {
            const discordId = minecraftPlayerDiscordIds[uuid].discordId;
            const member = guild.members.cache.get(discordId);

            if (playersByDiscordId[discordId] && member && member.voice.channel) {
                membersToMove.push(member);
              //  console.log(`membersToMove に ${member.user.tag} を追加`);
            }
        }

        if (membersToMove.length === 0) {
           // console.log("移動対象のメンバーが見つかりませんでした。");
            return;
        }


        for (const member of guild.members.cache.filter(m => m.voice.channel).values()) {
            const memberPlayer = playersByDiscordId[member.id];
            if (!memberPlayer) continue;

            const closeMembers = findCloseMembers(memberPlayer, playersByDiscordId, DISTANCE_THRESHOLD)
                .map(p => guild.members.cache.get(minecraftPlayerDiscordIds[p.uniqueId].discordId))
                .filter(m => m !== null && m.id !== member.id);

            if (closeMembers.length > 0) {
                const closestMember = closeMembers[0];

                const groupKey = [member.id, closestMember.id].sort().join(',');

                if (!proximityGroups.has(groupKey)) {
                    proximityGroups.set(groupKey, [member, closestMember]);
                }
            }
        }

        for (let i = 0; i < proximityGroups.size; i++) {
            const [_key, members] = Array.from(proximityGroups)[i];
            const groupNumber = i + 1;

            const proximityVc = await createProximityVc(members, groupNumber);
            if (!proximityVc) continue;

            for (const member of members) {
                try {
                    if (member.voice.channel.id !== proximityVc.id) {
                        await member.voice.setChannel(proximityVc);
                        await member.voice.setMute(false);
                    }
                } catch (error) {
                    console.error(`Member ${member.displayName} の状態変更エラー:`, error.stack);
                }
            }
        }


        // ロビー移動処理 (修正 - 近接VC割り当て処理の後で実行)
        for (const member of guild.members.cache.filter(m => m.voice.channel && ![...proximityGroups.values()].flat().includes(m) && membersToMove.includes(m)).values()) {
            try {
                if (member.voice.channel.id !== lobbyChannel.id) {
                    await member.voice.setChannel(lobbyChannel);
                    await member.voice.setMute(true);
                    //console.log(`メンバー ${member.displayName} をロビーへ移動`);
                }
            } catch (error) {
                console.error(`メンバー ${member.displayName} の移動に失敗:`, error.stack);
            }
        }


        const category = guild.channels.cache.get(categoryId);
        if (category) {
            const allGroupVcs = category.children.cache.filter(c => c.name.startsWith('Group') && c.type === ChannelType.GuildVoice);
            const usedGroupVcs = [...proximityGroups.values()].map(members => members[0].voice?.channel).filter(vc => vc !== null && vc !== undefined);

            const unusedGroupVcs = allGroupVcs.filter(vc => !usedGroupVcs.includes(vc));
            for (const vc of unusedGroupVcs.values()) {
                try {
                    await vc.delete();
                } catch (error) {
                    console.error(`VC ${vc.name} の削除エラー:`, error);
                }
            }
        }
    } catch (error) {
        console.error("updateVoiceChannels でエラーが発生しました:", error);
    }
}

async function createProximityVc(members, groupNumber) {
    try {
        let existingVc = groupChannels.get(groupNumber); // IDから取得を試みる

        if (!existingVc) {
            // IDがgroupChannelsにない場合のみ、名前で検索を行う (初回のみ)
            existingVc = guild.channels.cache.find(channel => channel.name === `Group${groupNumber} VC` && channel.type === ChannelType.GuildVoice && channel.parentId === categoryId);
            if (existingVc) {
                groupChannels.set(groupNumber, existingVc.id); // IDを保存
            }

        } else {
            // IDからキャッシュに存在するか確認
            existingVc = guild.channels.cache.get(existingVc);
        }


        if (!existingVc) {
            existingVc = await guild.channels.create({
                name: `Group${groupNumber} VC`,
                type: ChannelType.GuildVoice,
                parent: categoryId,
            });
            groupChannels.set(groupNumber, existingVc.id); // IDを保存
        }


        return existingVc;
    } catch (error) {
        // console.error("近接VCの作成エラー:", error);
        return null;
    }
}


function calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz));
}

function findCloseMembers(player, playersByDiscordId, distanceThreshold) {
    const closeMembers = [];
    for (const discordId in playersByDiscordId) {
        if (playersByDiscordId[discordId] === undefined) {
            console.log("playersByDiscordIdにデータがない");
        }

        if (discordId === minecraftPlayerDiscordIds[player.uniqueId].discordId) continue; // 自分自身は除外


        const otherPlayer = playersByDiscordId[discordId];
        const distance = calculateDistance(player.position, otherPlayer.position);

        if (distance <= distanceThreshold) {
            closeMembers.push(otherPlayer);
        }
    }
    return closeMembers;
}
