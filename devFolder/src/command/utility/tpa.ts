import { c } from '../../Modules/Util';
import { prefix, registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

// TPAリクエスト情報を格納するMap
const tpaRequests = new Map<string, { target: string; timeoutTick: number }>();

// タイムアウト処理
function decreaseTimeoutTicks() {
  for (const [requesterName, { target, timeoutTick }] of tpaRequests.entries()) {
    if (timeoutTick <= 0) {
      tpaRequests.delete(requesterName);

      const targetPlayer = world.getPlayers().find((p) => p.name === target);
      if (targetPlayer) {
        translate(targetPlayer, 'tpaRequestTimedOut', { playerName: requesterName }, targetPlayer);
      }

      // リクエスト送信元にも通知
      const requester = world.getPlayers().find((p) => p.name === requesterName);
      if (requester) {
        translate(requester, 'tpaRequestTimedOut', { playerName: target }, requester);
      }

      continue;
    }

    tpaRequests.set(requesterName, { target, timeoutTick: timeoutTick - 1 });
  }
  system.run(decreaseTimeoutTicks);
}

system.run(decreaseTimeoutTicks);

// TPAリクエスト送信
function sendTpaRequest(player: Player, targetPlayer: Player) {
  // 既にリクエストを送信している場合はエラーメッセージを表示
  if (tpaRequests.has(player.name)) {
    const existingRequest = tpaRequests.get(player.name);
    if (existingRequest && existingRequest.target === targetPlayer.name) {
      player.sendMessage(translate(player, 'tpaRequestAlreadySent'));
      return;
    }
  }

  player.sendMessage(translate(player, 'tpaRequestSent', { playerName: targetPlayer.name }));
  translate(player, 'tpaRequestReceived', { playerName: player.name }, targetPlayer);

  tpaRequests.set(player.name, {
    target: targetPlayer.name,
    timeoutTick: 20 * 60,
  });
}

// TPAリクエスト承認
function acceptTpaRequest(player: Player, requesterName: string) {
  const request = tpaRequests.get(requesterName);

  if (!request) {
    player.sendMessage(translate(player, 'noPendingTpaRequests'));
    return;
  }

  if (request.target !== player.name) {
    player.sendMessage(translate(player, 'invalidTpaRequest'));
    return;
  }

  const requester = player.dimension.getPlayers().find((p) => p.name === requesterName);

  if (!requester) {
    player.sendMessage(translate(player, 'requesterNotFound'));
    return;
  }

  tpaRequests.delete(requesterName);

  // 遅延処理を追加 (例: 3秒遅延)
  system.runTimeout(() => {
    requester.teleport(player.location, { dimension: player.dimension });
    player.sendMessage(translate(player, 'tpaRequestAcceptes', { playerName: requester.name }));
    translate(player, 'tpaRequestAccepted', { playerName: player.name }, requester);
    translate(player, 'teleportedToPlayer', { playerName: player.name }, requester);
  }, 1);
}

// 指定されたプレイヤーへのTPAリクエスト一覧を取得
export function getTpaRequests(playerName: string): string[] {
  const requests: string[] = [];
  for (const [requester, { target }] of tpaRequests.entries()) {
    if (target === playerName) {
      requests.push(requester);
    }
  }
  return requests;
}

export function getAllPlayerNames(currentPlayer: Player): string[] {
  const players = world.getPlayers();
  return players.filter((p) => p.name !== currentPlayer.name).map((p) => p.nameTag);
}

registerCommand({
  name: 'tpa',
  description: 'Tpcommand',
  parent: false,
  maxArgs: 2,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands['tpa']),
  executor: (player: Player, args: string[]) => {
    if (args[0] === '-r' && args.length === 2) {
      const targetPlayer = player.dimension.getPlayers().find((p) => p.name === args[1]);

      if (!targetPlayer) {
        player.sendMessage(translate(player, 'playerNotFound', { playerName: args[1] }));
        return;
      }

      if (targetPlayer === player) {
        player.sendMessage(translate(player, 'cannotTpaToSelf'));
        return;
      }

      sendTpaRequest(player, targetPlayer);
    } else if (args[0] === '-a' && args.length === 2) {
      acceptTpaRequest(player, args[1]);
    } else {
      player.sendMessage(translate(player, 'invalidTpaCommandUsage', { prefix: `${prefix}` }));
    }
  },
});
