import { Player, system, world } from "@minecraft/server";
import { ChestForm } from "../../Modules/chestUI"; // パスは適宜修正してください

system.runTimeout(() => {
    world.getPlayers().forEach((player) => {
        main(player);
        testMenuSystem(player);
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


/**
 * メインメニューとなるHome Menuを生成する関数
 * @param _player メニューを表示するプレイヤー
 */
function createHomeMenu(_player: Player) {
    const homeMenu = new ChestForm()
        .title('Home Menu')
        .location("-229 13 64") // ラージチェストを設置する座標
        .page("home")
        .button(12, '天気変更', [], 'minecraft:sunflower', 1, true, true)
        .button(14, '時間変更', [], 'minecraft:clock', 1, true, true)
        .setPageButton("home", 16, "weather", '天気変更メニューへ', ['天気変更の詳細'], 'minecraft:arrow', 1)
        .setPageButton("home", 17, "time", '時間変更メニューへ', ['時間変更の詳細'], 'minecraft:arrow', 1)
        .rollback(false);

    return homeMenu;
}

/**
 * 天気変更メニューを生成する関数
 */
function createWeatherMenu() {
    const weatherMenu = new ChestForm()
        .title('Weather Menu')
        .location("-229 13 64") // ラージチェストを設置する座標
        .page("weather")
        .button(11, '天気: 晴れ', [], 'minecraft:sunflower', 1, true, true)
        .button(13, '天気: 雨', [], 'minecraft:blue_orchid', 1, true, true)
        .button(15, '天気: 雷雨', [], 'minecraft:wither_rose', 1, true, true)
        .setPageButton("weather", 0, "home", '前のページへ', ['Home Menuに戻る'], 'minecraft:arrow', 1)
        .rollback(false);

    return weatherMenu;
}

/**
 * 時間変更メニューを生成する関数
 */
function createTimeMenu() {
    const timeMenu = new ChestForm()
        .title('Time Menu')
        .location("-229 13 64") // ラージチェストを設置する座標
        .page("time")
        .button(11, '時間: 日中', [], 'minecraft:clock', 1, true, true)
        .button(13, '時間: 夜', [], 'minecraft:clock', 1, true, true)
        .button(15, '時間: 深夜', [], 'minecraft:clock', 1, true, true)
        .setPageButton("time", 0, "home", '前のページへ', ['Home Menuに戻る'], 'minecraft:arrow', 1)
        .rollback(false);

    return timeMenu;
}

/**
 * メニューを表示し、選択された項目に応じてコマンドを実行する関数
 * @param player メニューを表示するプレイヤー
 * @param menu 表示するメニュー (デフォルトはHome Menu)
 */
function showMenu(player: Player, menu: ChestForm = createHomeMenu(player)) {
    menu.show().then((response) => {
        if (response.canceled || !response.page) return;

        const { page, selection } = response;
        player.playSound('random.orb');

        if (page === "home") {
            if (selection === 12) {
                // 天気変更ボタン
                showMenu(player, createWeatherMenu());
            } else if (selection === 14) {
                // 時間変更ボタン
                showMenu(player, createTimeMenu());
            }
        } else if (page === "weather") {
            if (selection === 11) {
                player.runCommandAsync('weather clear');
            } else if (selection === 13) {
                player.runCommandAsync('weather rain');
            } else if (selection === 15) {
                player.runCommandAsync('weather thunder');
            }
            // 天気変更後にHome Menuに戻る
            showMenu(player, createHomeMenu(player));
        } else if (page === "time") {
            if (selection === 11) {
                player.runCommandAsync('time set day');
            } else if (selection === 13) {
                player.runCommandAsync('time set night');
            } else if (selection === 15) {
                player.runCommandAsync('time set 18000');
            }
            // 時間変更後にHome Menuに戻る
            showMenu(player, createHomeMenu(player));
        }
    });
}

/**
 * メニューシステムのテスト
 * @param player メニューを表示するプレイヤー
 */
function testMenuSystem(player: Player) {
    showMenu(player);
}