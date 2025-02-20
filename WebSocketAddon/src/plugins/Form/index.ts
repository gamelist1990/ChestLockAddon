import {
    ActionFormData,
    ActionFormResponse,
    FormCancelationReason,
    MessageFormData,
    MessageFormResponse,
    ModalFormData,
    ModalFormResponse,
} from "@minecraft/server-ui";
import { Player, system } from "@minecraft/server";
import { Handler } from "../../module/Handler";
import { Module, moduleManager } from "../../module/module";
import { Database } from './../../module/DataBase';

interface FormDefinition {
    type: "action" | "message" | "modal";
    title: string;
    body?: string;
    buttons?: string[];
    iconPaths?: string[];
    dropdowns?: { label: string; options: string[]; defaultIndex?: number }[];
    inputs?: { label: string; placeholder?: string; defaultValue?: string }[];
    toggles?: { label: string; defaultValue?: boolean }[];
    sliders?: { label: string; min: number; max: number; step?: number; defaultValue?: number }[];
}

class FormCreationModule implements Module {
    name = "FormCreator";
    enabledByDefault = true;
    docs = `JSONでフォームを作成、結果をDBに保存。

- コマンド: /scriptevent ws:form <action|message|modal> <JSON定義>

- JSON定義:
  - type: "action" | "message" | "modal"
  - title: タイトル
  - body: (任意)説明文
  - buttons: (任意)ボタンテキスト配列
  - iconPaths: (actionのみ, 任意)アイコンパス配列
  - dropdowns: (modalのみ, 任意)ドロップダウンの配列
      - label: ドロップダウンのラベル
      - options: 選択肢の配列
      - defaultIndex: (任意)デフォルト選択肢のインデックス (0始まり)
  - inputs: (modalのみ, 任意)テキスト入力欄の配列
      - label: 入力欄のラベル
      - placeholder: (任意)プレースホルダーテキスト
      - defaultValue: (任意)デフォルト値
  - toggles: (modalのみ, 任意)トグルスイッチの配列
      - label: トグルスイッチのラベル
      - defaultValue: (任意)デフォルト値 (true/false)
  - sliders: (modalのみ, 任意)スライダーの配列
      - label: スライダーのラベル
      - min: 最小値
      - max: 最大値
      - step: (任意)ステップ数 (デフォルトは1)
      - defaultValue: (任意)デフォルト値

- 例:
  Action Form:
  {
    "type": "action",
    "title": "質問",
    "body": "好きな果物は？",
    "buttons": ["りんご", "バナナ", "みかん"],
    "iconPaths": ["textures/items/apple", "", "textures/items/orange"]
  }

  Message Form:
  {
    "type": "message",
    "title": "確認",
    "body": "本当に削除しますか？",
    "buttons": ["はい", "いいえ"]
  }
  Modal Form:
  {
      "type": "modal",
      "title": "設定",
      "dropdowns": [
        { "label": "難易度", "options": ["イージー", "ノーマル", "ハード"], "defaultIndex": 1 }
      ],
      "inputs": [
        { "label": "名前", "placeholder": "名前を入力", "defaultValue": "名無し" }
      ],
      "toggles": [
          {"label": "通知を有効にする", "defaultValue": true}
      ],
      "sliders": [
          {"label": "音量", "min": 0, "max": 100, "step": 5, "defaultValue": 50}
      ]
  }
`;
    private dbResults: Database;
    private dbResponses: Database;

    constructor() {
        this.dbResults = Database.create("ws_form_results");
        this.dbResponses = Database.create("ws_form_responses");
    }

