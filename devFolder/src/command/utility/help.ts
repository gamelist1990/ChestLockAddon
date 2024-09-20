import { Player } from '@minecraft/server';
import { config } from '../../Modules/Util';
import { ver } from '../../Modules/version';
import { registerCommand, getAllCommandNames, verifier, prefix } from '../../Modules/Handler'; // コマンドが登録されているファイルをインポート
import { translate } from '../langs/list/LanguageManager';

registerCommand({
  name: 'help',
  description: 'help_command_description',
  parent: false,
  maxArgs: 0,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['help']),
  executor: (player: Player) => {
    const helpMessages = getAllCommandNames(player);
    const version = `§aVer.${ver}`;
    let helpMessage = translate(player, 'available_commands') + ':\n';
    helpMessages.forEach((msg) => {
      const commandDescription = translate(player, msg.description);
      helpMessage += `§b${prefix}${msg.name} - ${commandDescription}\n`;
    });
    player.sendMessage(helpMessage);
    player.sendMessage(version);
  },
});
