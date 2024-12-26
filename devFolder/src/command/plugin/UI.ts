import { Player, system, world } from "@minecraft/server";
import { ChestForm } from "../../Modules/chestUI"; // パスは適宜修正してください

system.runTimeout(() => {
    world.getPlayers().forEach((player) => {
        main(player);
        testPageFunction(player);
    });
}); 

function main(player: Player) {
    const chestUI = new ChestForm()
        .title('Sub Menu')
        .location("-229 13 59")
        .button(12, 'Join/参加', ['Click To Join Game'], 'minecraft:red_wool', 1)
        .button(14, 'Leave/待機', ['Click To Leave Game'], 'minecraft:green_wool', 1)
        .rollback(true);

    chestUI.then((response) => {
        if (!response.canceled) {
            player.playSound('random.orb');
            if (response.selection === 12) {
                player.sendMessage('Mini Gameに参加/Joinしました');
                player.addTag('n');
            }
            if (response.selection === 14) {
                player.sendMessage('Mini Gameから退出/Leaveしました');
                player.removeTag('n');
            }
        }
    });
}

function testPageFunction(player: Player) {
    const pageChestUI = new ChestForm()
        .title('Page Test')
        .location("-229 13 64")
        .page("page1")
        .button(1, '天気: 晴れ', [], 'minecraft:sunflower', 1, true, true)
        .button(3, '天気: 雨', [], 'minecraft:blue_orchid', 1, true, true)
        .button(5, '天気: 雷雨', [], 'minecraft:wither_rose', 1, true, true)
        .setPageButton("page1", 8, "page2", '次のページへ', ['時間変更'], 'minecraft:arrow', 1)
        .page("page2")
        .button(1, '時間: 日中', [], 'minecraft:clock', 1, true, true)
        .button(3, '時間: 夜', [], 'minecraft:clock', 1, true, true)
        .button(5, '時間: 深夜', [], 'minecraft:clock', 1, true, true)
        .setPageButton("page2", 0, "page1", '前のページへ', ['天気変更'], 'minecraft:arrow', 1)
        .rollback(false)

    pageChestUI.show()

    pageChestUI.then((response) => {
        if (response.canceled || !response.page) return;

        const { page, selection } = response;
        player.playSound('random.orb');

        if (page === "page1") {
            if (selection === 1) {
                player.runCommandAsync('weather clear');
            } else if (selection === 3) {
                player.runCommandAsync('weather rain');
            } else if (selection === 5) {
                player.runCommandAsync('weather thunder');
            }
        } else if (page === "page2") {
            if (selection === 1) {
                player.runCommandAsync('time set day');
            } else if (selection === 3) {
                player.runCommandAsync('time set night');
            } else if (selection === 5) {
                player.runCommandAsync("time set 18000");
            }
        }
    });
}