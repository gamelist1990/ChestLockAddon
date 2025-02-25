import { Player, system, world, Vector3 } from "@minecraft/server";
import { Handler } from "../../../module/Handler";

export function registerCloneBlockCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('cloneBlock', {
        moduleName: moduleName,
        description: '指定された座標のブロックを別の座標にクローンします。',
        usage:
            'cloneBlock <JSON>\n  <JSON>: {"form":[{"x":0,"y":64,"z":0},...],"to":[{"x":10,"y":64,"z":10},...]}',
        execute: (_message, event) => {
            const consoleOutput = (message: string) => {
                console.warn(message);
            };

            const sendMessage = (message: string) => {
                if (event.sourceEntity instanceof Player) {
                    const player = event.sourceEntity;
                    system.run(() => player.sendMessage(message));
                } else {
                    consoleOutput(message);
                }
            };

            try {
                const matchResult = event.message.match(/\{.*\}/);
                if (!matchResult) {
                    sendMessage('JSONオブジェクトが見つかりませんでした。');
                    return;
                }

                const cloneDataStr = matchResult[0];
                const cloneData = JSON.parse(cloneDataStr);

                if (!cloneData.form || !cloneData.to) {
                    sendMessage('JSONオブジェクトは "form" と "to" 配列を含む必要があります。');
                    return;
                }

                if (!Array.isArray(cloneData.form) || !Array.isArray(cloneData.to)) {
                    sendMessage('"form" と "to" は配列である必要があります。');
                    return;
                }

                if (cloneData.form.length === 0) {
                    sendMessage('"form" 配列は空にできません。');
                    return;
                }

                if (cloneData.to.length === 0) {
                    sendMessage('"to" 配列は空にできません。');
                    return;
                }

                if (cloneData.form.length !== cloneData.to.length) {
                    sendMessage('"form" 配列と "to" 配列の長さは同じである必要があります。');
                    return;
                }

                const dimension = event.sourceEntity?.dimension ?? world.getDimension('overworld');

                for (let i = 0; i < cloneData.form.length; i++) {
                    const from = cloneData.form[i];
                    const to = cloneData.to[i];

                    if (
                        typeof from.x !== 'number' ||
                        typeof from.y !== 'number' ||
                        typeof from.z !== 'number' ||
                        typeof to.x !== 'number' ||
                        typeof to.y !== 'number' ||
                        typeof to.z !== 'number'
                    ) {
                        sendMessage('座標は数値で指定してください。');
                        return;
                    }

                    const fromLocation: Vector3 = (from.x, from.y, from.z);
                    const toLocation: Vector3 = (to.x, to.y, to.z);

                    try {
                        const fromBlock = dimension.getBlock(fromLocation);
                        if (!fromBlock) {
                            consoleOutput(
                                `From座標 (${fromLocation.x}, ${fromLocation.y}, ${fromLocation.z}) にブロックが見つかりませんでした。`,
                            );
                            continue;
                        }
                        const fromPermutation = fromBlock.permutation;
                        dimension.getBlock(toLocation)?.setPermutation(fromPermutation);
                    } catch (error) {
                        consoleOutput(`クローン中にエラーが発生しました: ${error}`);
                        sendMessage(`クローン中にエラーが発生しました: ${error}`);
                        return;
                    }
                }
            } catch (error) {
                consoleOutput(`JSON解析エラー、または処理中にエラーが発生しました: ${error}`);
                sendMessage(`JSON解析エラー、または処理中にエラーが発生しました: ${error}`);
            }
        },
    });
}