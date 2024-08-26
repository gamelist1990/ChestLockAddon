import { c } from "../../Modules/Util";
import { registerCommand, verifier } from "../../Modules/Handler";
import { showBasicUI } from "./ui";
import { Player, system } from "@minecraft/server";
import { translate } from "../langs/list/LanguageManager";


registerCommand({
    name: "ui",
    description: "ui_command_description",
    parent: false,
    maxArgs: 0,
    minArgs: 0,
    require: (player: Player) => verifier(player, c().commands["ui"]),
    executor: (player: Player) => {
        player.sendMessage(translate(player,"closeChat"))
    system.runTimeout(() => {
        showBasicUI(player);
      }, 0);
      system.runTimeout(() => {
        showBasicUI(player);
      }, 60); // 60 ticks = 3 seconds
    },
});
