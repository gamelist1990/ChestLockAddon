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

const hpRegex = / \d+ §c❤§r| \d+ /;
const cpsRegex = /\n§a\[CPS: \d+\]/; // Include the newline in the regex
const deviceRegex = / \n§7\[[A-Z]{2,3}-m:[?\d.+]+\]/;

system.runInterval(() => {

    if (config().commands.tag.enabled === false) return;
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    const isHPTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueHP"));
    const isTeamTrackingEnable = world.getPlayers().some(p => p.hasTag("trueTeam"));
    const isDeviceTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueDevice"));

    if (!isCPSTrackingEnabled && !isTeamTrackingEnable && !isHPTrackingEnabled && !isDeviceTrackingEnabled) return;

    for (const player of world.getPlayers()) {
        let nameTag = player.nameTag;
        let baseName = player.name;

        // HP
        if (player.hasTag("hp")) {
            const health = player.getComponent('minecraft:health') as EntityHealthComponent;
            const playerHealth = health ? Math.floor(health.currentValue) : '';
            const newHPTag = ` ${playerHealth} §c❤§r`;

            baseName = baseName.replace(hpRegex, "").replace(player.name, player.name + newHPTag);
            nameTag = nameTag.replace(hpRegex, "");
        } else {
            baseName = baseName.replace(hpRegex, "");
            nameTag = nameTag.replace(hpRegex, "");
        }

        nameTag = nameTag.replace(player.name, baseName);


        // CPS (HPまたはプレイヤー名から改行)
        if (player.hasTag("cps")) {
            const cps = getPlayerCPS(player);
            player.onScreenDisplay.setActionBar(`§aCPS: ${cps || 0}`);
            const newCPSTag = `\n§a[CPS: ${cps || 0}]`;
            nameTag = nameTag.replace(cpsRegex, "") + newCPSTag;
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

            if (teamColor !== "§f") {
                const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const escapedName = escapeRegExp(player.name);
                const teamRegex = new RegExp(`§[0-9a-f]${escapedName}|${escapedName}`);
                nameTag = nameTag.replace(teamRegex, teamColor + player.name);
            }
        }

        // Device
        if (player.hasTag("device")) {
            const device = clientdevice(player);
            const memoryTier = getMemoryTier(player);
            const deviceName = { 0: "PC", 1: "MB", 2: "CS" }[device] || "??";
            const memoryTierName = {
                0: "m:?",
                1: "m:1.5",
                2: "m:2",
                3: "m:4",
                4: "m:8",
                5: "m:8+",
            }[memoryTier] || "m:?";

            const deviceTag = ` \n§7[${deviceName}-${memoryTierName}]`;
            nameTag = nameTag.replace(deviceRegex, "") + deviceTag;
        } else {
            nameTag = nameTag.replace(deviceRegex, "");
        }

        player.nameTag = nameTag;
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
    name: 'tag',
    description: 'tag_docs',
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, config().commands['tag']),
    executor: (player: Player) => {
        player.sendMessage(`
§f>> §7使用方法:
このコマンドは、プレイヤー名に様々な情報を表示するためのタグ機能を管理します。
各タグを有効にするには、ホストプレイヤーが対応するグローバルタグを設定する必要があります。

§b● グローバルタグ (ホストが設定):
  §7- trueCps:  CPS計測を有効にします。
  §7- trueHP:   HP表示を有効にします。
  §7- trueTeam: チーム表示を有効にします。
  §7- trueDevice: デバイス表示を有効にします。

§b● プレイヤータグ (各プレイヤーが設定):
  §7- cps:     CPSを表示します (trueCps が必要)。
  §7- hp:      HPを表示します (trueHP が必要)。
  §7- team1～team5: チームカラーを設定します (trueTeam が必要)。
  §7- device: デバイス情報を表示します (trueDevice が必要)。

§b● 使用例:
  §7- ホストがCPS表示を有効にする:  /tag @s add trueCps
  §7- プレイヤーが自分のCPSを表示する: /tag @s add cps
  §7- プレイヤーがチーム1に所属する: /tag @s add team1
  §7- プレイヤーがデバイス情報を表示する: /tag @s add device

§c注意:
  §7- グローバルタグが設定されていない場合、プレイヤータグは機能しません。
  §7- チームタグは team1 から team5 まで使用できます。
`);
    },
});
