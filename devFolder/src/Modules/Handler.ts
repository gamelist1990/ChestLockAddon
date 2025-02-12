import { ChatSendBeforeEvent, Player, world } from '@minecraft/server';
import { config } from './Util';
import { translate } from '../command/langs/list/LanguageManager';

export const prefix = '#';

const commands: Record<
  string,
  {
    name: string;
    description: string;
    parent: boolean;
    maxArgs: number;
    minArgs: number;
    require: (player: Player) => boolean;
    executor: (player: Player, args: string[]) => void;
  }
> = {};

let pendingCommand: { player: Player; command: string; args: string[] } | null = null;

export function registerCommand(options: {
  name: string;
  description: string;
  parent: boolean;
  maxArgs: number;
  minArgs: number;
  require: (player: Player) => boolean;
  executor: (player: Player, args: string[]) => void;
}) {
  commands[options.name] = options;
}

export function getAllCommandNames(player?: Player) {
  return Object.values(commands)
    .filter((command) => {
      // player が指定されていない場合はすべてのコマンドを返す
      if (!player) return true;

      const commandConfig = config().commands[command.name];

      // adminOnly が true かつプレイヤーが管理者でない場合は除外
      if (commandConfig.adminOnly && !player.hasTag(config().admin)) {
        return false;
      }

      // requireTag が設定されている場合は、プレイヤーがすべてのタグを持っているか確認
      if (
        commandConfig.requireTag.length > 0 &&
        !commandConfig.requireTag.some((tag) => player.hasTag(tag))
      ) {
        return false;
      }

      return true;
    })
    .map(({ name, description }) => ({ name, description }));
}

interface CommandConfig {
  enabled: boolean;
  adminOnly: boolean;
  requireTag: string[];
}

export function isPlayer(playerName: string): Player | undefined {
  return world.getPlayers().find((player) => player.name === playerName);
}

export function verifier(player: Player, setting: CommandConfig): boolean {
  if (setting.enabled !== true) {
    player.sendMessage(translate(player, 'server.desabledCom'));
    return false;
  } else if (setting.adminOnly === true && !player.hasTag(config().admin)) {
    player.sendMessage(translate(player, 'server.unavailable'));
    return false;
  } else if (
    setting.requireTag.length > 0 &&
    !player.getTags().some((tag: string) => setting.requireTag.includes(tag))
  ) {
    player.sendMessage(translate(player, 'server.AllowTagCom'));
    return false;
  }
  return true;
}

export function suggestCommand(player: Player, commandName: string, args: string[]) {
  const possibleCommands = Object.keys(commands).filter((cmd) => {
    const distance = levenshteinDistance(cmd, commandName);
    return distance <= 2; // 調整可能
  });
  console.log(commandName);

  if (possibleCommands.length > 0) {
    player.sendMessage(
      translate(player, 'server.desableComSuggest', {
        possibleCommands: `${possibleCommands[0]}`,
        prefix: `${prefix}`,
      }),
    );
    pendingCommand = { player, command: possibleCommands[0], args: args }; // 引数を保存
    return possibleCommands[0];
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const helpsCom: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    helpsCom[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    helpsCom[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        helpsCom[i][j] = helpsCom[i - 1][j - 1];
      } else {
        helpsCom[i][j] = Math.min(
          helpsCom[i - 1][j - 1] + 1,
          Math.min(helpsCom[i][j - 1] + 1, helpsCom[i - 1][j] + 1),
        );
      }
    }
  }

  return helpsCom[b.length][a.length];
}

// チャットイベントリスナー
world.beforeEvents.chatSend.subscribe((event: ChatSendBeforeEvent) => {
  const { message, sender } = event;
  if (!message.startsWith(prefix)) return;

  const args = message
    .slice(prefix.length)
    .replace('@', '')
    .match(/(".*?"|\S+)/g)
    ?.map((match: string) => match.replace(/"/g, ''));
  if (!args) return;

  const commandName = args.shift()?.toLowerCase().trim() || '';
  event.cancel = true;

  if (commandName === 'yes' && pendingCommand && pendingCommand.player === sender) {
    const { command, args: pendingArgs } = pendingCommand;
    const correctCommandOptions = commands[command];
    if (correctCommandOptions && verifier(sender, config().commands[command])) {
      correctCommandOptions.executor(sender, pendingArgs); // 引数を渡す
    }
    pendingCommand = null;
    event.cancel = true;
    return;
  }

  const commandOptions = commandName ? commands[commandName] : undefined;

  if (commandOptions) {
    if (commandName && verifier(sender, config().commands[commandName])) {
      commandOptions.executor(sender, args);
    }
  } else {
    const suggestedCommand = suggestCommand(sender, commandName!, args); // 引数を渡す
    if (!suggestedCommand) {
      sender.sendMessage(translate(sender, 'server.invalidCom', { commandName: `${commandName}` }));
    }
  }

  event.cancel = true;
});

/**
 * 外部からコマンドを実行するための関数
 * @param playerName 実行するプレイヤー名
 * @param commandName コマンド名
 * @param args コマンドの引数
 */
export function runCommand(playerName: string, commandName: string, args: string[] = []) {
  const player = isPlayer(playerName);
  if (!player) return;

  const commandOptions = commands[commandName];

  if (commandOptions) {
    if (verifier(player, config().commands[commandName])) {
      commandOptions.executor(player, args);
    }
  } else {
    player.sendMessage(translate(player, 'server.invalidCom', { commandName: `${commandName}` }));
  }
}