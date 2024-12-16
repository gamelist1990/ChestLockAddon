import { world, Player, system } from '@minecraft/server';
import { registerCommand, verifier } from '../../Modules/Handler';
import { config, tempkick } from '../../Modules/Util';
import { translate } from '../langs/list/LanguageManager';
import { saveData, loadData, chestLockAddonData } from '../../Modules/DataBase';

interface BanPlayer {
    name?: string;
    id?: string;
    reason: string;
    duration?: number;
    banTime?: number;
    unban: 'true' | 'false';
}

interface BanList {
    banPlayers: BanPlayer[];
}

let banList: BanList = { banPlayers: [] };

// サーバー起動時にBANデータをロード
export function loadBan(): void {
    loadData();
    const data = chestLockAddonData.banList;
    if (data && typeof data === 'object') {
        banList = data;
    }
    checkAllBanned();
}
// サーバー起動時、または各プレイヤーのスポーン時に呼び出す
function checkAllBanned() {
    if (chestLockAddonData && chestLockAddonData.banlist && chestLockAddonData.banlist.banPlayers) {
        banList.banPlayers = chestLockAddonData.banlist.banPlayers;
        world.getAllPlayers().forEach((player) => {
            const playerXuid = player.id;
            banList.banPlayers.forEach((bannedPlayer, index) => {
                if (bannedPlayer.id === playerXuid || bannedPlayer.name === player.name) {
                    if (bannedPlayer.unban === 'true') {
                        banList.banPlayers.splice(index, 1);
                        saveData('banlist', banList);
                        return;
                    }
                    if (bannedPlayer.duration && bannedPlayer.banTime) {
                        const currentTime = Date.now();
                        const banEndTime = bannedPlayer.banTime + bannedPlayer.duration * 1000;
                        if (currentTime >= banEndTime) {
                            banList.banPlayers.splice(index, 1);
                            saveData('banlist', banList);
                            return;
                        } else {
                            if (bannedPlayer.unban === 'false') {
                                // durationがundefinedの場合は、通常BAN
                                if (bannedPlayer.duration === undefined) {
                                    ban(player, bannedPlayer.reason);
                                } else {
                                    const durationInHours = bannedPlayer.duration / 3600;
                                    if (durationInHours <= 5) {
                                        tempkick(player);
                                    } else {
                                        ban(player, bannedPlayer.reason, bannedPlayer.duration, bannedPlayer.banTime);
                                    }
                                }
                            }
                        }
                    } else {
                        if (bannedPlayer.unban === 'false') {
                            ban(player, bannedPlayer.reason);
                        }
                    }
                }
            });
        });
    }
}

registerCommand({
    name: 'ban',
    description: 'ban_docs',
    parent: false,
    maxArgs: 3,
    minArgs: 2,
    require: (player: Player) => verifier(player, config().commands['ban']),
    executor: (player: Player, args: string[]) => {
        const targetName = args[0];
        const reason = args[1];
        let duration: number | undefined = undefined;
        if (args[2]) {
            const timeMatch = args[2].match(/(\d+)([dhms])/);
            if (timeMatch) {
                const value = parseInt(timeMatch[1]);
                const unit = timeMatch[2];
                switch (unit) {
                    case 'd':
                        duration = value * 24 * 60 * 60;
                        break;
                    case 'h':
                        duration = value * 60 * 60;
                        break;
                    case 'm':
                        duration = value * 60;
                        break;
                    case 's':
                        duration = value;
                        break;
                    default:
                        duration = undefined;
                }
            } else {
                duration = parseInt(args[2]);
            }
        }

        const target = world.getAllPlayers().find((p) => p.name === targetName);

        if (!target) {
            player.sendMessage(translate(player, 'server.PlayerNotFound') + targetName);
            return;
        }
        banPlayer(player, target.name, target.id, reason, duration);
    },
});

registerCommand({
    name: 'unban',
    description: 'unban_docs',
    parent: false,
    maxArgs: 1,
    minArgs: 1,
    require: (player: Player) => verifier(player, config().commands['unban']),
    executor: (player: Player, args: string[]) => {
        const targetName = args[0];
        unbanPlayer(player, targetName);
    },
});

registerCommand({
    name: 'banlist',
    description: 'banlist_docs',
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['banlist']),
    executor: (player: Player) => {
        showBanList(player);
    },
});

