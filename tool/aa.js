import { world, system } from '@minecraft/server';
import { ModalFormData, ActionFormData } from '@minecraft/server-ui';
import { tickEvent } from './tps';

//Global

let tps = 0;

//Load

tickEvent.subscribe('serverInfoTick', (data) => {
  tps = data.tps;
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    player.runCommand('scoreboard players set pvp player 0');
    player.runCommand('execute as @a[tag=pvp] run scoreboard players add pvp player 1');
    player.runCommand('scoreboard players set sumo player 0');
    player.runCommand('execute as @a[tag=sumo] run scoreboard players add sumo player 1');
    player.runCommand('scoreboard players set bow player 0');
    player.runCommand('execute as @a[tag=bow] run scoreboard players add bow player 1');
    player.runCommand('scoreboard players set pot player 0');
    player.runCommand('execute as @a[tag=pot] run scoreboard players add pot player 1');
    player.runCommand('scoreboard players set cps player 0');
    player.runCommand('execute as @a[tag=cps] run scoreboard players add cps player 1');
    player.runCommand('scoreboard players set Athletic player 0');
    player.runCommand('execute as @a[tag=athle] run scoreboard players add Athletic player 1');
    player.runCommand('scoreboard players set combo player 0');
    player.runCommand('execute as @a[tag=combo] run scoreboard players add combo player 1');
    player.runCommand('scoreboard players set spleef player 0');
    player.runCommand('execute as @a[tag=spleef] run scoreboard players add spleef player 1');

    const form = new ActionFormData();
    form.title('規約');
    form.body(
      '禁止事項\n荒し\n下ネタ\n暴言\nスパム\nチート\nハッククライアントの使用\nチーミング行為\n迷惑行為\nその他不愉快に感じる行為,チャット全般\n誘いワー,連れワー\nみんなが楽しめるサーバーにしていきましょう!!',
    );
    form.button('同意する(何回か同意押すかもしれません)');
    if (!player.hasTag('rule')) {
      form.show(player).then(({ selection, canceled }) => {
        if (canceled) return;
        if (selection == 0) {
          player.runCommand('tag @s add rule');
          player.playSound('random.levelup');
          player.sendMessage('サーバーに参加しました！');
        }
      });
    }
  }
}, 20);

