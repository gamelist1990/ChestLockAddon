import {
    world,
    system,
    ScoreboardIdentity,
    ScoreboardObjective,
    Player
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';
import { Handler } from '../../module/Handler';
import { ActionFormData, MessageFormData, uiManager } from '@minecraft/server-ui';

/**
 * Formats a given timestamp into a string with the format `YYYY/MM/DD HH:mm:ss` adjusted for a specified timezone offset.
 *
 * @param {string | number | Date} timestamp - The timestamp to format. Can be a string, number, or Date object.
 * @param {number} timezoneOffsetHours - The timezone offset in hours to adjust the timestamp.
 * @returns {string} The formatted timestamp string. Returns 'Invalid Timestamp' if the input is invalid, or 'Unexpected Error' if an unexpected error occurs.
 */
export function formatTimestamp(
    timestamp: string | number | Date,
    timezoneOffsetHours: number,
): string {
    if (timestamp == null) {
        return '';
    }

    let date: Date;

    try {
        if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string') {
            const parsedDate = new Date(Date.parse(timestamp));
            if (isNaN(parsedDate.getTime())) {
                console.error('Invalid timestamp string:', timestamp);
                return 'Invalid Timestamp';
            }
            date = parsedDate;
        } else {
            console.error('Invalid timestamp type:', timestamp, typeof timestamp);
            return 'Invalid Timestamp';
        }

        if (isNaN(date.getTime())) {
            console.error('Invalid timestamp:', timestamp);
            return 'Invalid Timestamp';
        }

        const timezoneOffsetMilliseconds = timezoneOffsetHours * 60 * 60 * 1000;
        const adjustedDate = new Date(date.getTime() + timezoneOffsetMilliseconds);
        const year = adjustedDate.getFullYear();
        const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getDate()).padStart(2, '0');
        const hours = String(adjustedDate.getHours()).padStart(2, '0');
        const minutes = String(adjustedDate.getMinutes()).padStart(2, '0');
        const seconds = String(adjustedDate.getSeconds()).padStart(2, '0');

        const formattedTimestamp = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        return formattedTimestamp;
    } catch (error) {
        console.error('An unexpected error occurred:', error);
        return 'Unexpected Error';
    }
}

let serverStartTime: number | null = null;

function getServerUptime(): string {
    if (serverStartTime === null) {
        serverStartTime = Date.now();
        return '0d 0h 0m 0s'; // 初回呼び出し時は秒も表示
    }

    const elapsedMilliseconds = Date.now() - serverStartTime;
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const elapsedDays = Math.floor(elapsedHours / 24);

    const hours = elapsedHours % 24;
    const minutes = elapsedMinutes % 60;
    const seconds = elapsedSeconds % 60;

    return `${elapsedDays}d ${hours}h ${minutes}m ${seconds}s`;
}

// system.run を使って定期的に実行することで、serverStartTime が null でないことを保証
system.runInterval(() => {
    if (serverStartTime === null) {
        serverStartTime = Date.now();
    }
}, 20);

// 日時をフォーマットする関数 (JST)
export function formatTimestampJST(date: Date): string {
    const jstOffset = 9 * 60; // JSTはUTC+9時間なので、分単位でオフセット
    const localDate = new Date(date.getTime() + jstOffset * 60 * 1000);

    const hours = localDate.getUTCHours().toString().padStart(2, '0');
    const minutes = localDate.getUTCMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
}

const ver = '0.0.1';

