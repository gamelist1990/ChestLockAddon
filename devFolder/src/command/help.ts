import { Player } from "@minecraft/server";
import { c } from "../Util";
import { registerCommand, getAllCommandNames, verifier, prefix } from "../Handler"; // コマンドが登録されているファイルをインポート
import { translate } from "./langs/list/LanguageManager"; 



registerCommand({
  name: "help",
  description: "help_command_description", 
  parent: false,
  maxArgs: 0,
  minArgs: 0,
  require: (player: Player) => verifier(player, c().commands["help"]),
  executor: (player: Player) => {
    const helpMessages = getAllCommandNames();
    let helpMessage = translate(player, "available_commands") + ":\n"; 
    helpMessages.forEach((msg) => {
      const commandDescription = translate(player, msg.description); // 翻訳キーを使って翻訳
      helpMessage += `§b${prefix}${msg.name} - ${commandDescription}\n`;
    });
    player.sendMessage(helpMessage);
  },
});