function banPlayer(
    player: Player,
    targetName: string,
    targetId: string,
    reason: string,
    duration?: number,
) {
    let found = false;
    let targetPlayer: BanPlayer = { name: targetName, id: targetId, reason: reason, unban: 'false' };
    const target = world.getAllPlayers().find((p) => p.name === targetName);
    if (duration !== undefined) {
        targetPlayer.duration = duration;
        targetPlayer.banTime = Date.now();
    }

    const requiredTags = ['staff', 'op'];
    if (requiredTags.every((tag) => target?.hasTag(tag))) return;

    if (chestLockAddonData && chestLockAddonData.banlist && chestLockAddonData.banlist.banPlayers) {
        banList.banPlayers = chestLockAddonData.banlist.banPlayers;

        banList.banPlayers.forEach((playerBan) => {
            if (playerBan.name === targetPlayer.name || playerBan.id === targetPlayer.id) {
                player.sendMessage(translate(player, 'command.ban.alreadyBanned') + targetName);
                found = true;
                return;
            }
        });

        if (!found) {
            banList.banPlayers.push(targetPlayer);
            saveData('banlist', banList);
            player.sendMessage(
                translate(player, 'command.ban.banSuccess') +
                targetName +
                translate(player, 'command.ban.reason', { reason: reason }) +
                (duration
                    ? translate(player, 'command.ban.duration', {
                        duration: duration,
                        second: translate(player, 'command.ban.second'),
                    })
                    : translate(player, 'command.ban.noDuration')),
            );
            world.sendMessage(
                `§l§e[BAN] §c${targetName} §e is banned by §a${player.name} for §c${reason} ` +
                (duration ? `for ${duration} seconds` : 'with no end duration') +
                ` !`,
            );
            if (target) {
                // durationがundefinedの場合は、通常BAN
                if (duration === undefined) {
                    ban(target, reason);
                } else {
                    const durationInHours = duration / 3600;
                    if (durationInHours <= 5) {
                        try {
                            tempkick(player);
                        } catch (error: any) {
                            ban(target, reason, duration, Date.now());
                        }
                    } else {
                        ban(target, reason, duration, Date.now());
                    }
                }
            }
        }
    } else {
        banList.banPlayers.push(targetPlayer);
        saveData('banlist', banList);
        player.sendMessage(
            translate(player, 'command.ban.banSuccess') +
            targetName +
            translate(player, 'command.ban.reason', { reason: reason }) +
            (duration
                ? translate(player, 'command.ban.duration', {
                    duration: duration,
                    second: translate(player, 'command.ban.second'),
                })
                : translate(player, 'command.ban.noDuration')),
        );
        world.sendMessage(
            `§l§e[Ban] §c${targetName} §e is banned by §a${player.name} for §c${reason} ` +
            (duration ? `for ${duration} seconds` : 'with no end duration') +
            ` !`,
        );
        const target = world.getAllPlayers().find((p) => p.name === targetName);
        if (target) {
            // durationがundefinedの場合は、通常BAN
            if (duration === undefined) {
                ban(target, reason);
            } else {
                const durationInHours = duration / 3600;
                if (durationInHours <= 5) {
                    try {
                        tempkick(player);
                    } catch (error: any) {
                        ban(target, reason, duration, Date.now());
                    }
                } else {
                    ban(target, reason, duration, Date.now());
                }
            }
        }
    }
}

function unbanPlayer(player: Player, targetName: string) {
    if (chestLockAddonData && chestLockAddonData.banlist && chestLockAddonData.banlist.banPlayers) {
        banList.banPlayers = chestLockAddonData.banlist.banPlayers;
        let foundIndex = -1;
        let foundTarget: BanPlayer | undefined;

        banList.banPlayers.forEach((playerBan, index) => {
            if (playerBan.name === targetName || playerBan.id === targetName) {
                foundIndex = index;
                foundTarget = playerBan;
            }
        });

        if (foundIndex > -1) {
            if (foundTarget) {
                foundTarget.unban = 'true';
                saveData('banlist', banList);
                player.sendMessage(
                    translate(player, 'command.ban.unbanSuccess') + (foundTarget?.name || foundTarget?.id),
                );
                world.sendMessage(
                    `§l§6[UnBan] §a${foundTarget?.name || foundTarget?.id} §e is unbanned by §a${player.name} !`,
                );
                return;
            }
        } else {
            player.sendMessage(translate(player, 'command.ban.unbanNotFound'));
            return;
        }
    }
    player.sendMessage(translate(player, 'command.ban.unbanNotFound'));
}

