import { registerCommand, world } from "../../../backend";
import JsonDB from "../../../module/DataBase";
import { MessageFormData, ModalFormData, ActionFormData, FormResponse } from "../../../module/form";
import { Player } from "../../../module/player";
import { disablePlugin, registerPlugin } from "../plugin";

interface MemoData {
    [memoName: string]: string;
}

class MemoManager {
    private db: JsonDB;

    constructor() {
        this.db = new JsonDB("memos");
    }

    async checkFormCreatorEnabled(): Promise<boolean> {
        const objective = await world.scoreboard.getObjective('ws_module');
        if (objective) {
            try {
                const formCreatorScore = await objective.getScore('FormCreator');
                return formCreatorScore === 1;
            } catch (error) {
                console.error("[Memo] Error getting score for FormCreator:", error);
                return false;
            }
        } else {
            console.warn("[Memo] Scoreboard 'ws_module' not found.");
            disablePlugin("memo");
            return false;
        }
    }

    async loadMemos(player: Player): Promise<MemoData> {
        const playerName = player.name;
        const memos = await this.db.get(playerName);
        return memos ?? {};
    }

    async saveMemos(player: Player, memos: MemoData): Promise<void> {
        const playerName = player.name;
        await this.db.set(playerName, memos);
    }

    async createMemo(player: Player, memoName: string): Promise<void> {
        const memos = await this.loadMemos(player);
        if (memos[memoName]) {
            player.sendMessage(`[Memo] §c'${memoName}' という名前のメモは既に存在します。`);
            return;
        }
        memos[memoName] = ""; // 空のメモを作成
        await this.saveMemos(player, memos);
        player.sendMessage(`[Memo] §a'${memoName}' という名前のメモを作成しました。`);
    }

    async viewMemo(player: Player, memoName: string): Promise<void> {
        const memos = await this.loadMemos(player);
        if (memos[memoName] === undefined) {
            player.sendMessage(`[Memo] §c'${memoName}' という名前のメモは見つかりません。`);
            return;
        }
        const memoContent = memos[memoName];

        if (isFormCreatorEnabled) {
            const form = new MessageFormData()
                .title(memoName)
                .body(memoContent)
                .button1("閉じる")
                .button2("編集");


            const response = await form.show(player);
            if (response) {
                if (response.canceled) {
                    player.sendMessage(`[Memo] 表示をキャンセルしました`);
                    return;
                }
                switch (response.selection) {
                    case 0:
                        player.sendMessage(`[Memo] Memoを閉じました`);
                        break;
                    case 1:
                        this.editMemo(player, memoName)
                        break;
                    default:
                        break;
                }
            }

        } else {
            player.sendMessage(`[Memo] §a'${memoName}':\n${memoContent}`);
        }
    }

    async editMemo(player: Player, memoName: string): Promise<void> {
        const memos = await this.loadMemos(player);
        if (memos[memoName] === undefined) {
            player.sendMessage(`[Memo] §c'${memoName}' という名前のメモは見つかりません。`);
            return;
        }

        const currentMemoContent = memos[memoName];
        const modalForm = new ModalFormData();
        modalForm
            .title(`'${memoName}' の編集`)
            .textField("内容", "ここにメモを入力", currentMemoContent);

        const response: FormResponse = await modalForm.show(player);
        if (response.canceled) {
            player.sendMessage("[Memo] §7メモの編集がキャンセルされました。");
            return;
        }

        if (response.result && response.result.length > 0 && typeof response.result[0] === 'string') {
            memos[memoName] = response.result[0];
            await this.saveMemos(player, memos);
            player.sendMessage(`[Memo] §a'${memoName}' を更新しました。`);
        } else {
            player.sendMessage("§c[Memo] データの取得に失敗しました");
        }
    }

    async deleteMemo(player: Player, memoName: string): Promise<void> {
        const memos = await this.loadMemos(player);
        if (memos[memoName] === undefined) {
            player.sendMessage(`[Memo] §c'${memoName}' という名前のメモは見つかりません。`);
            return;
        }

        delete memos[memoName];
        await this.saveMemos(player, memos);
        player.sendMessage(`[Memo] §a'${memoName}' を削除しました。`);
    }

    async listMemos(player: Player): Promise<void> {
        const memos = await this.loadMemos(player);
        const memoNames = Object.keys(memos);

        if (memoNames.length === 0) {
            player.sendMessage("[Memo] §7保存されているメモはありません。");
            return;
        }
        if (isFormCreatorEnabled) {
            const actionForm = new ActionFormData();
            actionForm.title("メモリスト");
            actionForm.body("利用可能なメモの一覧:");

            for (const memoName of memoNames) {
                actionForm.button(memoName);
            }
            const response = await actionForm.show(player);
            if (response.canceled || response.selection === null || typeof response.selection !== 'number') {
                return;
            }
            const selectedMemoName = memoNames[response.selection];
            await memoManager.viewMemo(player, selectedMemoName);
        } else {
            player.sendMessage("[Memo] §a保存されているメモ:");
            for (const memoName of memoNames) {
                player.sendMessage(`- ${memoName}`);
            }
        }
    }
}

let isFormCreatorEnabled: boolean;
const memoManager = new MemoManager();

registerPlugin(
    "memo",
    {
        onEnable: () => {
            console.log("[Memo] Plugin enabled.");
        },
        onDisable: () => {
            console.log("[Memo] Plugin disabled.");
        }
    },
    true,
    async () => {

        setTimeout(async () => {
            isFormCreatorEnabled = await memoManager.checkFormCreatorEnabled();
        }, 40);

        registerCommand({
            name: 'memo',
            description: 'メモ機能',
            maxArgs: Infinity,
            minArgs: 1,
            config: { enabled: true, adminOnly: false, requireTag: [] },
            usage: `<list/create/view/edit/delete> [メモ名]`,
            executor: async (player: Player, args: string[]) => {
                const command = args[0].toLowerCase();

                if (isFormCreatorEnabled === undefined) {
                    player.sendMessage("§c[Memo] 読み込み中です... もう少しお待ちください.");
                    return;
                }

                switch (command) {
                    case 'list':
                        await memoManager.listMemos(player);
                        break;
                    case 'create': {
                        const memoName = args[1];
                        if (!memoName) {
                            player.sendMessage("§c[Memo] メモ名を指定してください。");
                            return;
                        }
                        await memoManager.createMemo(player, memoName);
                        break;
                    }
                    case 'view': {
                        const memoName = args[1];
                        if (!memoName) {
                            player.sendMessage("§c[Memo] メモ名を指定してください。");
                            return;
                        }
                        await memoManager.viewMemo(player, memoName);
                        break;
                    }
                    case 'edit': {
                        const memoName = args[1];
                        if (!memoName) {
                            player.sendMessage("§c[Memo] メモ名を指定してください。");
                            return;
                        }
                        await memoManager.editMemo(player, memoName);
                        break;
                    }
                    case 'delete': {
                        const memoName = args[1];
                        if (!memoName) {
                            player.sendMessage("§c[Memo] メモ名を指定してください。");
                            return;
                        }
                        await memoManager.deleteMemo(player, memoName);
                        break;
                    }
                    default:
                        player.sendMessage(`§c[Memo] コマンドが間違っています。使い方:  /memo <list/create/view/edit/delete> [メモ名]`);
                }
            }
        });
    }
);