world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;
  const itemStack = ev.itemStack;

  if (itemStack.typeId === 'minecraft:diamond') {
    const Athletic = world.scoreboard.getObjective('player').getScore('Athletic');
    const form = new ActionFormData();
    form.title('メニュー');

    form.button('§cPVP', 'textures/items/iron_sword');
    form.button('§dミニゲーム', 'textures/items/emerald');
    form.button('§aDM§f', 'textures/items/paper');

    form.button('§4BAN (host限定)', 'textures/items/totem');

    form.button('§eレポート', 'textures/items/ender_pearl');
    form.button(`§bアスレチック\n§0プレイ人数:${Athletic}人`, 'textures/blocks/grass_side_carried');
    form.button('トレーニング', 'textures/items/wood_sword');
    form.button('あなたのスコア', 'textures/items/netherite_axe');
    form.button('運営/製作者', 'textures/items/end_crystal');
    form.button('TPS');

    form.show(player).then(({ selection, canceled }) => {
      if (canceled) return;

      if (selection == 1) {
        //ミニゲーム start
        const spleef = world.scoreboard.getObjective('player').getScore('spleef');
        const form = new ActionFormData();
        form.title('ミニゲーム');
        form.button(`§eSpleef\n§0プレイ人数:${spleef}人`, 'textures/items/diamond_shovel');

        form.show(player).then(({ selection, canceled }) => {
          if (canceled) return;
          if (selection == 0) {
            //Spleef
            player.runCommand('tag @s add spleef');
            player.sendMessage('§eSpleefを選択しました');
            player.playSound('random.orb');
            player.runCommand('tag @s remove lobby');
            player.runCommand('clear @s');
            player.runCommand('gamemode s @s');
            player.runCommand('give @s diamond_shovel');
            player.runCommand('spreadplayers -39 -5 1 14 @s -59');
          }
        });
      } //ミニゲーム finish

      if (selection === 2) {
        //DM start

        // 全てのプレイヤーの配列
        const players = world.getPlayers();
        // 名前の配列
        const names = players.map((player) => player.name);
        // フォームの定義
        const form = new ModalFormData();
        form.title('メッセージフォーム');
        form.dropdown('どのプレイヤーに送りますか？', names);
        form.textField('メッセージ', '', '');
        form.show(player).then((res) => {
          if (res.canceled) return;

          // フォームの表示

          // 送信先のプレイヤー
          const toPlayer = players[res.formValues[0]];
          // メッセージ
          const message = res.formValues[1];

          if (message === '') return player.sendMessage('§cメッセージがありません');

          toPlayer.sendMessage(`【§cあなたへのDM§f】 \n §e${player.name}§f => ${message}`);
          player.sendMessage(`§e${toPlayer.name} §fにDMを送信しました`);
          player.playSound('random.orb');
          toPlayer.playSound('random.orb');
        });
      } //DM finish
      if (selection === 0) {
        //PVP start
        const form = new ActionFormData();
        const pvp = world.scoreboard.getObjective('player').getScore('pvp');
        const sumo = world.scoreboard.getObjective('player').getScore('sumo');
        const bow = world.scoreboard.getObjective('player').getScore('bow');
        const pot = world.scoreboard.getObjective('player').getScore('pot');

        form.title('PVP');
        form.button(
          '§aノーマルPVP§0\nプレイ人数:' + `${pvp}` + '人',
          'textures/items/diamond_sword',
        );
        form.button('§bSumo§0\nプレイ人数:' + `${sumo}` + '人', 'textures/items/stick');
        form.button('§cBow§0\nプレイ人数:' + `${bow}` + '人', 'textures/items/bow_pulling_0');
        form.button(
          '§dPot§r\nプレイ人数:' + `${pot}` + '人',
          'textures/items/potion_bottle_splash_heal',
        );

        form.show(player).then(({ selection, canceled }) => {
          if (canceled) return;
          if (selection === 0) {
            player.runCommand('tag @s add pvp');
            player.runCommand('gamemode a @s');
            player.sendMessage('§aノーマルpvpを選択しました');
            player.playSound('random.orb');
            player.runCommand('clear @s');
            player.runCommand('replaceitem entity @s slot.armor.head 0 diamond_helmet');
            player.runCommand('replaceitem entity @s slot.armor.chest 0 diamond_chestplate');
            player.runCommand('replaceitem entity @s slot.armor.legs 0 diamond_leggings');
            player.runCommand('replaceitem entity @s slot.armor.feet 0 diamond_boots');
            player.runCommand('give @s diamond_sword');
            player.runCommand('give @s fishing_rod');
            player.runCommand('give @s bow');
            player.runCommand('give @s arrow 64');
            player.runCommand('spreadplayers -5 -58 1 19 @s -60');
            player.runCommand('tag @s remove lobby');
          }
          if (selection == 1) {
            player.runCommand('tag @s add sumo');
            player.sendMessage('§bSumoを選択しました');
            player.playSound('random.orb');
            player.runCommand('gamemode a @s');
            player.runCommand('clear @s');
            player.runCommand('give @s stick');
            player.runCommand('tag @s remove lobby');
            player.runCommand('spreadplayers 36 -53 1 14 @s -56');
          }
          if (selection == 2) {
            player.runCommand('tag @s add bow');
            player.runCommand('effect @s resistance 2 255 true');
            player.runCommand('gamemode a @s');
            player.sendMessage('§cBowを選択しました');
            player.playSound('random.orb');
            player.runCommand('clear @s');
            player.runCommand('give @s bow');
            player.runCommand('give @s arrow');
            player.runCommand('spreadplayers -59 -54 1 14 @s -55');
            player.runCommand('tag @s remove lobby');
          }
          if (selection == 3) {
            player.runCommand('tag @s add pot');
            player.runCommand('gamemode a @s');
            player.playSound('random.orb');
            player.sendMessage('§dPotを選択しました');
            player.runCommand('clear @s');
            player.runCommand('replaceitem entity @s slot.armor.head 0 diamond_helmet');
            player.runCommand('replaceitem entity @s slot.armor.chest 0 diamond_chestplate');
            player.runCommand('replaceitem entity @s slot.armor.legs 0 diamond_leggings');
            player.runCommand('replaceitem entity @s slot.armor.feet 0 diamond_boots');
            player.runCommand('give @s diamond_sword');
            player.runCommand('give @s splash_potion 35 21');
            player.runCommand('spreadplayers -105 -59 1 19 @s -59');
            player.runCommand('tag @s remove lobby');
          }
        });
      } //PVP start

      if (selection === 3) {
        //BAN start
        // 全てのプレイヤーの配列
        const players = world.getPlayers();
        // 名前の配列
        const names = players.map((player) => player.name);
        // フォームの定義
        const form = new ModalFormData();
        form.title('BAN フォーム');
        form.dropdown('どのプレイヤーをBANしますか？', names);
        form.textField('BANメッセージ', '', '');
        form.toggle('永久追放', false);
        if (player.hasTag('host')) {
          form.show(player).then((res) => {
            if (res.canceled) return;

            // 送信先のプレイヤー
            const toPlayer = players[res.formValues[0]];
            // メッセージ
            const message = res.formValues[1];

            const isAnonymous = res.formValues[2];

            toPlayer.runCommand(`kick ${toPlayer.name}`);
            player.playSound('random.totem');
            world.sendMessage(
              `【§cBAN§f】 \n BANされたプレイヤー:${toPlayer.name} \n [§4理由§f]: ${message} \nBANしたプレイヤー:${player.name}`,
            );
            toPlayer.runCommand(`tag ${isAnonymous ? `${toPlayer.name} add ban` : ''}`);
          });
        } else {
          player.sendMessage('hostではないため開けません');
          player.playSound('mob.villager.no');
        }
      } //BAN finish
      if (selection === 4) {
        //レポート start

        const players = world.getPlayers();

        const names = players.map((player) => player.name);

        const form = new ModalFormData();
        form.title('§aレポート');
        form.dropdown(
          'どのプレイヤーを通報しますか？\n嘘のレポートを書くと迷惑なので最悪の場合  §cBAN§fされるかもしれません',
          names,
        );
        form.textField('通報内容', '', '');
        form.show(player).then((res) => {
          if (res.canceled) return;

          // 送信先のプレイヤー
          const toPlayer = players[res.formValues[0]];
          // メッセージ
          const message = res.formValues[1];

          if (message === '') return player.sendMessage('§c通報内容がありません');

          world.sendMessage(
            `【§aレポート§f】\n レポートされたプレイヤー:${toPlayer.name} \n [§c通報内容§f]: ${message}\nレポートしたプレイヤー:${player.name}`,
          );
          player.playSound('random.orb');
        });
      } //レポート finish
      if (selection == 5) {
        //アスレチック start
        player.sendMessage('§dアスレチックを選択しました');
        player.playSound('random.orb');
        player.runCommand('tag @s remove lobby');
        player.runCommand('tp @s 0 -57 58');
        player.runCommand('clear @s');
        player.runCommand('gamemode a @s');
        player.runCommand('tag @s add athle');
        player.runCommand('give @s emerald');
      } //アスレチック finish

      if (selection == 6) {
        //トレーニング start
        const cps = world.scoreboard.getObjective('player').getScore('cps');
        const combo = world.scoreboard.getObjective('player').getScore('combo');
        const form = new ActionFormData();
        form.title('トレーニング');
        form.body('練習メニュー');
        form.button(`CPS(連打)測定\n§0プレイ人数:${cps}人`);
        form.button(`コンボ練習\n§0プレイ人数:${combo}人`);
        form.show(player).then(({ selection, canceled }) => {
          if (canceled) return;

          if (selection == 0) {
            player.runCommand('tag @s add cps');
            player.runCommand('tp @s 37 -60 -8');
            player.sendMessage('額縁のアイテムを10秒間アイテムを回しましょう');
            player.sendMessage(
              '必ず正しい測定がでるとはかぎりません\nなぜならクリックの遅延があるためです',
            );
            player.runCommand('clear @s');
            player.playSound('random.orb');
            player.runCommand('gamemode a @s');
          }
          if (selection == 1) {
            player.runCommand('tag @s add combo');
            player.runCommand('spreadplayers 41 20 1 5 @s -59');
            player.sendMessage('村人を殴ってコンボしてみましょう()');
            player.runCommand('clear @s');
            player.runCommand('gamemode a @s');
            player.playSound('random.orb');
            player.runCommand('give @s emerald');
            player.runCommand('execute as @s at @s run structure load villager ~~2~');
          }
        });
      } //トレーニング finish

      if (selection == 7) {
        //スコア表示 start
        const pvp = world.scoreboard.getObjective('pvp').getScore(player);
        const sumo = world.scoreboard.getObjective('sumo').getScore(player);
        const bow = world.scoreboard.getObjective('bow').getScore(player);
        const pot = world.scoreboard.getObjective('pot').getScore(player);
        const spleef = world.scoreboard.getObjective('spleef').getScore(player);
        const form = new ActionFormData();
        form.title('スコア');
        form.body(
          '§aノーマルPVP§f: ' +
            `${pvp}` +
            ' Kill\n§cBow§f: ' +
            `${bow}` +
            ' Kill\n§bSumo§f: ' +
            `${sumo}` +
            ' Kill\n§dPot§f: ' +
            `${pot}` +
            ' Kill\n§eSpleef§f: ' +
            `${spleef}` +
            'Kill',
        );
        form.button('戻る');
        form.show(player).then(({ canceled }) => {
          if (canceled) return;
        });
      } //スコア表示 finish
      if (selection == 8) {
        player.sendMessage(
          '作成者:sunsun099991055 \nアドオン:PEXkurann,sunsun099991055 \nロビー建築:おいしいにく,Dirtstar19 \nアスレチック:yosshi2685,イカ(pikimn),ピンクのあくま,sunsun099991055\n運営:sunsun,shown,lupa,PEX,yosshi,イカ(pikmin)',
        );
        player.playSound('random.orb');
      }
      if (selection == 9) {
        player.sendMessage(`Server TPS:§6${tps}§r`);
      }
    });
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers({ tags: ['ban'] })) {
    world.sendMessage(`§c${player.name} §fは永久BANくらっているため、自動でBANされました`);
    world.playSound('random.totem', player.location, { pitch: 1, volume: 1 });
    player.runCommand(`kick ${player.name}`);
  }
}, 20);
world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;
  const itemStack = ev.itemStack;

  if (itemStack.typeId === 'minecraft:emerald') {
    const form = new ActionFormData();
    form.title('戻る');
    form.button('戻る');
    if (player.hasTag('combo')) {
      form.button('村人召喚');
    }
    form.show(player).then(({ selection, canceled }) => {
      if (canceled) return;
      if (selection == 0) {
        player.runCommand('tag @s remove athle');
        player.playSound('random.orb');
        player.runCommand('tp @s 0 -59 0');
        player.runCommand('tag @s remove combo');
      }
      if (selection == 1) {
        player.runCommand('execute as @s at @s run structure load villager ~~2~');
        player.playSound('random.orb');
        player.sendMessage('村人の召喚に成功しました');
      }
    });
  }
});
