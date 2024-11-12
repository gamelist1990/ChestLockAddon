import { clientdevice, config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system, EntityHealthComponent } from '@minecraft/server';

let cpsCounting: { [playerName: string]: { lastHit: number; hits: number; cps: number; timeoutId?: number } } = {};

world.afterEvents.entityHitEntity.subscribe((event) => {
    const player = event.damagingEntity;
    if (!(player instanceof Player) || !player.hasTag("cps")) return;

    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    if (!isCPSTrackingEnabled) return;

    if (!cpsCounting[player.name]) {
        cpsCounting[player.name] = { lastHit: Date.now(), hits: 0, cps: 0, timeoutId: undefined };
    }

    const now = Date.now();
    const diff = now - cpsCounting[player.name].lastHit;
    if (diff < 1000) {
        cpsCounting[player.name].hits++;
    } else {
        cpsCounting[player.name].cps = Math.round(cpsCounting[player.name].hits / (diff / 1000));
        cpsCounting[player.name].hits = 1;
        cpsCounting[player.name].lastHit = now;
    }
});


// 1tick ごとに CPS を表示 & 3秒間クリックがなければ CPS を 0 にする
system.runInterval(() => {
    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    const isHPTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueHP"));
    const isDeviceTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueDevice"));


    if (!isCPSTrackingEnabled) return;
    if (!isDeviceTrackingEnabled) return;
    if (!isHPTrackingEnabled) return;

    for (const player of world.getPlayers()) {
        if (player.hasTag("cps")) { // cpsタグを持つプレイヤー
            const playerData = cpsCounting[player.name];
            if (playerData) {
                const now = Date.now();
                const diff = now - playerData.lastHit;

                if (diff >= 3000) { // 3秒間クリックがなければ
                    playerData.cps = 0;

                    // タイムアウトをクリア
                    if (playerData.timeoutId !== undefined) {
                        system.clearRun(playerData.timeoutId);
                        delete playerData.timeoutId;
                    }
                }

                player.onScreenDisplay.setActionBar(`§aCPS: ${playerData.cps || 0}`);

                // プレイヤーの頭の上に CPS を追加表示
                if (!player.nameTag.includes(`\n§a[CPS:`)) { // 既に CPS 表示がない場合のみ追加
                    player.nameTag += `\n§a[CPS: ${playerData.cps || 0}]`;
                } else { // 既に CPS 表示がある場合は更新
                    player.nameTag = player.nameTag.replace(/§a\[CPS: \d+\]/, `§a[CPS: ${playerData.cps || 0}]`);
                }
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
            player.nameTag = player.nameTag.replace(/\[HP: [\d.]+\]/g, "");
        } if (player.hasTag("team1") || player.hasTag("team2") || player.hasTag("team3") || player.hasTag("team4") || player.hasTag("team5")) {

            let teamColor = "§f";

            if (player.hasTag("team1")) {
                teamColor = "§m";
            } else if (player.hasTag("team2")) {
                teamColor = "§9";
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

            const escapedName = escapeRegExp(player.name);
            player.nameTag = player.nameTag.replace(new RegExp(`(^|\\s)${escapedName}(\\s|$)`), `$1${teamColor}${player.name}$2`);
        } else {
            player.nameTag = player.nameTag.replace(new RegExp(`(§c|§9|§a|§e|§d)${player.name}`), player.name);
        } 
        if (player.hasTag("device")) {
            const device = clientdevice(player);
            const deviceName = ["Desktop", "Mobile", "Console"][device] || "Unknown";

            const deviceTagRegex = /\[(?:\d+|\w+)\]/g; 
            player.nameTag = player.nameTag.replace(deviceTagRegex, `[${deviceName}]`);

            // nameTagにデバイスタグがない場合、末尾に追加
            if (!deviceTagRegex.test(player.nameTag)) {
                player.nameTag += `\n[${deviceName}]`;
            } 
        } else {
            player.nameTag = player.nameTag.replace(/^.*\[(?:\d+|\w+)\].*$/gm, "");
        }
    }
}, 1);


export function getPlayerCPS(playerName: string): number {
    if (cpsCounting[playerName]) {
        // 最後に記録されたヒットからの経過時間を取得
        const now = Date.now();
        const diff = now - cpsCounting[playerName].lastHit;

        // 1秒以上経過している場合は、最後に記録されたヒット数からCPSを計算
        if (diff >= 1000) {
            return Math.round(cpsCounting[playerName].hits / (diff / 1000));
        } else {
            // 1秒未満の場合は、そのままヒット数を返す
            return cpsCounting[playerName].hits;
        }
    } else {
        // 対象プレイヤーのCPS計測が開始されていない場合は 0 を返す
        return 0;
    }
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