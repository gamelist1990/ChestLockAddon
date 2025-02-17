import { world } from "../backend";
import { Player } from "./player";

const DEV_MODE = false;

// デバッグログ出力関数
function logDebug(...args: any[]) {
    if (DEV_MODE) {
        console.log(...args);
    }
}
function logWarn(...args: any[]) {
    if (DEV_MODE) {
        console.warn(...args);
    }
}
function logError(...args: any[]) {
    console.error(...args);
}
// フォームの応答を表すインターフェース (MessageForm, ActionForm, ModalForm 共通)
interface FormResponse {
    canceled: boolean;
    selection: number | null | (number | string | boolean | null)[]; // ModalForm の場合は配列
    result?: (number | string | boolean | null)[]; // Modal Formの結果を格納するプロパティを追加
}

// フォームの種類を表す型
type FormType = "message" | "action" | "modal";

// 基底クラス (共通処理)
abstract class BaseFormData {
    protected titleText: string = "";
    protected bodyText: string = "";
    protected checkInterval: NodeJS.Timer | undefined;
    protected timeoutId: NodeJS.Timer | undefined;
    protected readonly checkIntervalMs = 100;
    protected readonly timeoutMs = 120000;
    protected currentPromise: { resolve: (value: FormResponse) => void; reject: (reason?: any) => void; } | undefined;
    public readonly formType: FormType;
    private isResolved: boolean = false; //追加

