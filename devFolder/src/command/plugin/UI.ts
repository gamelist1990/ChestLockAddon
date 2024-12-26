import { Player } from "@minecraft/server";
import { ChestForm } from "../../Modules/chestUI";



function main(player: Player) {
    const chestUI = new ChestForm()
        .title('Sub Menu')
        .location("272 63 721")
        .button(12, 'Give Command 1', ['Click To Give Apple'], 'minecraft:apple', 1)
        .button(14, 'Give Command 2', ['Click To Give Diamond'], 'minecraft:diamond', 1);

    chestUI
        .then((response) => {
            if (!response.canceled) {
                if (response.selection === 12) {
                    player.sendMessage('コマンドを実行しました');
                    player.runCommand('give @s apple');
                }
                if (response.selection === 14) {
                    player.sendMessage('コマンドを実行しました');
                    player.runCommand('give @s diamond');
                }

            }
        })
}