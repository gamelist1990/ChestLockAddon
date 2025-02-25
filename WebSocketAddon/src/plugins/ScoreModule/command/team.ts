import { world, system, Player } from '@minecraft/server';
import { Handler } from '../../../module/Handler';

export function registerTeamCommand(handler: Handler, moduleName: string) {
    handler.registerCommand('team', {
        moduleName: moduleName,
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
}