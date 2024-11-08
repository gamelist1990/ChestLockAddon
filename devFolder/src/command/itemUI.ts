import {
  ItemStack,
  EnchantmentType,
  ItemComponentTypes,
  Player,
  EntityComponent,
  ItemEnchantableComponent,
  system,
  EntityInventoryComponent,
} from '@minecraft/server';
import { registerCommand, verifier } from '../Modules/Handler';
import { config } from '../Modules/Util';
import { translate } from './langs/list/LanguageManager';

export const customCommandsConfig = {
  ui: {
    ui_item: 'minecraft:wooden_axe',
    ui_item_name: '§r§6[§aChestLock§6]§r §fUI Item',
    requiredTags: [],
  },
};

function addItemToPlayerInventory(player: Player) {
  const inventoryComponent = player.getComponent('minecraft:inventory') as EntityInventoryComponent;

  if (
    !inventoryComponent ||
    !(inventoryComponent instanceof EntityComponent) ||
    !('container' in inventoryComponent)
  ) {
    return;
  }

  const container = inventoryComponent.container;

  if (!container) {
    return;
  }

  if (container.emptySlotsCount === 0) {
    return player.sendMessage(translate(player, 'commnad.item.FullInv'));
  }

  const currentItem = container.getItem(player.selectedSlotIndex);

  if (
    currentItem?.typeId === customCommandsConfig.ui.ui_item &&
    currentItem?.nameTag === customCommandsConfig.ui.ui_item_name
  ) {
    return player.sendMessage(translate(player, 'commnad.item.AlreadyInv'));
  }

  const item = new ItemStack(customCommandsConfig.ui.ui_item, 1);

  try {
    system.run(() => {
      item.nameTag = customCommandsConfig.ui.ui_item_name;
    });
  } catch (error) { }
  const enchantable = item.getComponent(ItemComponentTypes.Enchantable);

  if (enchantable instanceof ItemEnchantableComponent) {
    system.run(() => {
      enchantable.addEnchantment({
        type: new EnchantmentType('unbreaking'),
        level: 3,
      });
    });
  }

  system.run(() => {
    container.addItem(item);
  });

  player.sendMessage(translate(player, 'commnad.item.AddInv'));
}

registerCommand({
  name: 'item',
  description: 'item_docs',
  parent: false,
  maxArgs: 1,
  minArgs: 1,
  require: (player: Player) => verifier(player, config().commands['item']),
  executor: (player: Player) => addItemToPlayerInventory(player),
});