    async createAndShowForm(player: Player, formDefinition: FormDefinition): Promise<void> {
        try {
            let form: ActionFormData | MessageFormData | ModalFormData;

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
                    break;

                case "message":
                    form = new MessageFormData()
                        .title(formDefinition.title)
                        .body(formDefinition.body || "");

                    if (formDefinition.buttons && formDefinition.buttons.length > 0) {
                        form.button1(formDefinition.buttons[0]);
                        if (formDefinition.buttons.length > 1) {
                            form.button2(formDefinition.buttons[1]);
                        }
                    } else {
                        form.button1("OK");
                    }
                    break;

                case "modal":
                    form = new ModalFormData().title(formDefinition.title);

                    if (formDefinition.dropdowns) {
                        for (const dropdown of formDefinition.dropdowns) {
                            form.dropdown(dropdown.label, dropdown.options, dropdown.defaultIndex);
                        }
                    }
                    if (formDefinition.inputs) {
                        for (const input of formDefinition.inputs) {
                            form.textField(input.label, input.placeholder || "", input.defaultValue);
                        }
                    }
                    if (formDefinition.toggles) {
                        for (const toggle of formDefinition.toggles) {
                            form.toggle(toggle.label, toggle.defaultValue);
                        }
                    }

                    if (formDefinition.sliders) {
                        for (const slider of formDefinition.sliders) {
                            form.slider(slider.label, slider.min, slider.max, slider.step || 1, slider.defaultValue);
                        }
                    }
                    break;

                default:
                    player.sendMessage("§cエラー: 不明なフォームタイプです。");
                    return;
            }



            system.run(async () => {
                //@ts-ignore
                const response: ActionFormResponse | MessageFormResponse | ModalFormResponse = await form.show(player);

                if (response.cancelationReason === FormCancelationReason.UserBusy) {
                    this.createAndShowForm(player, formDefinition);
                    return;
                }

                let dbResultsKey: string;
                let dbResponsesKey: Player = player;
                let resultValue: number = 0;
                let responseValue: number;


                if (!response.canceled) {
                    switch (formDefinition.type) {
                        case "action":
                            const actionResponse = response as ActionFormResponse;
                            dbResultsKey = player.name + JSON.stringify(formDefinition);
                            resultValue = actionResponse.selection !== undefined ? actionResponse.selection + 1 : 1;
                            responseValue = actionResponse.selection !== undefined ? actionResponse.selection + 1 : 1;
                            break;
                        case "message":
                            const messageResponse = response as MessageFormResponse;
                            dbResultsKey = player.name + JSON.stringify(formDefinition);
                            resultValue = messageResponse.selection !== undefined ? messageResponse.selection + 1 : 1;
                            responseValue = messageResponse.selection !== undefined ? messageResponse.selection + 1 : 1;
                            break;
                        case "modal":
                            const modalResponse = response as ModalFormResponse;
                            dbResultsKey = player.name + JSON.stringify(formDefinition) + JSON.stringify(modalResponse.formValues);
                            resultValue = 1;
                            responseValue = 1;
                            break;
                        default:
                            dbResultsKey = player.name + JSON.stringify(formDefinition);
                            resultValue = 0;
                            responseValue = 0
                            break;
                    }


                } else {
                    dbResultsKey = player.name + JSON.stringify(formDefinition);
                    resultValue = 0;
                    responseValue = 0;
                }
                this.saveFormResponse(dbResponsesKey, responseValue);
                this.saveAndDeleteFormResult(player, resultValue, dbResultsKey);
            });

        } catch (error) {
            player.sendMessage(`§cフォーム定義エラー: ${error}`);
        }
    }

    async saveFormResponse(key: Player, response: number): Promise<void> {
        try {
            await this.dbResponses.set(key, response);
            //   console.log(key, result)
            //player.sendMessage(`§aフォームの回答を保存しました: ${result}`);
            system.runTimeout(async () => {
                try {
                    await this.dbResponses.delete(key);
                    //player.sendMessage(`§aフォームの回答を削除しました`);
                } catch (deleteError) {
                    console.error("Error deleting form response:", deleteError);
                    key.sendMessage("§cフォーム結果の削除中にエラーが発生しました。");
                }
            }, 20);
        } catch (saveError) {
            console.error("Error saving form response:", saveError);

        }
    }


    async saveAndDeleteFormResult(player: Player, result: number, key: string): Promise<void> {
        try {
            await this.dbResults.set(key, result);
            //   console.log(key, result)
            //player.sendMessage(`§aフォームの回答を保存しました: ${result}`);

            system.runTimeout(async () => {
                try {
                    await this.dbResults.delete(key);
                    //player.sendMessage(`§aフォームの回答を削除しました`);
                } catch (deleteError) {
                    console.error("Error deleting form response:", deleteError);
                    player.sendMessage("§cフォーム結果の削除中にエラーが発生しました。");
                }
            }, 20);

        } catch (saveError) {
            console.error("Error saving form response:", saveError);
            player.sendMessage("§cフォーム結果の保存中にエラーが発生しました。");
        }
    }




    registerCommands(handler: Handler): void {
        handler.registerCommand("form", {
            moduleName: this.name,
            description: `JSON形式のデータを使用してフォームを作成し、表示します。`,  // ここ
            usage: `form <JSON形式のフォーム定義>\n例:\nform {"type": "action", "title": "質問", "body": "好きな果物は？", "buttons": ["りんご"], "iconPaths": ["textures/items/apple"]}\nform {"type": "message", "title": "確認", "body": "よろしいですか？", "buttons": ["はい", "いいえ"]}`,
            execute: (message, event) => {
                if (!(event.sourceEntity instanceof Player)) return;

                const player = event.sourceEntity;

                const jsonString = message;

                try {

                    if (!jsonString) {
                        throw new Error("JSON definition is empty");
                    }
                    const formDefinition: FormDefinition = JSON.parse(jsonString);

                    if (!formDefinition.type || (formDefinition.type !== "action" && formDefinition.type !== "message" && formDefinition.type !== "modal")) {
                        throw new Error("Invalid or missing 'type' property in JSON.  Must be 'action', 'message' or 'modal'.");
                    }
                    this.createAndShowForm(player, formDefinition);


                } catch (error) {
                    player.sendMessage(`§c無効な JSON 形式です: ${error}`);
                    console.error(`Invalid JSON format or missing 'type' property: ${error}`);
                    return;
                }
            }
        });
    }


    onEnable(): void {
    }

    onDisable(): void {
    }
}

const formCreationModule = new FormCreationModule();
moduleManager.registerModule(formCreationModule);