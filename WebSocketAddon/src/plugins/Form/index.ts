import { ActionFormData, ActionFormResponse, FormCancelationReason, MessageFormData, MessageFormResponse } from "@minecraft/server-ui";
import { Player, world, system } from "@minecraft/server";
import { Handler } from "../../module/Handler";
import { Module, moduleManager } from "../../module/module";
import { Database } from './../../module/DataBase';

interface FormDefinition {
    type: "action" | "message";
    title: string;
    body?: string;
    buttons?: string[];
    iconPaths?: string[]; // Action Form のみ
}

class FormCreationModule implements Module {
    name = "FormCreator";
    enabledByDefault = true;
    docs = `JSONでフォームを作成、結果をDBに保存。\n
§r- コマンド: §9/scriptevent ws:form <action|message> <JSON定義>\n
§r- JSON定義:\n
§r  - §9type§r: "action" | "message"\n
§r  - §9title§r: タイトル\n
§r  - §9body§r: (任意)説明文\n
§r  - §9buttons§r: (任意)ボタンテキスト配列\n
§r  - §9iconPaths§r: (actionのみ, 任意)アイコンパス配列\n
§r- 例:\n
§r  §lAction Form§r:\n
§r  §8{\n
§r  §8  "type": "action",\n
§r  §8  "title": "質問",\n
§r  §8  "body": "好きな果物は？",\n
§r  §8  "buttons": ["りんご", "バナナ", "みかん"],\n
§r  §8  "iconPaths": ["textures/items/apple", "", "textures/items/orange"]\n
§r  §8}\n
\n
§r  §lMessage Form§r:\n
§r  §8{\n
§r  §8  "type": "message",\n
§r  §8  "title": "確認",\n
§r  §8  "body": "本当に削除しますか？",\n
§r  §8  "buttons": ["はい", "いいえ"]\n
§r  §8}\n`;
    private db: Database;

    constructor() {
        this.db = Database.create("ws_form_results");
    }

    async createAndShowForm(player: Player, formDefinition: FormDefinition): Promise<void> {
        // console.warn(`createAndShowForm called: formDefinition=${JSON.stringify(formDefinition)}`);

        try {
            let form: ActionFormData | MessageFormData;

            switch (formDefinition.type) {
                case "action":
                    form = new ActionFormData()
                        .title(formDefinition.title)
                        .body(formDefinition.body || "");
                    if (formDefinition.buttons) {
                        for (let i = 0; i < formDefinition.buttons.length; i++) {
                            const buttonText = formDefinition.buttons[i];
                            const iconPath = formDefinition.iconPaths ? formDefinition.iconPaths[i] ?? "" : "";
                            form.button(buttonText, iconPath);
                        }
                    }
                    //console.warn("Action form created");
                    break;
                case "message":
                    form = new MessageFormData()
                        .title(formDefinition.title)
                        .body(formDefinition.body || "")
                        .button1(formDefinition.buttons && formDefinition.buttons[0] ? formDefinition.buttons[0] : "OK")
                        .button2(formDefinition.buttons && formDefinition.buttons[1] ? formDefinition.buttons[1] : "Cancel");
                  //  console.warn("Message form created");
                    break;

                default:
                    player.sendMessage("§cエラー: 不明なフォームタイプです。");
                    //console.warn(`Invalid form type: ${formDefinition.type}`);
                    return;
            }

            system.run(async () => {
                //@ts-ignore
                const response: ActionFormResponse | MessageFormResponse = await form.show(player);
                //console.warn(`Form shown. Response: ${JSON.stringify(response)}`);

                if (response.cancelationReason === FormCancelationReason.UserBusy) {
                  //  console.warn("Form canceled (UserBusy). Retrying...");
                    this.createAndShowForm(player, formDefinition);
                    return;
                }

                let resultValue = 0; 

                if (!response.canceled) {
                    switch (formDefinition.type) {
                        case "action":
                            const actionResponse = response as ActionFormResponse;
                            resultValue = actionResponse.selection !== undefined ? actionResponse.selection + 1 : 0; // 1から始める
                            break;
                        case "message":
                            const messageResponse = response as MessageFormResponse;
                            // message formの場合も +1
                            resultValue = messageResponse.selection !== undefined ? messageResponse.selection + 1 : 0; // 1 または 2
                            break;
                    }
                    console.warn(`Form result: ${resultValue}`);
                } else {
                  //  console.warn("Form canceled.");
                }
                this.saveFormResponse(player, resultValue);
            });

        } catch (error) {
            player.sendMessage(`§cフォーム定義エラー: ${error}`);
        //    console.error(`Form definition error: ${error}`);
        }
    }



    async saveFormResponse(player: Player, result: number): Promise<void> {
       // console.warn(`saveFormResponse called: player=${player.name}, result=${result}`);
        try {
            await this.db.set(player.name, result);
           // player.sendMessage(`§aフォームの回答を保存しました`);

            // 2秒後にデータを削除
            system.runTimeout(() => {
                this.deleteFormResponse(player.name);
            }, 40);


        } catch (error) {
            console.error("Error saving form response:", error);
            player.sendMessage("§cフォーム結果の保存中にエラーが発生しました。");
        }
    }

    async deleteFormResponse(playerName: string): Promise<void> {
     //   console.warn(`deleteFormResponse called: playerName=${playerName}`); // DEBUG
        try {
            await this.db.delete(playerName);
        } catch (error) {
      //      console.error("Error deleting form response:", error);
        }
    }


    registerCommands(handler: Handler): void {
        handler.registerCommand("form", {
            moduleName: this.name,
            execute: (message, event) => {
                if (!(event.sourceEntity instanceof Player)) return;

                const player = event.sourceEntity;

                console.warn(`Command received: ${message}`);

                // "ws:form" の後をすべて JSON として扱う (message には "ws:form" が含まれない)
                const jsonString = message; // message 全体が JSON

                console.warn(`jsonString: ${jsonString}`);

                try {

                    if (!jsonString) {
                        throw new Error("JSON definition is empty");
                    }
                    const formDefinition: FormDefinition = JSON.parse(jsonString);  // パース

                    // type プロパティの存在確認と値のチェック
                    if (!formDefinition.type || (formDefinition.type !== "action" && formDefinition.type !== "message")) {
                        throw new Error("Invalid or missing 'type' property in JSON.  Must be 'action' or 'message'.");
                    }
                    this.createAndShowForm(player, formDefinition);


                } catch (error) {
                    player.sendMessage(`§c無効な JSON 形式です: ${error}`);
                    console.error(`Invalid JSON format or missing 'type' property: ${error}`); // より詳細なエラー
                    return;
                }
            }
        });
    }


    onEnable(): void {
        console.log(`${this.name}: onEnable`);
        world.sendMessage(`${this.name}: Module Enable`);
    }

    onDisable(): void {
        console.log(`${this.name}: onDisable`);
        world.sendMessage(`${this.name}: Module Disable`);
    }
}

const formCreationModule = new FormCreationModule();
moduleManager.registerModule(formCreationModule);