import { world } from "@minecraft/server";
import { c } from "./Util";
export const prefix = "!";
const commands = {};
export function registerCommand(options) {
    commands[options.name] = options;
}
export function getAllCommandNames() {
    return Object.values(commands).map(({ name, description }) => ({ name, description }));
}
export function isPlayer(playerName) {
    return world.getPlayers().find(player => player.name === playerName);
}
export function verifier(player, setting) {
    if (setting.enabled !== true) {
        return false;
    }
    else if (setting.adminOnly === true && !player.hasTag(c().admin)) {
        return false;
    }
    else if (setting.requireTag.length > 0 && !player.getTags().some((tag) => setting.requireTag.includes(tag))) {
        return false;
    }
    return true;
}
// チャットイベントリスナー
//@ts-ignore
world.beforeEvents.chatSend.subscribe((event) => {
    const { message, sender: player } = event;
    if (!message.startsWith(prefix))
        return;
    const args = message.slice(prefix.length).replace("@", "").match(/(".*?"|\S+)/g)?.map((match) => match.replace(/"/g, ''));
    if (!args)
        return;
    const commandName = args.shift()?.toLowerCase().trim();
    const commandOptions = commands[commandName];
    if (commandOptions) {
        if (verifier(player, c().commands[commandName])) {
            commandOptions.executor(player, args);
        }
    }
    else {
        player.sendMessage(`§cコマンドが見つかりません: ${commandName}`);
    }
    event.cancel = true;
});
