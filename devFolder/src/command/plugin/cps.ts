import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system } from '@minecraft/server';

let cpsCounting: { [playerName: string]: { lastHit: number; hits: number; cps: number } } = {};

world.afterEvents.entityHitEntity.subscribe((event) => {
    const player = event.damagingEntity;
    if (!(player instanceof Player) || !player.hasTag("cps")) return;

    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    if (!isCPSTrackingEnabled) return;

    if (!cpsCounting[player.name]) {
        cpsCounting[player.name] = { lastHit: Date.now(), hits: 0, cps: 0 };
    }

    const now = Date.now(); // hits > 0 の条件判定を削除
    const diff = now - cpsCounting[player.name].lastHit;
    if (diff < 1000) {
        cpsCounting[player.name].hits++;
    } else {
        cpsCounting[player.name].cps = Math.round(cpsCounting[player.name].hits / (diff / 1000));
        cpsCounting[player.name].hits = 1;
        cpsCounting[player.name].lastHit = now;
    }
});

// 1tick ごとに CPS を表示
system.runInterval(() => {
    // trueCps プレイヤーが存在するかチェック
    const isCPSTrackingEnabled = world.getPlayers().some(p => p.hasTag("trueCps"));
    if (!isCPSTrackingEnabled) return;

    for (const player of world.getPlayers()) {
        if (!player.hasTag("cps")) continue; // cpsタグを持つプレイヤーのみ処理

        const playerData = cpsCounting[player.name];
        if (playerData) {
            player.onScreenDisplay.setActionBar(`§aCPS: ${playerData.cps || 0}`);
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
            system.runTimeout(()=>{
                player.addTag("trueCps");
            },1)
        } else {
            system.runTimeout(() => {
                player.removeTag("trueCps");

            },1)
        }

        player.sendMessage(enable ? '§aCPS tracking enabled for players with the "cps" tag.' : '§cCPS tracking disabled.');
    },
});