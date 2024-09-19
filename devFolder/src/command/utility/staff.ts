import { c, kick, tempkick } from '../../Modules/Util';
import { isPlayer, registerCommand, verifier } from '../../Modules/Handler';
import { GameMode, Player, system, world, Vector3, Dimension, TeleportOptions, Vector2 } from '@minecraft/server';
import { checkReports } from './report';
import { translate } from '../langs/list/LanguageManager';

function announce(player: Player, message: string) {
    world.sendMessage(`§l§f[§bServer§f]: ${message}`);
    player.sendMessage(`World Send Done..`);
}

const playerLocations = new Map<string, { location: Vector3, dimension: Dimension, gamemode: any }>();
const trackingIntervals = new Map<string, number>();
const activeFreecamPlayers = new Set<string>();
const playerWarnings = new Map<string, { count: number, reasons: string[] }>();

function savePlayerLocation(player: Player) {
    playerLocations.set(player.name, { location: player.location, dimension: player.dimension, gamemode: player.getGameMode() });
}

function teleportPlayerToLocation(player: Player, location: Vector3, dimension: Dimension) {
    const options: TeleportOptions = { dimension: dimension };
    player.teleport(location, options);
}

function setPlayerToSpectator(player: Player) {
    player.setGameMode(GameMode.spectator);
}

function restorePlayerLocation(player: Player) {
    const savedLocation = playerLocations.get(player.name);
    if (savedLocation) {
        const options: TeleportOptions = { dimension: savedLocation.dimension };
        player.teleport(savedLocation.location, options);
        player.setGameMode(savedLocation.gamemode);
    } else {
        player.sendMessage(translate(player, "Invalid"));
    }
}

function startTrackingPlayer(player: Player, targetPlayer: Player) {
    const intervalId = system.runInterval(() => {
        try {
            const viewDirection: Vector3 = targetPlayer.getViewDirection();
            const options: TeleportOptions = { dimension: targetPlayer.dimension };
            player.teleport(targetPlayer.location, options);
            const rotation: Vector2 = { x: viewDirection.x, y: viewDirection.y };
            player.setRotation(rotation);
        } catch (error) {
            player.sendMessage(`Error getting view direction: ${error}`);
        }

        // 対象プレイヤーが存在しない場合の処理
        if (!targetPlayer || !targetPlayer.isValid()) {
            player.sendMessage(translate(player, "PlayerNotFound"));
            restorePlayerLocation(player);
            stopTrackingPlayer(player);
            activeFreecamPlayers.delete(player.name);
        }
    }, 1); // 1 tickごとに更新

    trackingIntervals.set(player.name, intervalId);
}

function stopTrackingPlayer(player: Player) {
    const intervalId = trackingIntervals.get(player.name);
    if (intervalId !== undefined) {
        system.clearRun(intervalId);
        trackingIntervals.delete(player.name);
    }
}



function warnPlayer(player: Player, targetPlayer: Player, reason: string, kickFlag: boolean) {
    const warnings = playerWarnings.get(targetPlayer.name) || { count: 0, reasons: [] };
    warnings.count += 1;
    warnings.reasons.push(reason);
    playerWarnings.set(targetPlayer.name, warnings);

    //targetPlayer.sendMessage(`You have been warned. Reason: ${reason}. Total warnings: ${warnings.count}`);
    translate(player,"command.WarnTarget",{reason:`${reason}`,warnings:`${warnings.count}`,targetPlayer});
    player.sendMessage(translate(player, "command.WarnPlayer", { target: `${targetPlayer.name}`, warnings: `${warnings.count}`, reason: `${reason}` }));

    if (kickFlag) {
        kick(targetPlayer, `§cYou have been kicked for receiving §e${warnings.count} warnings. Reasons: §b${warnings.reasons.join(', ')}
`, player.name);
        player.sendMessage(translate(player, "commnad.WarnKickMes", { target: `${targetPlayer.name}`, warnings: `${warnings.count}` }))
        playerWarnings.delete(targetPlayer.name);
    }

    if (warnings.count >= 3) {
        tempkick(targetPlayer);
        player.sendMessage(translate(player, "commnad.WarnKickMes", { target: `${targetPlayer.name}`, warnings: `${warnings.count}` }))
        playerWarnings.delete(targetPlayer.name);
    }
}

registerCommand({
    name: 'staff',
    description: 'staff_command_description',
    parent: false,
    maxArgs: 100,
    minArgs: 1,
    require: (player: Player) => verifier(player, c().commands['staff']),
    executor: (player: Player, args: string[]) => {
        const subCommand = args[0];
        const option = args[1];

        if (subCommand === 'freecam' && activeFreecamPlayers.has(player.name) && option !== '-exit') {
            player.sendMessage(translate(player, "commnad.NoFreecam"));
            return;
        }

        if (subCommand === 'world') {
            if (option === '-send') {
                const message = args[2];
                announce(player, message);
            }
        } else if (subCommand === 'report') {
            if (option === '-check') {
                player.sendMessage(translate(player, "closeChat"));
                system.runTimeout(() => {
                    checkReports(player);
                }, 60);
            }
        } else if (subCommand === 'freecam') {
            if (option === '-p') {
                const targetName = args[2];
                const targetPlayer = isPlayer(targetName);
                if (targetPlayer) {
                    savePlayerLocation(player);
                    teleportPlayerToLocation(player, targetPlayer.location, targetPlayer.dimension);
                    setPlayerToSpectator(player);
                    activeFreecamPlayers.add(player.name);
                } else {
                    player.sendMessage(translate(player, "commands.list.playerNotFound", { targetPlayer: `${targetName}` }));
                }
            } else if (option === '-s') {
                savePlayerLocation(player);
                setPlayerToSpectator(player);
                activeFreecamPlayers.add(player.name);
            } else if (option === '-exit') {
                restorePlayerLocation(player);
                stopTrackingPlayer(player); // 追従を停止
                activeFreecamPlayers.delete(player.name);
            } else if (option === '-v') {
                const targetName = args[2];
                const targetPlayer = isPlayer(targetName);
                if (targetPlayer) {
                    savePlayerLocation(player); // 自分の位置を保存
                    teleportPlayerToLocation(player, targetPlayer.location, targetPlayer.dimension); // 対象プレイヤーに移動
                    startTrackingPlayer(player, targetPlayer); // 対象プレイヤーの視点を追従
                    activeFreecamPlayers.add(player.name);
                } else {
                    player.sendMessage(translate(player, "commands.list.playerNotFound", { targetPlayer: `${targetName}` }));
                }
            }
        } else if (subCommand === 'warn') {
            if (option === '-p') {
                const targetName = args[2];
                const reasonIndex = args.indexOf('-r');
                const reason = reasonIndex !== -1 ? args.slice(reasonIndex + 1).join(' ') : 'No reason provided';
                const kickFlag = args.includes('-kick');
                const targetPlayer = isPlayer(targetName);
                if (targetPlayer) {
                    warnPlayer(player, targetPlayer, reason, kickFlag);
                } else {
                    player.sendMessage(translate(player, "commands.list.playerNotFound", { targetPlayer: `${targetName}` }));
                }
            }
        } else {
            player.sendMessage(translate(player, "command.staff.UsageCom"));
        }
    },
});
