import { Player, world } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { Handler } from "../../../module/Handler";


export function registerScoreDeleteCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('scoreDelete', {
        moduleName: moduleName,
        description: `スコアボードを削除するためのフォームを表示、または 'ws_module' 以外の 'ws_' で始まる全てのスコアボードを一括削除します。`,
        usage: `scoreDelete form\n  form: 削除するスコアボードを選択するフォームを表示します。\nscoreDelete all\n all: 'ws_module' 以外の 'ws_' で始まる全てのスコアボードを削除します。`,
        execute: async (message, event) => {
            if (!(event.sourceEntity instanceof Player)) {
                console.warn('このコマンドはプレイヤーからのみ実行できます。');
                return;
            }

            const player = event.sourceEntity;
            const args = message.split(/\s+/);

            switch (args[0]) {
                case 'form':
                    await showDeleteForm(player);
                    break;
                case 'all':
                    await confirmAndDeleteAll(player);
                    break;
                default:
                    player.sendMessage(
                        `scoreDelete form\n  form: 削除するスコアボードを選択するフォームを表示します。\nscoreDelete all\n all: 'ws_module' 以外の 'ws_' で始まる全てのスコアボードを削除します。`,
                    );
                    break;
            }
        },
    });

    /**
 * スコアボード削除フォームを表示する
 * @param {Player} player
 */
    async function showDeleteForm(player: Player) {
        const form = new ActionFormData();
        form.title('スコアボード削除');
        form.body('削除するws_から始まるスコアボードを選択してください:');

        const wsObjectives = world.scoreboard
            .getObjectives()
            .filter((obj) => obj.id.startsWith('ws_'));

        if (wsObjectives.length === 0) {
            player.sendMessage('削除可能なスコアボードがありません。');
            return;
        }

        for (const objective of wsObjectives) {
            form.button(objective.id);
        }
        form.button('閉じる'); // 閉じるボタンを追加

        //@ts-ignore
        const response = await form.show(player);

        if (response.canceled || response.selection === wsObjectives.length) {
            // キャンセルされた場合、または「閉じる」ボタンが押された場合は何もしない
            return;
        }
        const selectedObjectiveId = wsObjectives[response.selection!].id;
        await confirmAndDelete(player, selectedObjectiveId);
    }

    /**
     * 削除確認と削除処理 (単一)
     * @param {Player} player
     * @param {string} objectiveId
     */
    async function confirmAndDelete(player: Player, objectiveId: string) {
        const confirmForm = new MessageFormData();
        confirmForm.title('スコアボード削除確認');
        confirmForm.body(`本当にスコアボード "${objectiveId}" を削除しますか？`);
        confirmForm.button1('はい');
        confirmForm.button2('いいえ');

        //@ts-ignore
        const confirmResponse = await confirmForm.show(player);
        if (confirmResponse.selection === 0) {
            try {
                world.scoreboard.removeObjective(objectiveId);
                player.sendMessage(`スコアボード "${objectiveId}" を削除しました。`);
            } catch (error) {
                console.error(`スコアボード削除エラー: ${error}`);
                player.sendMessage(`スコアボード "${objectiveId}" の削除中にエラーが発生しました。`);
            }
            await showDeleteForm(player); // リストを再表示
        } else if (confirmResponse.selection === 1) {
            player.sendMessage(`スコアボード "${objectiveId}" の削除をキャンセルしました`);
            await showDeleteForm(player); // リストを再表示
        }
    }
    /**
     * 一括削除の確認と削除処理
     * @param {Player} player
     */
    async function confirmAndDeleteAll(player: Player) {
        const confirmForm = new MessageFormData();
        confirmForm.title('スコアボード一括削除確認');
        confirmForm.body(
            '本当に ws_module 以外の ws_ から始まるすべてのスコアボードを削除しますか？',
        );
        confirmForm.button1('はい');
        confirmForm.button2('いいえ');

        //@ts-ignore
        const confirmResponse = await confirmForm.show(player);

        if (confirmResponse.selection === 0) {
            const objectivesToRemove = world.scoreboard
                .getObjectives()
                .filter((obj) => obj.id.startsWith('ws_') && obj.id !== 'ws_module');

            if (objectivesToRemove.length === 0) {
                player.sendMessage('削除対象のスコアボードがありません。');
                return;
            }

            for (const objective of objectivesToRemove) {
                try {
                    world.scoreboard.removeObjective(objective.id);
                } catch (error) {
                    console.error(`スコアボード削除エラー: ${error}`);
                    player.sendMessage(`スコアボード "${objective.id}" の削除中にエラーが発生しました。`);
                    return; // エラーが発生したら処理を中断
                }
            }
            player.sendMessage('ws_module 以外の ws_ から始まるすべてのスコアボードを削除しました。');
            await showDeleteForm(player); // リストを再表示
        } else if (confirmResponse.selection === 1) {
            player.sendMessage('スコアボードの一括削除をキャンセルしました');
            await showDeleteForm(player); // リストを再表示
        }
    }
}