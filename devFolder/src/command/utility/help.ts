import { Player } from '@minecraft/server';
import { config } from '../../Modules/Util';
import { ver } from '../../Modules/version';
import { registerCommand, getAllCommandNames, verifier, prefix } from '../../Modules/Handler';
import { translate } from '../langs/list/LanguageManager';

const COMMANDS_PER_PAGE = 10; 
const PREFIX = prefix; 

registerCommand({
  name: 'help',
  description: 'help_docs',
  parent: false,
  maxArgs: 1,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['help']),
  executor: (player: Player, args?: string[]) => {
    const commands = getAllCommandNames(player);
    const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
    let pageNumber = 1;

    if (args && args.length > 0) {
      pageNumber = parseInt(args[0]);
      if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
        player.sendMessage(translate(player, 'command.help.invalid_page_number'));
        return;
      }
    }

    const startIndex = (pageNumber - 1) * COMMANDS_PER_PAGE;
    const endIndex = Math.min(startIndex + COMMANDS_PER_PAGE, commands.length);
    const pageCommands = commands.slice(startIndex, endIndex);

    const version = `§aVer.${ver}`;
    let helpMessage = translate(player, "command.help.helpPage", { pageNumber: `${pageNumber}`, totalPages: `${totalPages}`, PREFIX: `${PREFIX}`});
    pageCommands.forEach((msg) => {
      const commandDescription = translate(player, msg.description);
      helpMessage += `§b${prefix}${msg.name} - ${commandDescription}\n`;
    });

    player.sendMessage(helpMessage);
    player.sendMessage(version);
  },
});