    constructor(formType: FormType) {
        this.formType = formType;
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
    protected abstract processScore(score: number, player: Player): Promise<FormResponse>; // player を引数に追加

    async show(player: Player): Promise<FormResponse> {
        logDebug(`[BaseFormData.show] プレイヤー ${player.name} にフォームを表示します。`);
        const objective = await world.scoreboard.getObjective('ws_module');
        if (!objective) {
            logError("[BaseFormData.show] ws_module オブジェクティブが見つかりません。");
            return Promise.reject();
        }

        let formCreatorScore = 0;
        try {
            const score = await objective.getScore('FormCreator');
            formCreatorScore = score === null ? 0 : score;
        } catch (error) {
            logWarn("[BaseFormData.show] FormCreator のスコア取得中にエラーが発生しましたが、続行します。", error);
        }
        if (formCreatorScore !== 1) {
            logError("[BaseFormData.show] FormCreator のスコアが 1 ではありません。フォームは表示できません。");
            return Promise.reject();
        }

        return new Promise((resolve, reject) => {
            this.stopChecking();  // 既存のタイマーを停止
            if (this.currentPromise) {
                logWarn("[BaseFormData.show] 前のフォームのリクエストが残っていたため、中断します。");
                this.currentPromise.reject();
            }
            this.currentPromise = { resolve, reject };
            this.isResolved = false;//追加

            const formDefinition = this.getFormDefinition();  // JSON 定義を取得
            logDebug("[BaseFormData.show] フォーム定義:", JSON.stringify(formDefinition));
            player.runCommand(`scriptevent ws:form ${JSON.stringify(formDefinition)}`);
            logDebug(`[BaseFormData.show] プレイヤー ${player.name} に scriptevent ws:form を送信しました。`);


            this.checkInterval = setInterval(() => {
                this.checkResponse(player);
            }, this.checkIntervalMs);

            this.timeoutId = setTimeout(() => {

                if (this.currentPromise && !this.isResolved) {//修正
                    this.stopChecking();
                    const timeoutResponse: FormResponse = {
                        canceled: true,
                        selection: null,
                    };

                    logWarn(`[BaseFormData.show] フォーム表示がタイムアウトしました。プレイヤー: ${player.name}`);
                    this.currentPromise.resolve(timeoutResponse);
                    this.currentPromise = undefined;

                }
            }, this.timeoutMs);
            logDebug(`[BaseFormData.show] フォームのチェック間隔とタイムアウトを設定しました。プレイヤー: ${player.name}`);
        });
    }

    private async checkResponse(player: Player) {
        if (this.isResolved) { //追加
            return;
        }
        const objective = await world.scoreboard.getObjective("ws_form_results");
        if (!objective) {
            logWarn("[BaseFormData.checkResponse] ws_form_results オブジェクティブが見つかりません。");
            return;
        }

        const scores = await objective.getScores();

        if (!scores) {
            logWarn("[BaseFormData.checkResponse] スコアが取得できませんでした。");
            return;
        }
        const formDefinition = this.getFormDefinition();
        const formDefinitionString = JSON.stringify(formDefinition);

        if (this.formType === "modal") {
            // ModalFormの場合、すべてのスコアをチェック

            const keyPrefix = player.name; // プレイヤー名で始まることを利用
            const playerScoreInfo = scores.find(scoreInfo => {
                return scoreInfo.participant.startsWith(keyPrefix) && scoreInfo.participant.includes(formDefinitionString)
            });

            if (playerScoreInfo) {
                logDebug(`[BaseFormData.checkResponse] ModalForm の結果が見つかりました。プレイヤー: ${player.name}, スコア情報:`, playerScoreInfo);
                const score = playerScoreInfo.score;
                const response = await this.processScore(score, player); // playerを渡す
                if (this.currentPromise && !this.isResolved) {
                    this.currentPromise.resolve(response);
                    this.currentPromise = undefined;
                    this.isResolved = true; //追加
                }
                this.stopChecking(); //ここへ移動
                objective.removeParticipant(playerScoreInfo.participant);
                logDebug(`[BaseFormData.checkResponse] ModalForm の結果を処理し、タイマーを停止しました。プレイヤー: ${player.name}`);
            }
        } else {
            // MessageForm, ActionForm
            // プレイヤー名 + フォーム定義文字列 + スコア で完全一致検索
            const playerScoreInfo = scores.find(scoreInfo => {
                return scoreInfo.participant.startsWith(player.name + formDefinitionString);
            });
            if (playerScoreInfo) {
                logDebug(`[BaseFormData.checkResponse] ${this.formType === "message" ? "MessageForm" : "ActionForm"} の結果が見つかりました。プレイヤー: ${player.name}, スコア:`, playerScoreInfo.score);
                const score = playerScoreInfo.score;
                const response = await this.processScore(score, player); // playerを渡す

                if (this.currentPromise && !this.isResolved) {
                    this.currentPromise.resolve(response);
                    this.currentPromise = undefined;
                    this.isResolved = true;
                }
                this.stopChecking();//ここへ移動
                objective.removeParticipant(playerScoreInfo.participant);
                logDebug(`[BaseFormData.checkResponse] ${this.formType === "message" ? "MessageForm" : "ActionForm"} の結果を処理し、タイマーを停止しました。プレイヤー: ${player.name}`);
            }
        }
    }

    protected stopChecking() {

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
            logDebug("[BaseFormData.stopChecking] チェック間隔タイマーを停止しました。");
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
            logDebug("[BaseFormData.stopChecking] タイムアウトタイマーを停止しました。");
        }
    }
}

// Message Form
class MessageFormData extends BaseFormData {
    private button1Text: string = "OK";
    private button2Text?: string;

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
        const buttons = [this.button1Text];
        if (this.button2Text) {
            buttons.push(this.button2Text);
        }

        return {
            type: this.formType,
            title: this.titleText,
            body: this.bodyText,
            buttons: buttons,
        };
    }

    protected async processScore(score: number, _player: Player): Promise<FormResponse> {
        logDebug(`[MessageFormData.processScore] スコア: ${score}`);
        const response = {
            canceled: score === 0,
            selection: score === 0 ? null : score - 1,
        };
        logDebug("[MessageFormData.processScore] レスポンス:", response);
        return response;
    }
}

// Action Form
class ActionFormData extends BaseFormData {
    private buttonsText: string[] = [];
    private iconPaths: (string | undefined)[] = [];

    constructor() {
        super("action");
    }

    button(text: string, iconPath?: string): this {
        this.buttonsText.push(text);
        this.iconPaths.push(iconPath);
        return this;
    }

    protected getFormDefinition(): any {
        const processedIconPaths = this.iconPaths.map(path => path === undefined ? "" : path);

        return {
            type: this.formType,
            title: this.titleText,
            body: this.bodyText,
            buttons: this.buttonsText,
            iconPaths: processedIconPaths,
        };
    }

