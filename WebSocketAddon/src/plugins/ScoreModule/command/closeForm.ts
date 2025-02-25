import { Player } from "@minecraft/server";
import { Handler } from "../../../module/Handler";



export function registerCloseFormCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('closeForm', {
        moduleName: moduleName,
        description: `ユーザーが開いているフォームを強制的に閉じます`,
        usage: `closeForm execute as @a at @s run scriptevent ws:closeForm　で使用してください`,
        execute: (message, event) => {
            const args = message.split(/\s+/);
            if (args) {
                const player = event.sourceEntity;
                if (player instanceof Player) {
                    //@ts-ignore
                    uiManager.closeAllForms(player);
                }
            }
        },
    });
}