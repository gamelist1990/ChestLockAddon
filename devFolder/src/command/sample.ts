import { closeForm, config } from '../Modules/Util';
import { registerCommand, verifier } from '../Modules/Handler';
import { Player } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { translate } from './langs/list/LanguageManager';

registerCommand({
  name: 'sample',
  description: 'sample_command_description',
  parent: false,
  maxArgs: 2,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['sample']),
  executor: (player: Player, args: string[]) => {
    player.sendMessage('Sample command executed | サンプルコマンドが実行されました');
    if (args.length > 0) {
      player.sendMessage(`Argument provided: ${args[0]} | 引数が提供されました: ${args[0]}`);
    }
    if (args[0] === 'open') {
      closeForm(player);
      main(player);
    }
  },
});

function main(player: Player) {
  const form = new ActionFormData()
    .title('SampleForm')
    .body('Hello World') 
    .button('Select One'); 

  form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (!response.canceled && response.selection === 0) {
        showSub(player);
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'ui.FromError'), error);
      player.sendMessage(translate(player, 'ui.FromError') + error.message);
    });
}

function showSub(player: Player) {
  const form = new ActionFormData()
    .title('Sub Menu')
    .body('Hello World 2') 
    .button('Back to Main'); 

  form
    //@ts-ignore
    .show(player)
    .then((response) => {
      if (!response.canceled && response.selection === 0) {
        main(player);
      }
    })
    .catch((error: Error) => {
      console.error(translate(player, 'ui.FromError'), error);
      player.sendMessage(translate(player, 'ui.FromError') + error.message);
    });
}