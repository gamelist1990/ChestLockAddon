// devCommands.js
import { Player, world,system } from "@minecraft/server";
import { registerCommand, verifier } from "../Modules/Handler";
import { c } from "../Modules/Util";
import { showPlayerLanguage, resetPlayerLanguages } from "./langs/list/LanguageManager";
import { showProtectedChestData, resetProtectedChests } from "./chest";
import { handleTeleportCommand } from "./packet";

registerCommand({
  name: "dev",
  description: "Developer commands",
  parent: false,
  maxArgs: 3,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands["dev"]),
  executor: (player: Player, args: string[]) => {
    const subCommand = args[0];
    const option = args[1];
    const playerName = args[2];

    if (subCommand === "chest") {
      // chest サブコマンドはそのまま実行
      if (option === "-reset") {
        resetProtectedChests(player);
      } else {
        showProtectedChestData(player);
      }
    } else if (subCommand === "lang") {
      // lang サブコマンドはそのまま実行
      if (option === "-reset") {
        resetPlayerLanguages(player);
      } else {
        showPlayerLanguage(player);
      }
    } else if (subCommand === "-tp" && option && playerName) {
      system.runTimeout(() => {
        const targetPlayer = world.getPlayers().find(p => p.name === playerName);

        if (targetPlayer) {
          if (option === "-to") {
            handleTeleportCommand(player);
            player.teleport(targetPlayer.location, { dimension: targetPlayer.dimension });
            player.sendMessage(`プレイヤー ${targetPlayer.name} の場所にテレポートしました。`);
          } else if (option === "-me") {
            handleTeleportCommand(targetPlayer);
            targetPlayer.teleport(player.location, { dimension: player.dimension });
            player.sendMessage(`プレイヤー ${targetPlayer.name} をあなたの場所にテレポートしました。`);
          } else {
            player.sendMessage("無効なオプションです。 -to または -me を使用してください。");
          }
        } else {
          player.sendMessage(`プレイヤー ${playerName} が見つかりません。`);
        }
      }, 1); // 1ティック後に実行
    } else {
      player.sendMessage("Unknown subcommand");
    }
  },
});