    protected async processScore(score: number, _player: Player): Promise<FormResponse> { // player引数追加
        logDebug(`[ActionFormData.processScore] スコア: ${score}`);
        const response = {
            canceled: score === 0,
            selection: score === 0 ? null : score - 1,
        };
        logDebug("[ActionFormData.processScore] レスポンス:", response);
        return response;

    }
}

// Modal Form
class ModalFormData extends BaseFormData {
    private dropdownsData: { label: string; options: string[]; defaultIndex?: number }[] = [];
    private inputsData: { label: string; placeholder?: string; defaultValue?: string }[] = [];
    private togglesData: { label: string; defaultValue?: boolean }[] = [];
    private slidersData: { label: string; min: number; max: number; step?: number; defaultValue?: number }[] = [];

    constructor() {
        super("modal");
    }

    dropdown(label: string, options: string[], defaultIndex?: number): this {
        this.dropdownsData.push({ label, options, defaultIndex });
        return this;
    }

    textField(label: string, placeholder?: string, defaultValue?: string): this {
        this.inputsData.push({ label, placeholder, defaultValue });
        return this;
    }

    toggle(label: string, defaultValue?: boolean): this {
        this.togglesData.push({ label, defaultValue });
        return this;
    }

    slider(label: string, min: number, max: number, step?: number, defaultValue?: number): this {
        this.slidersData.push({ label, min, max, step, defaultValue });
        return this;
    }

    protected getFormDefinition(): any {
        return {
            type: this.formType,
            title: this.titleText,
            dropdowns: this.dropdownsData,
            inputs: this.inputsData,
            toggles: this.togglesData,
            sliders: this.slidersData,
        };
    }

    protected async processScore(score: number, player: Player): Promise<FormResponse> {
        logDebug(`[ModalFormData.processScore] スコア: ${score}, プレイヤー: ${player.name}`);
        if (score === 0) {
            logDebug("[ModalFormData.processScore] スコアが 0 なので、キャンセルされました。");
            return {
                canceled: true,
                selection: [],
                result: []
            };
        }

        const objective = await world.scoreboard.getObjective("ws_form_results");
        if (!objective) {
            logError("[ModalFormData.processScore] ws_form_results オブジェクティブが見つかりません。");
            return { canceled: true, selection: [], result: [] }; // objective がない場合はキャンセル扱い
        }
        const formDefinition = this.getFormDefinition();
        const keyPrefix = player.name; //プレイヤー名

        const scores = await objective.getScores(); // すべてのスコアを取得

        // プレイヤー名で始まり、かつフォーム定義を含むスコアを検索
        const playerScoreInfo = scores.find(scoreInfo => {
            return scoreInfo.participant.startsWith(keyPrefix) && scoreInfo.participant.includes(JSON.stringify(formDefinition))
        });

        if (!playerScoreInfo) {
            logWarn("[ModalFormData.processScore] 該当するスコアが見つかりません。");
            return { canceled: true, selection: [], result: [] }; // 該当するスコアがない場合もキャンセル扱い
        }

        // スコアが1 (成功) の場合、participant から結果を抽出
        try {
            const participantData = playerScoreInfo.participant;
            const resultStartIndex = participantData.indexOf(JSON.stringify(formDefinition)) + JSON.stringify(formDefinition).length;
            const resultString = participantData.substring(resultStartIndex);
            logDebug("[ModalFormData.processScore] 抽出された結果文字列:", resultString);
            const result = JSON.parse(resultString);
            logDebug("[ModalFormData.processScore] パースされた結果:", result);

            const response = {
                canceled: false,
                selection: result, // 配列全体を selection とする
                result: result,
            }
            logDebug("[ModalFormData.processScore] レスポンス:", response);
            return response;

        } catch (error) {
            logError("[ModalFormData.processScore] Modal フォームの結果のパース中にエラーが発生しました:", error);
            return { canceled: true, selection: [], result: [] }; // パースエラー時もキャンセル扱い
        }
    }
}

export { MessageFormData, ActionFormData, ModalFormData, FormResponse };