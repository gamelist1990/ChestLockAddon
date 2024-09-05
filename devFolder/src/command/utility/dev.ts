import { Player } from '@minecraft/server';
import { registerCommand, verifier } from '../../Modules/Handler';
import { c } from '../../Modules/Util';
import { showPlayerLanguage, resetPlayerLanguages } from '../langs/list/LanguageManager';
import { showProtectedChestData, resetProtectedChests } from '../plugin/chest';
import { resetData, logData } from './../../Modules/DataBase';

registerCommand({
  name: 'dev',
  description: 'Developer commands',
  parent: false,
  maxArgs: 2,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands['dev']),
  executor: (player: Player, args: string[]) => {
    const subCommand = args[0];
    const option = args[1];

    if (subCommand === 'chest') {
      if (option === '-reset') {
        resetProtectedChests(player);
      } else {
        showProtectedChestData(player);
      }
    } else if (subCommand === 'lang') {
      if (option === '-reset') {
        resetPlayerLanguages(player);
      } else {
        showPlayerLanguage(player);
      }
    } else if (subCommand === 'database') {
      if (option === '-reset') {
        resetData();
      } else {
        logData();
      }
    } else {
      player.sendMessage('Unknown subcommand');
    }
  },
});