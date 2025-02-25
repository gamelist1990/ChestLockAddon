import { Player, system, world } from "@minecraft/server";
import { Handler } from "../../../module/Handler";




export function registerChangeTagCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('changeTag', {
        moduleName: moduleName,
        description: `指定されたタグを持つプレイヤーのタグを別のタグに変更します。`,
        usage: `changeTag <元のタグ>,<新しいタグ>\n  <元のタグ>: 変更前のタグ。\n  <新しいタグ>: 変更後のタグ。`,
        execute: (message, event) => {
            const consoleOutput = (message: string) => {
                console.warn(message);
            };

            const sendMessage = (message: string) => {
                if (event.sourceEntity instanceof Player) {
                    const player = event.sourceEntity;
                    system.run(() => player.sendMessage(message));
                } else {
                    consoleOutput(message); // コマンドブロックなどからの実行時はコンソールへ
                }
            };

            const args = message.split(/\s*,\s*/); // カンマ区切りで分割

            if (args.length !== 2) {
                sendMessage('使用方法: ws:changeTag <元のタグ>,<新しいタグ>');
                return;
            }

            const oldTag = args[0];
            const newTag = args[1];

            let changedCount = 0;
            for (const player of world.getPlayers()) {
                if (player.hasTag(oldTag)) {
                    try {
                        player.removeTag(oldTag);
                        player.addTag(newTag);
                        changedCount++;
                    } catch (error) {
                        consoleOutput(`タグ変更中にエラーが発生しました: ${error}`);
                        sendMessage(`プレイヤー ${player.name} のタグ変更中にエラーが発生しました。`);
                    }
                }
            }

            if (changedCount > 0) {
                //sendMessage(`${changedCount} 人のプレイヤーのタグを ${oldTag} から ${newTag} に変更しました。`);
            } else {
                // sendMessage(`タグ ${oldTag} を持つプレイヤーは見つかりませんでした。`);
            }
        },
    });
}