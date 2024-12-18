import { Player, system, world } from '@minecraft/server';
import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';

// メンテナンスモードのフラグ
let lockdownMode = false;

// ロックダウンモードを切り替えるコマンド
registerCommand({
    name: 'lockdown',
    description: 'lockdown_docs',
    parent: false,
    minArgs: 0,
    maxArgs: 1,
    require: (player: Player) => verifier(player, config().commands['lockdown']),
    executor: (player: Player, args: string[]) => {
        if (args.length === 0) {
            player.sendMessage('有効な引数ではありません。on または off を使用してください');
        } else if (args[0] === 'on') {
            lockdownMode = true;
            player.sendMessage('ロックダウンモードをオンにしました。');
            kickNonStaffPlayers(player);
        } else if (args[0] === 'off') {
            lockdownMode = false;
            player.sendMessage('ロックダウンモードをオフにしました。');
            player.sendMessage('可能であれば(reload all)で再起動する事をお勧めします');
        } else {
            player.sendMessage('有効な引数ではありません。on または off を使用してください');
        }
    },
});

// 定期的にプレイヤーをチェックする関数
function kickNonStaffPlayers(issuer: Player) {
    if (!lockdownMode) return;
    for (const player of world.getAllPlayers()) {
        if (!player.hasTag(config().staff) && !player.hasTag(config().admin)) {
            system.runTimeout(() => {
                player.runCommand(`kick ${player.name} §r\n§c|§eメンテナンス中§c|\n§b~~~~~~~~~~~~~~~~~~~\n§rサーバーは現在メンテナンス中です。\n§rしばらくお待ちください。`);
                if (issuer) issuer.sendMessage(`§e${player.name}§rを§cロックダウンを有効§rにした為キックしました`);
            })

        }
    }
}

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (lockdownMode && !player.hasTag(config().staff) && !player.hasTag(config().admin)) {
        system.runTimeout(() => {
            player.runCommand(`kick ${player.name} §r\n§c|§eメンテナンス中§c|\n§b~~~~~~~~~~~~~~~~~~~\n§rサーバーは現在メンテナンス中です。\n§rしばらくお待ちください。`);
        })
    }
});