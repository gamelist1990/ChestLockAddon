import { clientdevice, config, getMemoryTier } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, EntityHealthComponent } from '@minecraft/server';

interface ClickInfo {
    readonly timestamp: number;
};

const clicks = new Map<Player, ClickInfo[]>();


world.afterEvents.entityHitBlock.subscribe(({ damagingEntity }) => {
    if (!(damagingEntity instanceof Player) || !damagingEntity.hasTag("cps")) return;
    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    if (!isCPSTrackingEnabled) return;

    const clickInfo = { timestamp: Date.now() };
    const playerClicks = clicks.get(damagingEntity) || [];
    playerClicks.push(clickInfo);
    clicks.set(damagingEntity, playerClicks);
});

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => {
    if (!(damagingEntity instanceof Player) || !damagingEntity.hasTag("cps")) return;
    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    if (!isCPSTrackingEnabled) return;

    const clickInfo = { timestamp: Date.now() };
    const playerClicks = clicks.get(damagingEntity) || [];
    playerClicks.push(clickInfo);
    clicks.set(damagingEntity, playerClicks);
});

system.runInterval(() => {
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    const isHPTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueHP"));
    const isTeamTrackingEnable = world.getPlayers().some(p => p.hasTag("trueTeam"));

    if (!isCPSTrackingEnabled && !isTeamTrackingEnable && !isHPTrackingEnabled) return;

    for (const player of world.getPlayers()) {
        let nameTag = player.nameTag;

        // HP
        const heartIcon = '\u2764';
        const hpRegex = / \d+ §c\u2764§r| \d+ /; 
        if (player.hasTag("hp")) {
            const health = player.getComponent('minecraft:health') as EntityHealthComponent;
            const playerHealth = health ? Math.floor(health.currentValue) : '';
            const newHPTag = ` §r${playerHealth} §c${heartIcon}§r`;

            if (hpRegex.test(nameTag)) {
                nameTag = nameTag.replace(hpRegex, newHPTag);
            } else {
                nameTag += newHPTag;
            }
        } else {
            nameTag = nameTag.replace(hpRegex, "");
        }

        

        // CPS
        const cpsRegex = /§a\[CPS: \d+\]/;
        if (player.hasTag("cps")) {
            const cps = getPlayerCPS(player);
            player.onScreenDisplay.setActionBar(`§aCPS: ${cps || 0}`);

            const newCPSTag = `\n§a[CPS: ${cps || 0}]`;

            if (cpsRegex.test(nameTag)) {
                nameTag = nameTag.replace(cpsRegex, newCPSTag);
            } else {
                nameTag += newCPSTag;
            }
        } else {
            nameTag = nameTag.replace(cpsRegex, "");
        }


        // Team
        if (isTeamTrackingEnable) {
            let teamColor = "§f";

            if (player.hasTag("team1")) {
                teamColor = "§c";
            } else if (player.hasTag("team2")) {
                teamColor = "§b";
            } else if (player.hasTag("team3")) {
                teamColor = "§a";
            } else if (player.hasTag("team4")) {
                teamColor = "§e";
            } else if (player.hasTag("team5")) {
                teamColor = "§d";
            }

            const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


            if (teamColor !== "§f") {
                const escapedName = escapeRegExp(player.name);
                const teamRegex = new RegExp(`§[0-9a-f]${escapedName}|${escapedName}`);
                nameTag = nameTag.replace(teamRegex, teamColor + player.name);
            }
        }

        if (player.hasTag("device")) {
            const device = clientdevice(player);
            const memoryTier = getMemoryTier(player);
            const deviceName = {
                0: "PC",
                1: "MB",
                2: "CS",
            }[device] || "??";
            const memoryTierName = {
                0: "m:?",
                1: "m:1.5",
                2: "m:2",
                3: "m:4",
                4: "m:8",
                5: "m:8+",
            }[memoryTier] || "m:?";


            const deviceTag = ` \n§7[${deviceName}-${memoryTierName}]`;
            const deviceRegex = / \n§7\[[A-Z]{2,3}-m:[?\d.+]+\]/;

            if (!deviceRegex.test(nameTag)) {
                nameTag += deviceTag;
            } else {
                nameTag = nameTag.replace(deviceRegex, deviceTag);
            }
        } else {
            nameTag = nameTag.replace(/ \n§7\[[A-Z]{2,3}-M:[?\d.+]+\]/, "");
        }


        player.nameTag = nameTag;
    }
});


export function getPlayerCPS(player: Player): number {
    const currentTime = Date.now();
    const playerClicks = clicks.get(player) || [];
    const recentClicks = playerClicks.filter(({ timestamp }) => currentTime - 1000 < timestamp);
    clicks.set(player, recentClicks);
    return recentClicks.length;
}

registerCommand({
    name: 'cps',
    description: 'Toggles CPS tracking for players with the "cps" tag.',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['cps']),
    executor: (player: Player, args: string[]) => {
        const enable = args.length === 0 || args[0] !== '-false';

        // trueCps タグの管理
        if (enable) {
            system.runTimeout(() => {
                player.addTag("trueCps");
            }, 1)
        } else {
            system.runTimeout(() => {
                player.removeTag("trueCps");
            }, 1)
        }

        player.sendMessage(enable ? '§aCPS tracking enabled for players with the "cps" tag.' : '§cCPS tracking disabled.');
    },
});