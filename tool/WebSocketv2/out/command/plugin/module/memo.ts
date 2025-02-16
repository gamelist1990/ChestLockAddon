import { prefix, registerCommand, world } from "../../../backend";
import JsonDB from "../../../module/DataBase"; 
import { MessageFormData } from "../../../module/form";
import { Player } from "../../../module/player";
import { disablePlugin, registerPlugin } from "../plugin";

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

    async loadMemo(player: Player): Promise<string> {
        const playerName = player.name;
        const memo = await this.db.get(playerName);
        return memo ?? "";
    }

    async saveMemo(player: Player, content: string): Promise<void> {
        const playerName = player.name;
        await this.db.set(playerName, content);
    }

    async clearMemo(player: Player): Promise<void> {
        const playerName = player.name;
        await this.db.delete(playerName);
    }
}

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
        let isFormCreatorEnabled: boolean;

        setTimeout(async () => {
            isFormCreatorEnabled = await memoManager.checkFormCreatorEnabled();
        }, 40);

        registerCommand({
            name: 'memo',
            description: 'メモ機能(実験)',
            maxArgs: Infinity,
            minArgs: 1,
            config: { enabled: true, adminOnly: false, requireTag: [] },
            usage: `<show/save/clear> [内容]`,
            executor: async (player: Player, args: string[]) => {
                const command = args[0].toLowerCase();

                if (isFormCreatorEnabled === undefined) {
                    player.sendMessage("§c[Memo] 読み込み中です... もう少しお待ちください.");
                    return;
                }

                if (command === 'show') {
                    const memoContent = await memoManager.loadMemo(player);
                    if (isFormCreatorEnabled) {
                        const messageForm = new MessageFormData

                        messageForm
                            .title("メモ")
                            .body(memoContent)
                            .button1("Ok");

                        const response = await messageForm.show(player);
                        if (response.canceled) {
                            player.sendMessage(`cancelしました`);
                            return;
                        }
                        switch (response.selection) {
                            case 0:
                                player.sendMessage(`メモを閉じました`)
                                break;
                            case 1:
                                player.sendMessage(`メモを閉じました`)
                                break;
                            default:
                                break;
                        }
                    } else {
                        const lines = memoContent.split('\n');
                        for (const line of lines) {
                            player.sendMessage(`[Memo] ${line}`);
                        }
                    }
                } else if (command === 'save') {
                    const content = args.slice(1).join(' ');
                    await memoManager.saveMemo(player, content);
                    player.sendMessage("[Memo] §6メモをセーブしました");
                } else if (command === 'clear') {
                    await memoManager.clearMemo(player);
                    player.sendMessage("[Memo] §aメモをクリアしました");
                } else {
                    player.sendMessage(`§c[Memo] コマンドが間違ってるよ. 使い方: ${prefix}memo <show/save/clear>`);
                }
            }
        });
    }
);