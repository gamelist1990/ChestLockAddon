import { CustomItem } from './index';
import { world, system } from '@minecraft/server';

const test = new CustomItem({
  name: 'ステック',
  lore: ['使用するとsendMessageするよ'],
  item: 'minecraft:stick',
  amount: 1,
  remove: true,
}).then((player) => {
  player.sendMessage('stickアイテムを使用しました');
});

system.run(() => {
  for (const player of world.getAllPlayers()) {
    if (player) {
      test.give(player, 1);
    }
  }
});
