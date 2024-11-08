import { config } from '../../Modules/Util';
import { registerCommand, verifier } from '../../Modules/Handler';
import { showBasicUI } from './ui';
import { Player, system } from '@minecraft/server';
import { translate } from '../langs/list/LanguageManager';

registerCommand({
  name: 'ui',
  description: 'ui_docs',
  parent: false,
  maxArgs: 0,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['ui']),
  executor: (player: Player) => {
    player.sendMessage(translate(player, 'server.closeChat'));
    system.runTimeout(() => {
      showBasicUI(player);
    }, 0);
    system.runTimeout(() => {
      showBasicUI(player);
    }, 60);
  },
});
