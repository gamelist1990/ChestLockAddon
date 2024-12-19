import { isPlayer, registerCommand, verifier } from '../../Modules/Handler';
import { Player, world } from '@minecraft/server';
import { config, formatTimestamp } from '../../Modules/Util';
import { ActionFormData } from '@minecraft/server-ui';
import { translate } from '../langs/list/LanguageManager';
import { chestLockAddonData, loadData, saveData } from '../../Modules/DataBase';

interface Report {
  reporter: string;
  reportedPlayer: string;
  reason: string;
  timestamp: number;
}

let reports: Report[] = [];

export function resetReports() {
  reports.length = 0; // 配列を空にすることでレポートをリセット
  saveData('reports', reports);
  console.warn('Report Data Reset');
}

export function loadReport(): void {
  loadData();
  const data = chestLockAddonData.reports;
  if (data && typeof data === 'object') {
    reports = data;
  }
}

function submitReport(player: Player, reportedPlayerName: string, reason: string) {
  if (reportedPlayerName !== 'testPlayer') {
    const targetPlayer = isPlayer(reportedPlayerName);
    if (!targetPlayer) {
      player.sendMessage(translate(player, 'command.report.reportNotPlayer'));
      return;
    }
  }

  reports.push({
    reporter: player.name,
    reportedPlayer: reportedPlayerName,
    reason: reason,
    timestamp: Date.now(),
  });

  player.sendMessage(translate(player, 'command.report.reportSubmit'));
  saveData('reports', reports);

  // staffに通知
  notifyStaff(player.name, reportedPlayerName);
}

export function ServerReport(player: Player, reason: string) {
  if (!isPlayer(player.name)) {
    // プレイヤーがサーバーでない場合の処理 (必要であれば)
    console.warn('ServerReport function called by a non-server entity.');
    return;
  }

  reports.push({
    reporter: 'Server', // レポーターを "Server" に設定
    reportedPlayer: player.name,
    reason: reason,
    timestamp: Date.now(),
  });

  saveData('reports', reports);

  // staffに通知
  notifyStaff('Server', player.name);
}

export function notifyStaff(reporter: string, reportedPlayer: string) {
  world
    .getPlayers()
    .filter((p) => p.hasTag('op') || p.hasTag('staff'))
    .forEach((staff) => {
      staff.sendMessage(
        translate(staff, 'command.report.newReport', {
          reporter: `${reporter}`,
          reportedPlayer: `${reportedPlayer}`,
        }),
      );
    });
}

export function checkReports(player: Player) {
  if (reports.length === 0) {
    player.sendMessage(translate(player, 'command.report.NotReport'));
    return;
  }

  const reporterInfo: { [reporter: string]: { count: number; latestTimestamp: number } } = {};
  reports.forEach((report) => {
    if (!reporterInfo[report.reporter]) {
      reporterInfo[report.reporter] = { count: 0, latestTimestamp: 0 };
    }
    reporterInfo[report.reporter].count++;
    reporterInfo[report.reporter].latestTimestamp = Math.max(
      reporterInfo[report.reporter].latestTimestamp,
      report.timestamp,
    );
  });

  const mainForm = new ActionFormData().title('§l§0Reports');

  const sortedReports = [...reports].sort((a, b) => b.timestamp - a.timestamp);

  for (const reporter in reporterInfo) {
    const { count, latestTimestamp } = reporterInfo[reporter];
    // 日本時間に変換
    const latestTime = formatTimestamp(latestTimestamp);
    const buttonText = count > 1 ? `${reporter} x${count} (${latestTime})` : `${reporter} (${latestTime})`;
    mainForm.button(buttonText);
  }
  //@ts-ignore

  mainForm.show(player).then((response) => {
    if (response.selection === undefined) return;

    const selectedReporter = Object.keys(reporterInfo)[response.selection];
    const reporterReports = sortedReports.filter((report) => report.reporter === selectedReporter);
    const reporterForm = new ActionFormData().title(
      translate(player, 'command.ui.reportTitle', { selectedReporter: `${selectedReporter}` }),
    );

    reporterReports.forEach((report) => {
      const reportTime = formatTimestamp(report.timestamp); 
      reporterForm.button(`${report.reportedPlayer} (${reportTime})`);
    });

    //@ts-ignore
    reporterForm.show(player).then((response) => {
      if (response.selection === undefined) return;

      const selectedReport = reporterReports[response.selection];
      const timestamp = formatTimestamp(selectedReport.timestamp); // 既存のformatTimestampを使用

      const detailsForm = new ActionFormData()
        .title(translate(player, 'command.ui.reportDetails'))
        .body(
          translate(player, 'command.ui.reportBody', {
            reporter: `${selectedReport.reporter}`,
            reportedPlayer: `${selectedReport.reportedPlayer}`,
            reason: `${selectedReport.reason}`,
            timestamp: `${timestamp}`, // formatTimestampを使用
          }),
        )
        .button(translate(player, 'back'));
      //@ts-ignore

      detailsForm.show(player).then((response) => {
        if (!response.canceled && response.selection === 0) {
          checkReports(player);
        }
      });
    });
  });
}

registerCommand({
  name: 'report',
  description: 'report_docs',
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
