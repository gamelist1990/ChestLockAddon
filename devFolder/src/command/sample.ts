import { c } from "../Modules/Util";
import { registerCommand, verifier } from "../Modules/Handler";
import { Player } from "@minecraft/server";

registerCommand({
    name: "sample",
    description: "sample_command_description",
    parent: false,
    maxArgs: 1,
    minArgs: 0,
    require: (player: Player) => verifier(player, c().commands["sample"]),
    executor: (player: Player, args: string[]) => {
        player.sendMessage("Sample command executed | サンプルコマンドが実行されました");
        if (args.length > 0) {
                player.sendMessage(`Argument provided: ${args[0]} | 引数が提供されました: ${args[0]}`);

        }
    },
});
