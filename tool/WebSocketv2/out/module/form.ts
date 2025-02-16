import { world } from "../backend";
import { Player } from "./player";

// フォームの応答を表すインターフェース (MessageForm, ActionForm 共通)
interface FormResponse {
    canceled: boolean;
    selection: number | null; // ボタンのインデックス (0-indexed)。キャンセル時はnull。
}

// フォームの種類を表す型
type FormType = "message" | "action";


// 基底クラス (共通処理)
abstract class BaseFormData {
    protected titleText: string = "";
    protected bodyText: string = "";
    protected checkInterval: NodeJS.Timer | undefined;
    protected timeoutId: NodeJS.Timer | undefined;
    protected readonly checkIntervalMs = 100;
    protected readonly timeoutMs = 30000;
    protected currentPromise: { resolve: (value: FormResponse) => void; reject: (reason?: any) => void; } | undefined;
    public readonly formType: FormType;


    constructor(formType: FormType) {
        this.formType = formType
    }

    title(title: string): this {
        this.titleText = title;
        return this;
    }

    body(body: string): this {
        this.bodyText = body;
        return this;
    }

    protected abstract getFormDefinition(): any;  
    protected abstract processScore(score: number): FormResponse; 

    async show(player: Player): Promise<FormResponse> {
        const objective = await world.scoreboard.getObjective('ws_module');
        if (!objective) {
            return Promise.reject();
        }

        let formCreatorScore = 0;
        try {
            const score = await objective.getScore('FormCreator');
            formCreatorScore = score === null ? 0 : score;
        } catch (error) {
        }
        if (formCreatorScore !== 1) {
            return Promise.reject();
        }

        return new Promise((resolve, reject) => {
            this.stopChecking();  // 既存のタイマーを停止
            if (this.currentPromise) {
                this.currentPromise.reject();
            }
            this.currentPromise = { resolve, reject };


            const formDefinition = this.getFormDefinition();  // JSON 定義を取得
            player.runCommand(`scriptevent ws:form ${JSON.stringify(formDefinition)}`);

            this.checkInterval = setInterval(() => {
                this.checkResponse(player);
            }, this.checkIntervalMs);

            this.timeoutId = setTimeout(() => {
                this.stopChecking();
                const timeoutResponse: FormResponse = {
                    canceled: true,
                    selection: null,
                };
                if (this.currentPromise) {
                    this.currentPromise.resolve(timeoutResponse);
                    this.currentPromise = undefined;
                }
            }, this.timeoutMs);
        });
    }


    private async checkResponse(player: Player) {
        const objective = await world.scoreboard.getObjective("ws_form_results");
        if (!objective) {
            return;
        }

        const scores = await objective.getScores();

        if (!scores) return;

        const playerScoreInfo = scores.find(scoreInfo => {
            return scoreInfo.participant === player.name;
        });

        if (playerScoreInfo) {
            const score = playerScoreInfo.score;


            const response = this.processScore(score);

            if (this.currentPromise) {
                this.currentPromise.resolve(response);
                this.currentPromise = undefined;
            }
            objective.removeParticipant(playerScoreInfo.participant);
            this.stopChecking();

        }
    }

    protected stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }
}



// Message Form
class MessageFormData extends BaseFormData {
    private button1Text: string = "OK";
    private button2Text: string = "Cancel";

    constructor() {
        super("message");
    }


    button1(text: string): this {
        this.button1Text = text;
        return this;
    }

    button2(text: string): this {
        this.button2Text = text;
        return this;
    }

    protected getFormDefinition(): any {
        return {
            type: this.formType,
            title: this.titleText,
            body: this.bodyText,
            buttons: [this.button1Text, this.button2Text],
        };
    }

    protected processScore(score: number): FormResponse {
        return {
            canceled: score === 0,
            selection: score === 0 ? null : score - 1,  // 0 はキャンセル、1以上はボタンのインデックス
        };
    }
}


// Action Form
class ActionFormData extends BaseFormData {
    private buttonsText: string[] = [];
    private iconPaths: (string | undefined)[] = []; // undefined (空文字列) も許容

    constructor() {
        super("action");
    }

    button(text: string, iconPath?: string): this {
        this.buttonsText.push(text);
        this.iconPaths.push(iconPath);  // undefined も追加
        return this;
    }


    protected getFormDefinition(): any {

        // iconPathsを処理 undefinedの場合は""にする
        const processedIconPaths = this.iconPaths.map(path => path === undefined ? "" : path);


        return {
            type: this.formType,
            title: this.titleText,
            body: this.bodyText,
            buttons: this.buttonsText,
            iconPaths: processedIconPaths, // null, undefined を許容
        };
    }
    protected processScore(score: number): FormResponse {
        return {
            canceled: score === 0,
            selection: score === 0 ? null : score - 1, // 0 はキャンセル, 1以上は選択されたボタンのインデックス
        };
    }
}


export { MessageFormData, ActionFormData, FormResponse };