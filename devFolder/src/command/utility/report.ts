import { isPlayer, registerCommand, verifier } from '../../Modules/Handler';
import { Player, world } from '@minecraft/server';
import { config } from '../../Modules/Util';
import { ActionFormData } from '@minecraft/server-ui';
import { translate } from '../langs/list/LanguageManager';


interface Report {
    reporter: string;
    reportedPlayer: string;
    reason: string;
    timestamp: number;
}

const reports: Report[] = [];

function submitReport(player: Player, reportedPlayerName: string, reason: string) {
    if (reportedPlayerName !== 'testPlayer') {
        const targetPlayer = isPlayer(reportedPlayerName);
        if (!targetPlayer) {
            player.sendMessage(translate(player, 'command.reportNotPlayer'))
            return;
        }
    }

    reports.push({
        reporter: player.name,
        reportedPlayer: reportedPlayerName,
        reason: reason,
        timestamp: Date.now(),
    });

    player.sendMessage(translate(player, 'command.reportSubmit'))

    // staffに通知
    notifyStaff(player.name, reportedPlayerName);
}

function notifyStaff(reporter: string, reportedPlayer: string) {
    world.getPlayers()
        .filter((p) => p.hasTag('op') || p.hasTag('staff'))
        .forEach((staff) => {
            staff.sendMessage(translate(staff, "command.newReport", { reporter: `${reporter}`, reportedPlayer: `${reportedPlayer}` }))
        });
}

export function checkReports(player: Player) {
    if (reports.length === 0) {
        player.sendMessage(translate(player, "command.NotReport"))
        return;
    }

    // リクエスターごとのレポート数を集計し、最新のタイムスタンプを取得
    const reporterInfo: { [reporter: string]: { count: number, latestTimestamp: number } } = {};
    reports.forEach((report) => {
        if (!reporterInfo[report.reporter]) {
            reporterInfo[report.reporter] = { count: 0, latestTimestamp: 0 };
        }
        reporterInfo[report.reporter].count++;
        reporterInfo[report.reporter].latestTimestamp = Math.max(
            reporterInfo[report.reporter].latestTimestamp,
            report.timestamp
        );
    });

    const mainForm = new ActionFormData()
        .title('§l§0Reports');

    // 最新のレポートを上に、古いレポートを下に表示
    const sortedReports = [...reports].sort((a, b) => b.timestamp - a.timestamp);

    // リクエスターごとにボタンを表示
    for (const reporter in reporterInfo) {
        const { count, latestTimestamp } = reporterInfo[reporter];
        const latestTime = new Date(latestTimestamp).toLocaleString();
        const buttonText = count > 1 ? `${reporter} x${count} (${latestTime})` : `${reporter} (${latestTime})`;
        mainForm.button(buttonText);
    }
    //@ts-ignore

    mainForm.show(player).then((response) => {
        if (response.selection === undefined) return; // キャンセルされた場合

        const selectedReporter = Object.keys(reporterInfo)[response.selection];
        // 選択されたリクエスターのレポートを表示するフォーム
        const reporterReports = sortedReports.filter((report) => report.reporter === selectedReporter);
        const reporterForm = new ActionFormData()
            .title(translate(player, "command.ui.reportTitle", { selectedReporter: `${selectedReporter}` }));

        reporterReports.forEach((report) => {
            const reportTime = new Date(report.timestamp).toLocaleString();
            reporterForm.button(`${report.reportedPlayer} (${reportTime})`);
        });

        //@ts-ignore

        reporterForm.show(player).then((response) => {
            if (response.selection === undefined) return; // キャンセルされた場合

            const selectedReport = reporterReports[response.selection];

            // 選択されたレポートの詳細を表示するフォーム
            const detailsForm = new ActionFormData()
                .title(translate(player, "command.ui.reportDetails"))
                .body(translate(player, "command.ui.reportBody",
                    {
                        reporter: `${selectedReport.reporter}`,
                        reportedPlayer: `${selectedReport.reportedPlayer}`,
                        reason: `${selectedReport.reason}`,
                        timestamp: `${new Date(selectedReport.timestamp).toLocaleString()}`
                    }))
                .button(translate(player, "back"));





            detailsForm
                //@ts-ignore
                .show(player)
                .then((response) => {
                    if (response.canceled) {
                    } else {
                        if (response.selection === 0) {
                            checkReports(player);

                        }

                    }

                })
        });
    });
}

registerCommand({
    name: 'report',
    description: 'report_command_description',
    parent: false,
    maxArgs: 100,
    minArgs: 3,
    require: (player: Player) => verifier(player, config().commands['report']),
    executor: (player: Player, args: string[]) => {
        if (args[1] !== '-r') {
            player.sendMessage('Invalid command format. Use report <player> -r <reason>.');
            return;
        }
        const reportedPlayerName = args[0];
        const reason = args.slice(2).join(' ');
        submitReport(player, reportedPlayerName, reason);
    },
});