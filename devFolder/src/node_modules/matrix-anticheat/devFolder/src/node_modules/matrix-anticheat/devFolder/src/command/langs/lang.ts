import { Player } from "@minecraft/server";
import { c } from "../../Util";
import { registerCommand, verifier } from "../../Handler";
import { getAvailableLanguages, changeLanguage,translate } from "./list/LanguageManager"; // 言語管理の関数をインポート


  registerCommand({
    name: "lang",
    description: "lang_docs", 
    parent: false,
    maxArgs: 2,
    minArgs: 1,
    require: (player: Player) => verifier(player, c().commands["lang"]),
    executor: (player: Player, args: string[]) => {
      if (args[0] === "list") {
        const languages = getAvailableLanguages();
        let message = translate(player, "lang_list");
        languages.forEach((lang: string) => {
          message += `§b${lang}\n`;
        });
        player.sendMessage(message);
      } else if (args[0] === "change" && args[1]) {
        const success = changeLanguage(player, args[1]);
        if (success) {
          player.sendMessage(translate(player, "lang_change"));
          player.sendMessage(`§a${args[1]}`)
        } else {
          player.sendMessage(translate(player, "lang_failed"));
          player.sendMessage(`§c${args[1]}`)
        }
      } else {
        player.sendMessage(translate(player, "lang_invalid"));
      }
    },
  });