class ScoreModule implements Module {
    name = 'ScoreModule';
    enabledByDefault = true;
    docs = `§lコマンド一覧§r\n
§b- resetScore <スコアボード名|-all>§r: 指定したスコアボード、または全てのスコアボードのスコアをリセットします。\n
  §7<スコアボード名>§r: リセットするスコアボードの名前。\n
  §7-all§r: 全てのスコアボードをリセット。\n
§b- number <数値1>,<数値2>,...§r: 指定された数値の中からランダムに1つを選び、'ws_number' スコアボードに設定します。\n
  §7<数値1>,<数値2>,...§r: カンマ区切りの数値リスト。\n
§b- score=<コピー元スコアボード名>§r: 指定したスコアボードの値を 'ws_<スコアボード名>' にコピー。以下のプレースホルダーが使用可能です:\n
  §7[allPlayer]§r: 全プレイヤー数\n
  §7[uptime]§r: サーバー稼働時間\n
  §7[ver]§r: スクリプトバージョン\n
  §7[time]§r: 現在時刻 (時:分)\n
  §7[tag=<タグ名>]§r: 指定したタグを持つプレイヤー数\n
  §7[score=<スコアボード名>]§r: 指定したスコアボードの最高スコア\n
  §7[score=<スコアボード名>,<プレイヤー名>]§r: 指定したスコアボードの指定したプレイヤーのスコア\n
  §7[scoreN=<スコアボード名>]§r: 指定したスコアボードの最初の参加者の名前（参加者がいない場合は'0'）\n
  §7[scoreN=<スコアボード名>, <プレイヤー名>]§r: 指定したスコアボードの指定したプレイヤーの名前。見つからない場合は'0'\n
§b- team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボード名>§r: 指定した条件でプレイヤーをチーム分けし、スコアボードに記録します。\n
  §7<チーム数>§r: 作成するチームの数。\n
  §7<チーム内上限人数>§r: 各チームの最大人数。\n
  §7<タグ名>§r: チーム分けの対象となるプレイヤーが持つタグ。\n
  §7<スコアボード名>§r: チーム番号を記録するスコアボード名。\n
§b- scoreDelete form§r: スコアボードを削除するためのフォームを表示します。\n
§b- scoreDelete all§r: 'ws_module' 以外の 'ws_' で始まる全てのスコアボードを一括削除します。\n
§b- teamCount <チームタグ1,チームタグ2,...> <JSON> [true]§r: 指定したタグを持つプレイヤー数に基づき、コマンドを実行します。\n
  §7<チームタグ1,チームタグ2,...>§r: カンマ区切りのチームタグ。\n
  §7<JSON>§r: チームタグとコマンドの対応を記述したJSON配列。例: [{"team1":"cmd1"},{"team2":"cmd2"}]\n
  §7[true]§r: (オプション) 最大人数のチームを比較してコマンド実行。指定がない場合は、0人になったチームを検知してコマンド実行。同人数の場合は"same"キーのコマンド実行。\n
§b- meiro <JSON>§r: 指定したJSON設定に基づいて迷路を生成します（※ コマンド未実装）。\n
  §7<JSON>§r: 迷路の構造を定義するJSON。例: {"start": ["emerald_block"], "end": ["redstone_block"], "level": "easy", "height": 10, "wall": "oak_log", "floor": "stone"}`;





