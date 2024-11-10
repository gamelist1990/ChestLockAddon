import { config } from '../../Modules/Util';
import { saveData, loadData, chestLockAddonData } from '../../Modules/DataBase';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { translate } from '../langs/list/LanguageManager';


let joinModules = {
  joinLogEnabled: false,
  MessageSettings: [] as string[],
};



function savejoinModules(): void {
  saveData('joinModules', joinModules);
}

// データの読み込み関数
export function loadjoinModules(): void {
  loadData();
  const data = chestLockAddonData.joinModules;
  if (data && typeof data === 'object') {
    joinModules = data;
  }
}



// コマンド登録
registerCommand({
  name: 'join',
  description: 'join_docs',
  parent: false,
  maxArgs: 1,
  minArgs: 0,
  require: (player: Player) => verifier(player, config().commands['join']),
  executor: (player: Player, args: string[]) => {
    if (args.length > 0) {
      if (args[0] === '-true') {
        joinModules.joinLogEnabled = true;
        savejoinModules();
        loadjoinModules();
        player.sendMessage(translate(player, "command.join.Joinenabled"));
      } else if (args[0] === '-false') {
        joinModules.joinLogEnabled = false;
        savejoinModules();
        player.sendMessage(translate(player, "command.join.Joindisabled"));
      } else if (args[0] === '-settings') {
        system.runTimeout(() => {
          openSettingsUI(player);
        }, 60);
      } else if (args[0] === '-test') {
        system.runTimeout(() => {
          showJoinMessage(player);
        }, 60);
      } else {
        player.sendMessage(translate(player, "server.Invalid"));
      }
    } else {
      player.sendMessage(translate(player, "command.join.UsageJoin"));
    }
  },
});


// プレイヤーが参加したときに一度だけメッセージを表示するためのフラグ
const playersShownMessage: { [playerName: string]: boolean } = {};

world.afterEvents.playerSpawn.subscribe((event: any) => {
  const { player } = event;

  // プレイヤーの名前を取得
  const playerName = player.name;

  if (joinModules.joinLogEnabled) {
    if (!playersShownMessage[playerName]) {
      system.runTimeout(() => {
        showJoinMessage(player);
        playersShownMessage[playerName] = true;
      }, 160);
    }
  }
});


// 参加メッセージを表示する関数
function showJoinMessage(player: Player) {
  let message = translate(player, "command.join.welcome") + ':\n';
  joinModules.MessageSettings.forEach(rule => {
    message += `${rule}\n`;
  });

  let form = new ActionFormData()
    .title(translate(player, "command.join.Rulejoin"))
    .body(message)
    .button(translate(player, "command.chest.yes"));

  //@ts-ignore
  form.show(player).then(response => {
  });
}

// 設定UIを開く関数
function openSettingsUI(player: Player) {
  let form = new ModalFormData()
    .title(translate(player, 'command.join.joinSettings'))
    .textField(translate(player, "command.join.RulesNumber"), translate(player, "command.join.RulesEnter"));
  //@ts-ignore
  form.show(player).then(response => {
    if (response.canceled) return;

    if (response.formValues) {
      const ruleCount = parseInt(response.formValues[0] as string);
      if (isNaN(ruleCount) || ruleCount < 1) {
        player.sendMessage(translate(player, 'server.Invalid'));
        return;
      }

      let ruleForm = new ModalFormData()
        .title(translate(player, "command.join.RuleSettings"));

      for (let i = 1; i <= ruleCount; i++) {
        ruleForm.textField(translate(player, "command.join.Rules", { i: `${i}` }), translate(player, "command.join.RulesEnter", { i: `${i}` }));
      }

      //@ts-ignore
      ruleForm.show(player).then(ruleResponse => {
        if (ruleResponse.canceled) return;

        if (ruleResponse.formValues) {
          joinModules.MessageSettings = ruleResponse.formValues.filter(value => typeof value === 'string') as string[];
          player.sendMessage(translate(player, "command.join.RuleUpdate"));
          savejoinModules();
        }
      });
    }
  });
}

export default joinModules;