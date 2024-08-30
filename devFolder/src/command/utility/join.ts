import { c } from '../../Modules/Util';
import { saveData,loadData,chestLockAddonData } from '../../Modules/DataBase';
import { registerCommand, verifier } from '../../Modules/Handler';
import { Player, world,system } from '@minecraft/server';
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
  description: 'Joincommand',
  parent: false,
  maxArgs: 1,
  minArgs: 0,
  require: (player: Player) => verifier(player, c().commands['join']),
  executor: (player: Player, args: string[]) => {
    if (args.length > 0) {
      if (args[0] === '-true') {
        joinModules.joinLogEnabled = true;
        savejoinModules();
        loadjoinModules();
        player.sendMessage(translate(player,"Joinenabled"));
      } else if (args[0] === '-false') {
        joinModules.joinLogEnabled = false;
        savejoinModules();
        player.sendMessage(translate(player,"Joindisabled"));
      } else if (args[0] === '-settings') {
        system.runTimeout(() => {
            openSettingsUI(player);
         },60);
      } else if (args[0] === '-test') {
        system.runTimeout(() => {
            showJoinMessage(player);
         },60);
      } else {
        player.sendMessage(translate(player,"Invalid"));
      }
    } else {
      player.sendMessage(translate(player,"UsageJoin"));
    }
  },
});


world.afterEvents.playerSpawn.subscribe((event: any) => {
  const  { player } = event;
  system.runTimeout(() => {

    console.warn(JSON.stringify(player,null,2))
    showJoinMessage(player);
 
  }, 120); 
}); 


// 参加メッセージを表示する関数
function showJoinMessage(player: Player) {
  let message = translate(player,"welcome")+':\n';
  joinModules.MessageSettings.forEach(rule => {
    message += `${rule}\n`;
  });

  let form = new ActionFormData()
    .title(translate(player,"Rulejoin"))
    .body(message)
    .button(translate(player,"yes"));

 //@ts-ignore
  form.show(player).then(response => {
  });
}

// 設定UIを開く関数
function openSettingsUI(player: Player) {
  let form = new ModalFormData()
    .title(translate(player,'joinSettings'))
    .textField(translate(player,"RulesNumber"),translate(player,"RulesEnter"));
  //@ts-ignore
  form.show(player).then(response => {
    if (response.canceled) return;

    if (response.formValues) {
      const ruleCount = parseInt(response.formValues[0] as string);
      if (isNaN(ruleCount) || ruleCount < 1) {
        player.sendMessage(translate(player,'Invalid'));
        return;
      }

      let ruleForm = new ModalFormData()
        .title(translate(player,"RuleSettings"));

      for (let i = 1; i <= ruleCount; i++) {
        ruleForm.textField(translate(player,"Rules",{i:`${i}`}),translate(player,"RuleEnter",{i:`${i}`}));
      }

      //@ts-ignore
      ruleForm.show(player).then(ruleResponse => {
        if (ruleResponse.canceled) return;

        if (ruleResponse.formValues) {
          joinModules.MessageSettings = ruleResponse.formValues.filter(value => typeof value === 'string') as string[];
          player.sendMessage(translate(player,"RuleUpdate"));
          savejoinModules();
        }
      });
    }
  });
}

export default joinModules;