    // Handler を使ったコマンド登録
    registerCommands(handler: Handler): void {
        handler.registerCommand('resetScore', {
            moduleName: this.name,
            description: `指定したスコアボード、または全てのスコアボードのスコアをリセットします。`,
            usage: `resetScore <スコアボード名|-all>\n  <スコアボード名>: リセットするスコアボードの名前。\n  -all: 全てのスコアボードをリセット。`,
            execute: (message, event) => {
                const args = message.split(/\s+/);

                const sendMessage = (message: string) => {
                    if (event.sourceEntity instanceof Player) {
                        const player = event.sourceEntity;
                        system.run(() => player.sendMessage(message));
                    }
                };

                if (args.length < 1) {
                    sendMessage('引数が不足しています。使用方法: ws:resetScore <スコアボード名| -all>');
                    return;
                }

                const target = args[0];

                if (target === '-all') {
                    for (const objective of world.scoreboard.getObjectives()) {
                        this.resetScoreboard(objective, sendMessage);
                    }
                    sendMessage('全てのスコアボードのスコアをリセットしました。');
                } else {
                    const objective = world.scoreboard.getObjective(target);
                    if (!objective) {
                        sendMessage(`スコアボード '${target}' が見つかりません。`);
                        return;
                    }
                    this.resetScoreboard(objective, sendMessage);
                    sendMessage(`スコアボード '${target}' のスコアをリセットしました。`);
                }
            },
        });

        handler.registerCommand('number', {
            moduleName: this.name,
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

        handler.registerCommand('score', {
            moduleName: this.name,
            description: `指定したスコアボードの値を 'ws_<スコアボード名>' にコピーします。特殊なプレースホルダーも置換します。`,
            usage: `score=<コピー元スコアボード名>\n  [allPlayer], [uptime], [ver], [time], [tag=<タグ名>], [score=<スコアボード名>], [score=<スコアボード名>,<プレイヤー名>], [scoreN=<スコアボード名>], [scoreN=<スコアボード名>, <プレイヤー名>]が使用可能`,
            execute: (message, event) => {
                try {
                    const scoreboardName = message.split('=')[1];
                    const originalScoreboard = world.scoreboard.getObjective(scoreboardName);

                    if (!originalScoreboard) {
                        const errorMessage = `スコアボード "${scoreboardName}"が見つかりませんでした。`;
                        console.error(errorMessage);
                        if (event.sourceEntity instanceof Player) {
                            const player = event.sourceEntity;
                            system.run(() => player.sendMessage(errorMessage));
                        }
                        return;
                    }

                    const displayScoreboardName = `ws_${originalScoreboard.id}`;
                    let displayScoreboard = world.scoreboard.getObjective(displayScoreboardName);
                    if (!displayScoreboard) {
                        displayScoreboard = world.scoreboard.addObjective(
                            displayScoreboardName,
                            originalScoreboard.displayName,
                        );
                    }

                    // displayScoreboard の参加者を一旦すべて削除
                    for (const participant of displayScoreboard.getParticipants()) {
                        displayScoreboard.removeParticipant(participant);
                    }

                    for (const participant of originalScoreboard.getParticipants()) {
                        const score = originalScoreboard.getScore(participant);
                        if (score !== undefined) {
                            // プレースホルダーを解決してスコアを設定
                            const resolvedName = resolvePlayerName(participant.displayName);
                            displayScoreboard.setScore(resolvedName, score);
                        }
                    }
                } catch (error) {
                    const errorMessage = `スコアボード更新処理中にエラーが発生しました: ${error}`;
                    console.error(errorMessage);
                    if (event.sourceEntity instanceof Player) {
                        const player = event.sourceEntity;
                        system.run(() => player.sendMessage(errorMessage));
                    }
                }
            },
        });

        handler.registerCommand('team', {
            moduleName: this.name,
            description: `指定した条件に基づいてプレイヤーをチーム分けし、スコアボードに記録します。`,
            usage: `team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボード名>\n  <チーム数>: 作成するチームの数。\n  <チーム内上限人数>: 各チームの最大人数。\n  <タグ名>: チーム分け対象のプレイヤーが持つタグ。\n  <スコアボード名>: チーム番号を記録するスコアボードの名前。`,
            execute: (message, event) => {
                const args = message.replace(/^\/team\s+/, '').split(/\s+/);

                // メッセージ送信関数を定義（プレイヤーとコンソールで処理を分ける）
                const sendMessage = (message: string) => {
                    if (event.sourceEntity instanceof Player) {
                        const player = event.sourceEntity;
                        system.run(() => player.sendMessage(message));
                    } else {
                        console.warn(message);
                    }
                };

                if (args.length === 0) {
                    sendMessage(
                        '使用方法: /ws:team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボードタイトル>',
                    );
                    return;
                }

                const subcommand = args[0];

                if (subcommand === 'set') {
                    if (args.length < 4) {
                        sendMessage(
                            '引数が不足しています。使用方法: /ws:team set <チーム数>:<チーム内上限人数> <タグ名> <スコアボードタイトル>',
                        );
                        return;
                    }
                    const teamParams = args[1].split(':');
                    const numTeams = parseInt(teamParams[0]);
                    const maxTeamSize = parseInt(teamParams[1]);
                    const tagName = args[2];
                    const scoreTitle = args[3];

                    if (isNaN(numTeams) || numTeams < 1) {
                        sendMessage('チーム数は1以上の整数で指定してください。');
                        return;
                    }
                    if (isNaN(maxTeamSize) || maxTeamSize < 1) {
                        sendMessage('チーム内上限人数は1以上の整数で指定してください。');
                        return;
                    }

                    const objective = world.scoreboard.getObjective(scoreTitle);
                    if (!objective) {
                        sendMessage(`スコアボード '${scoreTitle}' が見つかりません。`);
                        return;
                    }

                    const players = world.getPlayers().filter((player) => player.hasTag(tagName));
                    const teamAssignments: { [playerName: string]: number } = {};
                    const teamSizes: { [teamNumber: number]: number } = {};

                    // プレイヤーをシャッフル
                    const shuffledPlayers = players.sort(() => Math.random() - 0.5);

                    // 各チームの人数を初期化
                    for (let i = 1; i <= numTeams; i++) {
                        teamSizes[i] = 0;
                    }

                    // シャッフルされたプレイヤーリストから順番に各チームに割り当て
                    let teamIndex = 1;
                    for (const player of shuffledPlayers) {
                        // 現在のチームが上限に達しているかチェック
                        while (teamSizes[teamIndex] >= maxTeamSize) {
                            teamIndex++;
                            if (teamIndex > numTeams) {
                                teamIndex = 1; // 全チームが上限に達したら最初のチームに戻る
                            }
                        }

                        // プレイヤーをチームに割り当て
                        teamAssignments[player.name] = teamIndex;
                        objective.setScore(player.name, teamIndex);
                        teamSizes[teamIndex]++;

                        // 次のプレイヤーのためにチームインデックスを更新（必要に応じてローテーション）
                        teamIndex++;
                        if (teamIndex > numTeams) {
                            teamIndex = 1;
                        }
                    }

                    sendMessage(`チーム分け完了: ${JSON.stringify(teamAssignments)}`);
                } else {
                    sendMessage('無効なサブコマンドです。 set を使用してください。');
                }
            },
        });

        handler.registerCommand('scoreDelete', {
            moduleName: this.name,
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
                        player.sendMessage(`scoreDelete form\n  form: 削除するスコアボードを選択するフォームを表示します。\nscoreDelete all\n all: 'ws_module' 以外の 'ws_' で始まる全てのスコアボードを削除します。`,)
                        break;
                }
            },
        });
        handler.registerCommand('teamCount', {
            moduleName: this.name,
            description: `指定したタグを持つプレイヤーの人数に基づいて、条件分岐しコマンドを実行します。`,
            usage: `teamCount <チームタグ1,チームタグ2,...> <JSON> [true]\n  <チームタグ1,チームタグ2,...>: カンマ区切りのチームタグ。\n  <JSON>: チームタグとコマンドの対応を記述したJSON配列。 例: [{"team1":"cmd1"},{"team2":"cmd2"}]\n  [true]: (オプション) 最大人数のチームを比較。指定がない場合は、0人になったチームを検知。`,

            execute: (message, event) => {
                const consoleOutput = (message: string) => {
                    console.warn(message);
                };
                try {
                    const args = message.replace(/^\/teamCount\s+/, '').split(/\s+/);
                    console.warn(args.length);

                    if (args.length < 2) {
                        consoleOutput(
                            '使用方法: /ws:teamCount <チームタグ1,チームタグ2,...> <コマンドリスト> [true]',
                        );
                        return;
                    }

                    const teamTags = args[0].split(',');
                    // JSON文字列全体をコマンドリストとして扱う
                    const matchResult = event.message.match(/\[.*\]/);
                    if (!matchResult) {
                        consoleOutput('コマンドリストが見つかりませんでした。');
                        return;
                    }

                    const commandListStr = matchResult[0];
                    const commandList = JSON.parse(commandListStr);
                    const compareMode = args.includes('true'); // trueが指定されたか

                    if (!Array.isArray(commandList)) {
                        consoleOutput(
                            'コマンドリストは配列形式で指定してください。例: [{"team1":"command1"},{"team2":"command2"}]',
                        );
                        return;
                    }

                    const checkTeamCountsAndRun = () => {
                        if (compareMode) {
                            // 人数比較モード
                            let maxPlayerCount = -1;
                            let winningTeam = '';
                            let isSame = false; // 同数フラグ

                            for (const teamTag of teamTags) {
                                const teamPlayerCount = world
                                    .getPlayers()
                                    .filter((player) => player.hasTag(teamTag)).length;
                                if (teamPlayerCount > maxPlayerCount) {
                                    maxPlayerCount = teamPlayerCount;
                                    winningTeam = teamTag;
                                    isSame = false; // 同数フラグをリセット
                                } else if (teamPlayerCount === maxPlayerCount) {
                                    isSame = true; // 同数フラグを立てる
                                    winningTeam = ''; // 同数の場合は winningTeam をリセット
                                }
                            }

                            if (isSame) {
                                // 同数の場合の処理
                                const sameCommandObj = commandList.find((obj) => obj['same']);
                                if (sameCommandObj) {
                                    const sameCommand = sameCommandObj['same'];
                                    //   consoleOutput(`チーム人数が同数のため、コマンド「${sameCommand}」を実行します。`);
                                    system.run(() => {
                                        try {
                                            world.getDimension('overworld').runCommandAsync(sameCommand);
                                        } catch (commandError) {
                                            consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                                        }
                                    });
                                } else {
                                    consoleOutput('同数の場合のコマンドが定義されていません。');
                                }
                            } else if (winningTeam !== '') {
                                // 最大人数のチームがある場合の処理 (従来の動作)
                                const commandObj = commandList.find((obj) => obj[winningTeam]);
                                if (commandObj) {
                                    const command = commandObj[winningTeam];
                                    // consoleOutput(`チーム ${winningTeam} の人数が最も多いため、コマンド「${command}」を実行します。`);
                                    system.run(() => {
                                        try {
                                            world.getDimension('overworld').runCommandAsync(command);
                                        } catch (commandError) {
                                            consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                                        }
                                    });
                                } else {
                                    consoleOutput(`チーム ${winningTeam} に対応するコマンドが定義されていません。`);
                                }
                            }
                        } else {
                            // 0人生存確認モード (従来の動作)
                            for (const teamTag of teamTags) {
                                const teamPlayerCount = world
                                    .getPlayers()
                                    .filter((player) => player.hasTag(teamTag)).length;
                                if (teamPlayerCount === 0) {
                                    // コマンドリストからチームに対応するコマンドを検索
                                    const commandObj = commandList.find((obj) => obj[teamTag]);
                                    if (commandObj) {
                                        const command = commandObj[teamTag];
                                        //    consoleOutput(`チーム ${teamTag} の人数が0になったため、コマンド「${command}」を実行します。`);
                                        system.run(() => {
                                            try {
                                                world.getDimension('overworld').runCommandAsync(command);
                                            } catch (commandError) {
                                                consoleOutput(`コマンド実行中にエラーが発生しました: ${commandError}`);
                                            }
                                        });
                                    } else {
                                        consoleOutput(`チーム ${teamTag} に対応するコマンドが定義されていません。`);
                                    }
                                }
                            }
                        }
                    };

                    // コマンド実行時にチェックを実行
                    checkTeamCountsAndRun();
                } catch (error) {
                    consoleOutput(`エラーが発生しました: ${error}`);
                }
            },
        });

        handler.registerCommand('closeForm', {
            moduleName: this.name,
            description: `ユーザーが開いているフォームを強制的に閉じます`,
            usage: `closeForm execute as @a at @s run scriptevent ws:closeForm　で使用してください`,
            execute: (message, event) => {
                const args = message.split(/\s+/);
                if (args) {
                    const player = event.sourceEntity;
                    if (player instanceof Player) {
                        //@ts-ignore
                        uiManager.closeAllForms(player);
                    }
                }
            }
        });

        handler.registerCommand('changeTag', {
            moduleName: ScoreModule.name,
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

    // スコアボードをリセットする共通の処理
    public resetScoreboard(
        objective: ScoreboardObjective,
        sendMessage: (message: string) => void,
    ): void {
        for (const participant of objective.getParticipants()) {
            try {
                objective.removeParticipant(participant);
            } catch (error) {
                console.error(
                    `Error removing participant ${this.getParticipantDisplayName(participant)} from ${objective.displayName}: ${error}`,
                );
                sendMessage(
                    `Error removing participant ${this.getParticipantDisplayName(participant)} from ${objective.displayName}`,
                );
            }
        }
    }

    // ScoreboardIdentity から表示名を取得するヘルパー関数
    private getParticipantDisplayName(participant: ScoreboardIdentity): string {
        return participant.displayName;
    }
}

const ScoreModules = new ScoreModule();
moduleManager.registerModule(ScoreModules);

const simpleReplacements: { [key: string]: string | (() => string) } = {
    '[allPlayer]': () => world.getPlayers().length.toString(),
    '[uptime]': () => getServerUptime(), // 秒まで表示
    '[ver]': () => ver,
    '[time]': () => formatTimestampJST(new Date()),
};

function resolvePlayerName(key: string): string {
    let playerNameResolved = key;

    // simpleReplacements の置換
    for (const [pattern, replacement] of Object.entries(simpleReplacements)) {
        const regex = new RegExp(pattern.replace(/([\[\]])/g, '\\$1'), 'g');
        playerNameResolved = playerNameResolved.replace(
            regex,
            typeof replacement === 'function' ? replacement() : replacement,
        );
    }

    // tag の置換
    playerNameResolved = playerNameResolved.replace(/\[tag=([^\]]+)\]/g, (_, tagName) => {
        const playerCount = world.getPlayers().filter((player) => player.hasTag(tagName)).length;
        return playerCount.toString();
    });

    // score の置換 (既存の処理)
    playerNameResolved = playerNameResolved.replace(
        /\[score=([^,]+)(?:,([^\]]+))?\]/g,
        (_, scoreTitle, playerName) => {
            const targetScoreboard = world.scoreboard.getObjective(scoreTitle);

            if (!targetScoreboard) {
                // console.warn(`スコアボード "${scoreTitle}" が見つかりませんでした。`);
                return '0'; // スコアボードがない場合は0を返す
            }

            if (playerName) {
                // プレイヤー名が指定されている場合
                for (const participant of targetScoreboard.getParticipants()) {
                    if (participant.displayName === playerName) {
                        const playerScore = targetScoreboard.getScore(participant);
                        return playerScore !== undefined ? playerScore.toString() : '0'; // スコアがない場合は0
                    }
                }
                // console.warn(`スコアボード "${scoreTitle}" にプレイヤー "${playerName}" が見つかりませんでした。`);
                return '0'; // プレイヤーが見つからない場合も0
            } else {
                // プレイヤー名が指定されていない場合は最高スコア
                let highestScore = -Infinity;
                for (const participant of targetScoreboard.getParticipants()) {
                    const scoreValue = targetScoreboard.getScore(participant);
                    if (scoreValue !== undefined && scoreValue > highestScore) {
                        highestScore = scoreValue;
                    }
                }
                return highestScore === -Infinity ? '0' : highestScore.toString(); // スコアがない場合は 0
            }
        },
    );


    // scoreN の置換 (新規追加)
    playerNameResolved = playerNameResolved.replace(
        /\[scoreN=([^,]+)(?:,([^\]]+))?\]/g,
        (_, scoreTitle, playerName) => {
            const targetScoreboard = world.scoreboard.getObjective(scoreTitle);

            if (!targetScoreboard) {
                return '0'; // or perhaps return an empty string, or a specific "not found" indicator
            }

            if (playerName) {
                // プレイヤー名が指定されている場合
                for (const participant of targetScoreboard.getParticipants()) {
                    if (participant.displayName === playerName) {
                        return participant.displayName; // 参加者の表示名を返す
                    }
                }
                return '0'; // or perhaps return an empty string
            } else {
                const participants = targetScoreboard.getParticipants();
                let highestScore = -Infinity;
                let highestScoreParticipantName = '0';

                for (const participant of participants) {
                    const scoreValue = targetScoreboard.getScore(participant);
                    if (scoreValue !== undefined && scoreValue > highestScore) {
                        highestScore = scoreValue;
                        highestScoreParticipantName = participant.displayName;
                    }
                }
                return highestScoreParticipantName;

            }
        }
    );

    return playerNameResolved;
}