function showBanList(player: Player) {
    if (chestLockAddonData && chestLockAddonData.banlist && chestLockAddonData.banlist.banPlayers) {
        banList.banPlayers = chestLockAddonData.banlist.banPlayers;
    }

    if (banList.banPlayers.length === 0) {
        player.sendMessage(translate(player, 'command.ban.noBanned'));
        return;
    }
    player.sendMessage('§l§e===== §6Ban List §e=====');
    banList.banPlayers.forEach((ban) => {
        if (ban.name !== undefined) {
            player.sendMessage(
                `§e- §c${ban.name} §eReason: §c${ban.reason} ` +
                (ban.duration ? `§eDuration:§c ${ban.duration}s` : '§eNo Duration') +
                (ban.unban == 'true' ? `§a Unban:true` : '§c Unban:false'),
            );
        } else {
            player.sendMessage(
                `§e- §c${ban.id} §eReason: §c${ban.reason}` +
                (ban.duration ? `§eDuration:§c ${ban.duration}s` : '§eNo Duration') +
                (ban.unban == 'true' ? `§a Unban:true` : '§c Unban:false'),
            );
        }
    });
    player.sendMessage('§l§e====================');
}

function ban(player: Player, reason: string, duration?: number, banTime?: number) {
    let kickMessage = translate(player, 'command.ban.bannedMessage') + `\n`;

    if (duration && banTime) {
        const timeLeft = Math.ceil((banTime + duration * 1000 - Date.now()) / 1000);
        kickMessage += translate(player, 'command.ban.reason', { reason: reason }) + `\n`;
        kickMessage += translate(player, 'command.ban.duration', {
            duration: timeLeft,
            second: translate(player, 'command.ban.second'),
        });
    } else {
        kickMessage +=
            translate(player, 'command.ban.reason', { reason: reason }) +
            `\n` +
            translate(player, 'command.ban.noDuration');
    }
    player.runCommand('kick ' + player.name + ' ' + kickMessage);
}

// 各プレイヤーのスポーン時にロードとチェック
world.afterEvents.playerSpawn.subscribe((event) => {
    const { player } = event;
    loadData();
    const data = chestLockAddonData.banList;
    if (data && typeof data === 'object') {
        banList = data;
    }
    system.runTimeout(() => {
        if (!player) return;

        if (chestLockAddonData && chestLockAddonData.banlist && chestLockAddonData.banlist.banPlayers) {
            banList.banPlayers = chestLockAddonData.banlist.banPlayers;
            const playerXuid = player.id;

            banList.banPlayers.forEach((bannedPlayer, index) => {
                if (bannedPlayer.id === playerXuid || bannedPlayer.name === player.name) {
                    if (bannedPlayer.unban === 'true') {
                        banList.banPlayers.splice(index, 1);
                        saveData('banlist', banList);
                        return;
                    }
                    if (bannedPlayer.duration && bannedPlayer.banTime) {
                        const currentTime = Date.now();
                        const banEndTime = bannedPlayer.banTime + bannedPlayer.duration * 1000;
                        if (currentTime >= banEndTime) {
                            banList.banPlayers.splice(index, 1);
                            saveData('banlist', banList);
                            return;
                        } else {
                            if (bannedPlayer.unban === 'false') {
                                // durationがundefinedの場合は、通常BAN
                                if (bannedPlayer.duration === undefined) {
                                    ban(player, bannedPlayer.reason);
                                } else {
                                    const durationInHours = bannedPlayer.duration / 3600;
                                    if (durationInHours <= 5) {
                                        try {
                                            tempkick(player);
                                        } catch (error: any) {
                                            ban(player, bannedPlayer.reason, bannedPlayer.duration, bannedPlayer.banTime);
                                        }
                                    } else {
                                        ban(player, bannedPlayer.reason, bannedPlayer.duration, bannedPlayer.banTime);
                                    }
                                }
                            }
                        }
                    } else {
                        if (bannedPlayer.unban === 'false') {
                            ban(player, bannedPlayer.reason);
                        }
                    }
                }
            });
        }
    }, 20);
});
