import { config } from '../../Modules/Util';
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




// 1tick ごとに CPS を表示 & 3秒間クリックがなければ CPS を 0 にする
system.runInterval(() => {
    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    const isHPTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueHP"));
    const isTeamTrackingEnable = world.getPlayers().some(p => p.hasTag("trueTeam"));

    if (!isCPSTrackingEnabled && !isTeamTrackingEnable && !isHPTrackingEnabled) return;

    for (const player of world.getPlayers()) {
        if (player.hasTag("cps")) { 
            const cps = getPlayerCPS(player);

            player.onScreenDisplay.setActionBar(`§aCPS: ${cps || 0}`);

                // プレイヤーの頭の上に CPS を追加表示
                if (!player.nameTag.includes(`\n§a[CPS:`)) { // 既に CPS 表示がない場合のみ追加
                    player.nameTag += `\n§a[CPS: ${cps || 0}]`;
                } else { // 既に CPS 表示がある場合は更新
                    player.nameTag = player.nameTag.replace(/§a\[CPS: \d+\]/, `§a[CPS: ${cps || 0}]`);
                }
            
        } else {
            player.nameTag = player.nameTag.replace(/\n§a\[CPS: \d+\]/, "");

        } if (player.hasTag("hp")) {
            const health = player.getComponent('minecraft:health') as EntityHealthComponent;
            const playerHealth = health ? Math.floor(health.currentValue) : '';

            // nameTagに[HP:]が含まれていない場合は追加
            if (!player.nameTag.includes('[HP:')) {
                player.nameTag += `\n§4[HP: ${playerHealth || 0}]`;
            } else {
                player.nameTag = player.nameTag.replace(/\[HP: [\d.]+\]/g, `[HP: ${playerHealth || 0}]`);
            }
        } else {
            player.nameTag = player.nameTag.replace(/\n§4\[HP: [\d.]+\]/g, "");
        } if (isTeamTrackingEnable) {

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

            function escapeRegExp(string: string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            if (teamColor) {
                const escapedName = escapeRegExp(player.name);
                player.nameTag = player.nameTag.replace(new RegExp(escapedName), teamColor + player.name);


            } else {
                const coloredNameRegex = new RegExp(`(§[m9aed])(${escapeRegExp(player.name)})`);
                player.nameTag = player.nameTag.replace(coloredNameRegex, '$2'); 
            }
        }
    }
}, 1);


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