import { c } from "../Util";
import { registerCommand, verifier } from "../Handler";
import { showBasicUI } from "./gui/ui";
import { Player, system } from "@minecraft/server";

registerCommand({
    name: "ui",
    description: "ui_command_description",
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    require: (player: Player) => verifier(player, c().commands["ui"]),
    executor: (player: Player) => {
        player.sendMessage("Close chat panel | チャット欄を閉じてください")
    system.runTimeout(() => {
        showBasicUI(player);
      }, 0);
      system.runTimeout(() => {
        showBasicUI(player);
      }, 60); // 60 ticks = 3 seconds
    },
});
