import { world, system, Player } from '@minecraft/server';
import { Handler } from '../../../module/Handler';

export function registerNumberCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('number', {
        moduleName: moduleName,
        description: `指定された数値の中からランダムに1つを選び、'ws_number' スコアボードに設定します。`,
        usage: `number <数値1>,<数値2>,...\n  <数値1>,<数値2>,...: カンマ区切りの数値リスト。`,
        execute: (message, event) => {
            const consoleOutput = (message: string) => {
                console.warn(message);
            };

            // コマンドブロックからの実行かどうかで処理を分岐
            const sendMessage = (message: string) => {
                if (event.sourceEntity instanceof Player) {
                    const player = event.sourceEntity;
                    system.run(() => player.sendMessage(message));
                } else {
                    consoleOutput(message);
                }
            };

            const args = message.split(/\s*,\s*/); // カンマ区切りで分割
            const numbers: number[] = [];

            for (const arg of args) {
                const num = parseInt(arg);
                if (isNaN(num)) {
                    sendMessage(`無効な数値: ${arg}`);
                    return;
                }
                numbers.push(num);
            }

            if (numbers.length === 0) {
                sendMessage('数値を1つ以上指定してください。');
                return;
            }

            const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];

            let objective = world.scoreboard.getObjective('ws_number'); // スコアボード名
            if (!objective) {
                objective = world.scoreboard.addObjective('ws_number', 'ランダム数値');
            }

            objective.setScore('number', randomNumber); // "number" という参加者にスコアを設定

            // コマンドブロックからの実行の場合はコンソールに結果を出力
            if (!(event.sourceEntity instanceof Player)) {
                consoleOutput(`設定された数値: ${randomNumber}`);
            }
        },
    });
}