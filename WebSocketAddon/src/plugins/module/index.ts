import { ActionFormData, ActionFormResponse, FormCancelationReason, MessageFormData, MessageFormResponse } from "@minecraft/server-ui";
import { Player, system } from "@minecraft/server";
import { Handler } from "../../module/Handler";
import { Module, moduleManager } from "../../module/module";

interface ModuleStatus {
    name: string;
    enabled: boolean;
    docs?: string;
}

class ActionFormModule implements Module {
    name = "ModuleEditer";
    enabledByDefault = true;
    docs = "モジュールの有効/無効を切り替えるためのUIを提供します。\n/scriptevent ws:module コマンドでモジュールリストを表示します。";

    private async showModuleListForm(player: Player): Promise<void> {
        const modules = moduleManager.getAllModules().filter(mod => mod.name !== this.name);  // 自分自身を除外
        const form = new ActionFormData()
            .title("§lモジュール管理")
            .body("§a有効/無効を切り替えるモジュールを選択してください。");

        for (const module of modules) {
            const isEnabled = moduleManager.isModuleEnabled(module.name);
            form.button(`${module.name} §r(${isEnabled ? "§2有効" : "§c無効"})`);
        }
        form.button("§4戻る");

        try {

            //@ts-ignore
            const response: ActionFormResponse = await form.show(player);

            if (response.cancelationReason === FormCancelationReason.UserBusy) {
                system.run(() => this.showModuleListForm(player)); // 再帰的にフォームを表示
                return;
            }

            if (response.canceled || response.selection === modules.length) {
                // キャンセルまたは「戻る」ボタン
                return;
            }

            if (response.selection !== undefined) {
                const selectedModule = modules[response.selection];
                const moduleStatus: ModuleStatus = {
                    name: selectedModule.name,
                    enabled: moduleManager.isModuleEnabled(selectedModule.name),
                    docs: selectedModule.docs,
                };
                system.run(() => this.showModuleDetailsForm(player, moduleStatus));
            }
        } catch (error) {
            console.error("Error showing module list form:", error);
        }
    }

    private async showModuleDetailsForm(player: Player, moduleStatus: ModuleStatus): Promise<void> {
        const isEnabled = moduleManager.isModuleEnabled(moduleStatus.name);
        const updatedModuleStatus: ModuleStatus = { ...moduleStatus, enabled: isEnabled }; // 最新の状態に更新

        const form = new MessageFormData()
            .title(`§l${updatedModuleStatus.name}`)
            .body(updatedModuleStatus.docs ?? "説明はありません。")
            .button1(isEnabled ? "§c無効にする" : "§2有効にする")
            .button2("§6戻る");

        try {//@ts-ignore
            const response: MessageFormResponse = await form.show(player);

            if (response.cancelationReason === FormCancelationReason.UserBusy) {
                system.run(() => this.showModuleDetailsForm(player, updatedModuleStatus)); // 再帰的にフォームを表示
                return;
            }

            if (response.selection === 1) {
                // 「戻る」ボタン (button2)
                system.run(() => this.showModuleListForm(player));
                return;
            }

            if (response.selection === 0) {
                // 有効/無効 切り替えボタン (button1)
                if (isEnabled) {
                    await moduleManager.disableModule(updatedModuleStatus.name);
                    player.sendMessage(`モジュール "${updatedModuleStatus.name}" を無効にしました。`);
                } else {
                    await moduleManager.enableModule(updatedModuleStatus.name);
                    player.sendMessage(`モジュール "${updatedModuleStatus.name}" を有効にしました。`);
                }
                system.run(() => this.showModuleListForm(player));  // 処理後にリストに戻る
            }

        } catch (error) {
            console.error("Error showing module Detail Form:", error);
        }
    }


    registerCommands(handler: Handler): void {
        handler.registerCommand("module", {
            moduleName: this.name,
            description: `モジュールの有効/無効を切り替えるためのUIを表示します。`,
            usage: `module`,
            execute: (_message, event) => {
                if (event.sourceEntity instanceof Player) {
                    this.showModuleListForm(event.sourceEntity);
                }
            }
        });
    }

}

const actionFormModule = new ActionFormModule();
moduleManager.registerModule(actionFormModule);