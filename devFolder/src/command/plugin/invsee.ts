import { config } from '../../Modules/Util';
import { registerCommand, verifier, isPlayer } from '../../Modules/Handler';
import { EquipmentSlot, Player, system, ItemStack } from '@minecraft/server'; // ItemStack をインポート
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';
import { projectPlayerInventory } from '../../Modules/inv';
import { translate } from '../langs/list/LanguageManager';

const ITEMS_PER_PAGE = 9;

registerCommand({
  name: 'invsee',
  description: 'invsee_docs',
  parent: false,
  maxArgs: 1,
  minArgs: 1,
  require: (player: Player) => verifier(player, config().commands['invsee']),
  executor: (player: Player, args: string[]) => {
    const targetPlayerName = args[0];
    const targetPlayer = isPlayer(targetPlayerName);

    if (targetPlayer) {
      system.runTimeout(() => {
        showArmorHotbarOptions(player, targetPlayer);
      }, 20 * 5);
    } else {
      player.sendMessage(
        translate(player, 'commands.list.playerNotFound', { tragetplayer: `${targetPlayerName}` }),
      );
    }
  },
});

function showArmorHotbarOptions(player: Player, targetPlayer: Player) {
  const form = new ActionFormData()
    .title(translate(player, 'command.invsee.title', { targetPlayer: `${targetPlayer.name}` }))
    .button('HotBar')
    .button('Armor')
    .button('Inventory')
    .button('ChestUI');
  // @ts-ignore
  form.show(player).then((response) => {
    if (response.selection === 0) {
      showHotbar(player, targetPlayer);
    } else if (response.selection === 1) {
      showArmor(player, targetPlayer);
    } else if (response.selection === 2) {
      showInventory(player, targetPlayer, 0);
    } else if (response.selection === 3) {
      projectPlayerInventory(targetPlayer, player);
    }
  });
}

function showHotbar(player: Player, targetPlayer: Player) {
  const targetInv = targetPlayer.getComponent('inventory')?.container;
  const playerInv = player.getComponent('inventory')?.container;

  const form = new ActionFormData().title(`§4${targetPlayer.nameTag}'s Hotbar§4`);

  if (targetInv) {
    for (let i = 0; i < 9; i++) {
      const item = targetInv.getItem(i);
      if (item) {
        const itemName = item.typeId.replace('minecraft:', '');
        const texturePath = getTexturePath(itemName);
        form.button(`${itemName} x${item.amount}`, `textures/${texturePath}`);
      } else {
        form.button('Empty Slot', 'textures/ui/slots_bg');
      }
    }

    form.button('Inventory', 'textures/ui/inventory_icon');
    form.button('Armor', 'textures/items/diamond_chestplate');
    //@ts-ignore
    form.show(player).then((result: ActionFormResponse) => {
      if (result.canceled) {
        return;
      }

      if (result.selection === 9) {
        showInventory(player, targetPlayer, 0);
      } else if (result.selection === 10) {
        showArmor(player, targetPlayer);
      } else {
        const selectedItemIndex = result.selection;
        if (selectedItemIndex !== undefined && playerInv) {
          showHotbarItemActions(player, targetPlayer, selectedItemIndex, playerInv);
        }
      }
    });
  }
}

function showHotbarItemActions(
  player: Player,
  targetPlayer: Player,
  selectedItemIndex: number,
  playerInv: any,
) {
  const targetInv = targetPlayer.getComponent('inventory')?.container;

  const item = targetInv?.getItem(selectedItemIndex);

  if (!item) {
    return;
  }

  const itemName = item.typeId.replace('minecraft:', '');
  const form = new ActionFormData()
    .title(`§4${itemName} x${item.amount}§4`)
    .button('Copy')
    .button('Delete')
    .button('Back');

  // @ts-ignore
  form.show(player).then((result) => {
    if (result.canceled) {
      return;
    }
    if (result.selection === 0) {
      // Copy item
      if (playerInv) {
        const itemToCopy = targetInv?.getItem(selectedItemIndex);
        if (itemToCopy) {
          playerInv.addItem(itemToCopy);
          player.sendMessage(`§aCopied ${itemName} x${itemToCopy.amount}`);
        }
      }
    } else if (result.selection === 1) {
      // Delete item
      if (targetInv) {
        targetInv.setItem(selectedItemIndex, new ItemStack('minecraft:air'));
        player.sendMessage(`§cDeleted ${itemName} x${item.amount}`);
      }
    }

    showHotbar(player, targetPlayer);
  });
}

function showArmor(player: Player, targetPlayer: Player) {
  const armorSlots = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
  const form = new ActionFormData().title(`§4${targetPlayer.nameTag}'s Armor§4`);
  let armorData: (ItemStack | undefined)[] = fetchPlayerEquipments(targetPlayer);

  armorSlots.forEach((slotName, index) => {
    const armorItem = armorData[index];

    if (armorItem) {
      const itemName = armorItem.typeId.replace('minecraft:', '');
      const texturePath = getTexturePath(itemName);
      form.button(`${slotName}: ${itemName}`, `textures/${texturePath}`);
    } else {
      form.button(`${slotName}: Empty Slot`, 'textures/ui/slots_bg');
    }
  });

  form.button('Inventory', 'textures/ui/inventory_icon');
  form.button('Hotbar', 'textures/items/iron_sword');
  //@ts-ignore

  form.show(player).then((result) => {
    if (result.canceled) {
      return;
    }

    if (result.selection === 4) {
      showInventory(player, targetPlayer, 0);
    } else if (result.selection === 5) {
      showHotbar(player, targetPlayer);
    } else {
      const selectedItemIndex = result.selection;
      if (selectedItemIndex !== undefined) {
        showArmorItemActions(player, targetPlayer, selectedItemIndex);
      }
    }
  });
}

function showArmorItemActions(player: Player, targetPlayer: Player, selectedItemIndex: number) {
  const playerInv = player.getComponent('inventory')?.container;
  const targetEquipment = targetPlayer.getComponent('equippable');

  const item = fetchPlayerEquipments(targetPlayer)[selectedItemIndex];

  if (!item) {
    return;
  }

  const itemName = item.typeId.replace('minecraft:', '');
  const form = new ActionFormData()
    .title(`§4${itemName} x${item.amount}§4`)
    .button('Copy')
    .button('Delete')
    .button('Back');

  // @ts-ignore
  form.show(player).then((result) => {
    if (result.canceled) {
      return;
    }
    if (result.selection === 0) {
      // Copy item
      if (playerInv && targetEquipment) {
        const equipmentSlot: EquipmentSlot =
          selectedItemIndex === 0
            ? EquipmentSlot.Head
            : selectedItemIndex === 1
              ? EquipmentSlot.Chest
              : selectedItemIndex === 2
                ? EquipmentSlot.Legs
                : EquipmentSlot.Feet;
        const copiedItem = targetEquipment.getEquipment(equipmentSlot);
        if (copiedItem) {
          playerInv.addItem(copiedItem);
          player.sendMessage(`§aCopied ${itemName} x${copiedItem.amount}`);
        }
      }
    } else if (result.selection === 1) {
      // Delete item
      if (targetEquipment) {
        const equipmentSlot: EquipmentSlot =
          selectedItemIndex === 0
            ? EquipmentSlot.Head
            : selectedItemIndex === 1
              ? EquipmentSlot.Chest
              : selectedItemIndex === 2
                ? EquipmentSlot.Legs
                : EquipmentSlot.Feet;
        targetEquipment.setEquipment(equipmentSlot, new ItemStack('minecraft:air'));
        player.sendMessage(`§cDeleted ${itemName} x${item.amount}`);
      }
    }
    showArmor(player, targetPlayer);
  });
}

function fetchPlayerEquipments(player: Player): (ItemStack | undefined)[] {
  const equipment = player.getComponent('equippable');
  if (!equipment) {
    return [];
  }
  return [
    equipment.getEquipment(EquipmentSlot.Head),
    equipment.getEquipment(EquipmentSlot.Chest),
    equipment.getEquipment(EquipmentSlot.Legs),
    equipment.getEquipment(EquipmentSlot.Feet),
    equipment.getEquipment(EquipmentSlot.Offhand),
  ];
}

function showInventory(player: Player, targetPlayer: Player, currentPage = 0) {
  const targetInv = targetPlayer.getComponent('inventory')?.container;
  const playerInv = player.getComponent('inventory')?.container;

  let inventoryData: ItemStack[] = [];
  let slotData: number[] = []; // スロット番号を格納する配列

  if (targetInv) {
    for (let i = 0; i < targetInv.size; i++) {
      const item = targetInv.getItem(i);
      if (item) {
        inventoryData.push(item);
        slotData.push(i); // アイテムがあるスロット番号を格納
      }
    }
  }

  const totalPages = Math.ceil(inventoryData.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, inventoryData.length);

  const form = new ActionFormData().title(
    `§4${targetPlayer.nameTag}'s Inventory (${currentPage + 1}/${totalPages})§4`,
  );

  for (let i = startIndex; i < endIndex; i++) {
    const item = inventoryData[i];
    const itemName = item.typeId.replace('minecraft:', '');
    const texturePath = getTexturePath(itemName);
    form.button(`${itemName} x${item.amount}`, `textures/${texturePath}`);
  }

  let buttonIndex = endIndex - startIndex;
  if (currentPage > 0) {
    form.button('Previous Page', 'textures/ui/arrowLeft');
    buttonIndex++;
  }
  if (currentPage < totalPages - 1) {
    form.button('Next Page', 'textures/ui/arrowRight');
    buttonIndex++;
  }

  form.button('Hotbar', 'textures/items/iron_sword');
  form.button('Armor', 'textures/items/diamond_chestplate');
  //@ts-ignore

  form.show(player).then((result) => {
    if (result.canceled) {
      return;
    }

    if (result.selection !== undefined) {
      if (currentPage > 0 && result.selection === buttonIndex - 2) {
        showInventory(player, targetPlayer, currentPage - 1);
      } else if (currentPage < totalPages - 1 && result.selection === buttonIndex - 1) {
        showInventory(player, targetPlayer, currentPage + 1);
      } else if (result.selection === buttonIndex) {
        showHotbar(player, targetPlayer);
      } else if (result.selection === buttonIndex + 1) {
        showArmor(player, targetPlayer);
      } else {
        const selectedItemIndex = startIndex + result.selection;
        const realSlotIndex = slotData[selectedItemIndex]; // 実際のインベントリのスロット番号を取得

        if (playerInv) {
          showInventoryItemActions(player, targetPlayer, realSlotIndex);
        }
      }
    }
  });
}

function showInventoryItemActions(player: Player, targetPlayer: Player, realSlotIndex: number) {
  const targetInv = targetPlayer.getComponent('inventory')?.container;
  const playerInv = player.getComponent('inventory')?.container;

  const item = targetInv?.getItem(realSlotIndex);

  if (!item) {
    return;
  }

  const itemName = item.typeId.replace('minecraft:', '');
  const form = new ActionFormData()
    .title(`§4${itemName} x${item.amount}§4`)
    .button('Copy')
    .button('Delete')
    .button('Back');

  // @ts-ignore
  form.show(player).then((result) => {
    if (result.canceled) {
      return;
    }
    if (result.selection === 0) {
      // Copy item
      if (playerInv) {
        const itemToCopy = targetInv?.getItem(realSlotIndex);
        if (itemToCopy) {
          playerInv.addItem(itemToCopy);
          player.sendMessage(`§aCopied ${itemName} x${itemToCopy.amount}`);
        }
      }
    } else if (result.selection === 1) {
      // Delete item
      if (targetInv) {
        targetInv.setItem(realSlotIndex, new ItemStack('minecraft:air'));
        player.sendMessage(`§cDeleted ${itemName} x${item.amount}`);
      }
    }

    showInventory(player, targetPlayer, 0);
  });
}

function getTexturePath(itemId: string) {
  const textures = new Map([
    ['apple', 'items/apple'],
    ['iron_sword', 'items/iron_sword'],
    ['diamond', 'items/diamond'],
    //blocks
    ['oak_planks', 'blocks/planks_oak'],
    ['acacia_button', 'blocks/planks_acacia'],
    ['acacia_door', 'blocks/door_acacia_upper'],
    ['acacia_fence', 'blocks/planks_acacia'],
    ['acacia_fence_gate', 'blocks/planks_acacia'],
    ['acacia_hanging_sign', 'blocks/acacia_hanging_sign'],
    ['acacia_log', 'blocks/log_acacia'],
    ['acacia_pressure_plate', 'blocks/planks_acacia'],
    ['acacia_stairs', 'blocks/planks_acacia'],
    ['acacia_standing_sign', 'items/sign_acacia'],
    ['acacia_trapdoor', 'blocks/acacia_trapdoor'],
    ['acacia_wall_sign', 'items/sign_acacia'],
    ['activator_rail', 'blocks/rail_activator'],
    ['air', ''],
    ['allow', 'blocks/build_allow'],
    ['amethyst_block', 'blocks/amethyst_block'],
    ['amethyst_cluster', 'blocks/amethyst_cluster'],
    ['ancient_debris', 'blocks/ancient_debris_side'],
    ['andesite_stairs', 'blocks/stone_andesite'],
    ['anvil', 'blocks/anvil_top_damaged_0'],
    ['azalea', 'blocks/azalea_side'],
    ['azalea_leaves', 'blocks/azalea_leaves'],
    ['azalea_leaves_flowered', 'blocks/azalea_leaves_flowers'],
    ['bamboo', 'blocks/bamboo'],
    ['bamboo_block', 'blocks/bamboo_block'],
    ['bamboo_button', 'blocks/bamboo'],
    ['bamboo_door', 'items/bamboo_door'],
    ['bamboo_double_slab', 'blocks/bamboo'],
    ['bamboo_fence', 'blocks/bamboo_fence'],
    ['bamboo_fence_gate', 'blocks/bamboo_fence_gate'],
    ['bamboo_hanging_sign', 'blocks/bamboo_hanging_sign'],
    ['bamboo_mosaic', 'blocks/bamboo_mosaic'],
    ['bamboo_mosaic_double_slab', 'blocks/bamboo_mosaic'],
    ['bamboo_mosaic_slab', 'blocks/bamboo_mosaic'],
    ['bamboo_mosaic_stairs', 'blocks/bamboo_mosaic'],
    ['bamboo_planks', 'blocks/bamboo_planks'],
    ['bamboo_pressure_plate', 'blocks/bamboo_plank'],
    ['bamboo_sapling', 'blocks/bamboo_sapling'],
    ['bamboo_slab', 'blocks/bamboo_plank'],
    ['bamboo_stairs', 'blocks/bamboo_plank'],
    ['bamboo_standing_sign', 'items/bamboo_sign'],
    ['bamboo_trapdoor', 'blocks/bamboo_trapdoor'],
    ['bamboo_wall_sign', 'items/bamboo_sign'],
    ['barrel', 'blocks/barrel_side'],
    ['barrier', 'blocks/barrier'],
    ['basalt', 'blocks/basalt_side'],
    ['beacon', 'blocks/beacon'],
    ['bed', 'items/bed_red'],
    ['bedrock', 'blocks/bedrock'],
    ['bee_nest', 'blocks/bee_nest_side'],
    ['beehive', 'blocks/beehive_side'],
    ['beetroot', 'blocks/beetroot'],
    ['bell', 'blocks/beehive_side'],
    ['big_dripleaf', 'blocks/big_dripleaf_side1'],
    ['birch_button', 'blocks/planks_birch'],
    ['birch_door', 'blocks/door_birch_upper'],
    ['birch_fence', 'blocks/planks_birch'],
    ['birch_fence_gate', 'blocks/planks_birch'],
    ['birch_hanging_sign', 'blocks/birch_hanging_sign'],
    ['birch_log', 'blocks/log_birch_top'],
    ['birch_pressure_plate', 'blocks/planks_birch'],
    ['birch_stairs', 'blocks/planks_birch'],
    ['birch_standing_sign', 'items/sign_birch'],
    ['birch_trapdoor', 'blocks/birch_trapdoor'],
    ['birch_wall_sign', 'items/sign_birch'],
    ['black_candle', 'blocks/candles/black_candle'],
    ['black_candle_cake', 'blocks/candles/black_candle'],
    ['black_carpet', 'blocks/wool_colored_black'],
    ['black_concrete', 'blocks/concrete_black'],
    ['black_glazed_terracotta', 'blocks/glazed_terracotta_black'],
    ['black_shulker_box', 'blocks/shulker_top_black'],
    ['black_wool', 'blocks/wool_colored_black'],
    ['blackstone', 'blocks/blackstone'],
    ['blackstone_double_slab', 'blocks/blackstone'],
    ['blackstone_slab', 'blocks/blackstone'],
    ['blackstone_stairs', 'blocks/blackstone'],
    ['blackstone_wall', 'blocks/blackstone'],
    ['blast_furnace', 'blocks/blast_furnace_front_off'],
    ['blue_candle', 'blocks/candles/blue_candle'],
    ['blue_candle_cake', 'blocks/candles/blue_candle'],
    ['blue_carpet', 'blocks/wool_colored_blue'],
    ['blue_concrete', 'blocks/concrete_blue'],
    ['blue_glazed_terracotta', 'blocks/glazed_terracotta_blue'],
    ['blue_ice', 'blocks/blue_ice'],
    ['blue_shulker_box', 'blocks/shulker_top_blue'],
    ['blue_wool', 'blocks/wool_colored_blue'],
    ['bone_block', 'blocks/bone_block_side'],
    ['bookshelf', 'blocks/bookshelf'],
    ['border_block', 'blocks/border'],
    ['brain_coral', 'blocks/coral_fan_pink'],
    ['brewing_stand', 'blocks/brewing_stand'],
    ['brick_block', 'blocks/brick'],
    ['brick_stairs', 'blocks/brick'],
    ['brown_candle', 'blocks/candles/brown_candle'],
    ['brown_candle_cake', 'blocks/candles/brown_candle'],
    ['brown_carpet', 'blocks/wool_colored_brown'],
    ['brown_concrete', 'blocks/concrete_brown'],
    ['brown_glazed_terracotta', 'blocks/glazed_terracotta_brown'],
    ['brown_mushroom', 'blocks/mushroom_brown'],
    ['brown_mushroom_block', 'blocks/mushroom_brown'],
    ['brown_shulker_box', 'blocks/shulker_top_brown'],
    ['brown_wool', 'blocks/wool_colored_brown'],
    ['bubble_column', 'blocks/bubble_column_down_top_a'],
    ['bubble_coral', 'blocks/coral_fan_pink'],
    ['budding_amethyst', 'blocks/budding_amethyst'],
    ['cactus', 'blocks/cactus_side'],
    ['cake', 'blocks/cake'],
    ['calcite', 'blocks/calcite'],
    ['calibrated_sculk_sensor', 'blocks/calibrated_sculk_sensor_input_side'],
    ['camera', 'blocks/camera_side'],
    ['campfire', 'blocks/campfire'],
    ['candle', 'blocks/candle'],
    ['candle_cake', 'blocks/candle'],
    ['carrots', 'items/carrot'],
    ['cartography_table', 'blocks/cartography_table_side2'],
    ['carved_pumpkin', 'blocks/pumpkin_face_off'],
    ['cauldron', 'blocks/cauldron'],
    ['cave_vines', 'blocks/cave_vines_body'],
    ['cave_vines_body_with_berries', 'blocks/cave_vines_body_berries'],
    ['cave_vines_head_with_berries', 'blocks/cave_vines_head_berries'],
    ['chain', 'blocks/chain'],
    ['chain_command_block', 'blocks/chain_command_block_side_mipmap'],
    ['chemical_heat', ''],
    ['chemistry_table', ''],
    ['cherry_button', 'blocks/cherry_planks'],
    ['cherry_door', 'items/cherry_door'],
    ['cherry_double_slab', 'blocks/cherry_planks'],
    ['cherry_fence', 'blocks/cherry_planks'],
    ['cherry_fence_gate', 'blocks/cherry_planks'],
    ['cherry_hanging_sign', 'blocks/cherry_hanging_sign'],
    ['cherry_leaves', 'blocks/cherry_leaves'],
    ['cherry_log', 'blocks/cherry_log_side'],
    ['cherry_planks', 'blocks/cherry_planks'],
    ['cherry_pressure_plate', 'blocks/cherry_planks'],
    ['cherry_sapling', 'blocks/cherry_sapling'],
    ['cherry_slab', 'blocks/cherry_planks'],
    ['cherry_stairs', 'blocks/cherry_planks'],
    ['cherry_standing_sign', 'items/cherry_sign'],
    ['cherry_trapdoor', 'blocks/cherry_trapdoor'],
    ['cherry_wall_sign', 'items/cherry_sign'],
    ['cherry_wood', 'blocks/cherry_log_top'],
    ['chest', 'blocks/chest_front'],
    ['chiseled_bookshelf', 'blocks/chiseled_bookshelf_side'],
    ['chiseled_deepslate', 'blocks/deepslate/chiseled_deepslate'],
    ['chiseled_nether_bricks', 'blocks/chiseled_nether_bricks'],
    ['chiseled_polished_blackstone', 'blocks/chiseled_polished_blackstone'],
    ['chorus_flower', 'blocks/chorus_flower'],
    ['chorus_plant', 'blocks/chorus_plant'],
    ['clay', 'blocks/clay'],
    ['client_request_placeholder_block', ''],
    ['coal_block', 'blocks/coal_block'],
    ['coal_ore', 'blocks/coal_ore'],
    ['cobbled_deepslate', 'blocks/deepslate/cobbled_deepslate'],
    ['cobbled_deepslate_double_slab', 'blocks/deepslate/cobbled_deepslate'],
    ['cobbled_deepslate_slab', 'blocks/deepslate/cobbled_deepslate'],
    ['cobbled_deepslate_stairs', 'blocks/deepslate/cobbled_deepslate'],
    ['cobbled_deepslate_wall', 'blocks/deepslate/cobbled_deepslate'],
    ['cobblestone', 'blocks/cobblestone'],
    ['cobblestone_wall', 'blocks/cobblestone'],
    ['cocoa', 'blocks/cocoa_stage_2'],
    ['colored_torch_bp', ''],
    ['colored_torch_rg', ''],
    ['command_block', 'blocks/command_block'],
    ['composter', 'blocks/composter_side'],
    ['concrete_powder', 'blocks/concrete_powder_gray'],
    ['conduit', 'blocks/conduit_open'],
    ['copper_block', 'blocks/copper_block'],
    ['copper_ore', 'blocks/copper_ore'],
    ['coral_block', 'blocks/coral_blue'],
    ['coral_fan', 'blocks/coral_fan_blue'],
    ['coral_fan_dead', 'blocks/coral_fan_blue_dead'],
    ['coral_fan_hang', 'blocks/coral_fan_blue'],
    ['coral_fan_hang2', 'blocks/coral_fan_pink'],
    ['coral_fan_hang3', 'blocks/coral_fan_yellow'],
    ['cracked_deepslate_bricks', 'blocks/deepslate/cracked_deepslate_bricks'],
    ['cracked_deepslate_tiles', 'blocks/deepslate/cracked_deepslate_tiles'],
    ['cracked_nether_bricks', 'blocks/cracked_nether_bricks'],
    ['cracked_polished_blackstone_bricks', 'blocks/cracked_polished_blackstone_bricks'],
    ['crafting_table', 'blocks/crafting_table_front'],
    ['crimson_button', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_door', 'items/crimson_door'],
    ['crimson_double_slab', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_fence', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_fence_gate', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_fungus', 'blocks/crimson_fungus'],
    ['crimson_hanging_sign', 'items/crimson_hanging_sign'],
    ['crimson_hyphae', 'blocks/huge_fungus/crimson_log_side'],
    ['crimson_nylium', 'blocks/crimson_nylium_side'],
    ['crimson_planks', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_pressure_plate', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_roots', 'blocks/crimson_roots'],
    ['crimson_slab', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_stairs', 'blocks/huge_fungus/crimson_planks'],
    ['crimson_standing_sign', 'items/sign_crimson'],
    ['crimson_stem', 'blocks/huge_fungus/crimson_log_side'],
    ['crimson_trapdoor', 'blocks/crimson_trapdoor'],
    ['crimson_wall_sign', 'items/sign_crimson'],
    ['crying_obsidian', 'blocks/crying_obsidian'],
    ['cut_copper', 'blocks/cut_copper'],
    ['cut_copper_slab', 'blocks/cut_copper'],
    ['cut_copper_stairs', 'blocks/cut_copper'],
    ['cyan_candle', 'blocks/cyan_candle'],
    ['cyan_candle_cake', 'blocks/candles/cyan_candle'],
    ['cyan_carpet', 'blocks/wool_colored_cyan'],
    ['cyan_concrete', 'blocks/concrete_cyan'],
    ['cyan_glazed_terracotta', 'blocks/glazed_terracotta_cyan'],
    ['cyan_shulker_box', 'blocks/shulker_top_cyan'],
    ['cyan_wool', 'blocks/wool_colored_cyan'],
    ['dark_oak_button', 'blocks/planks_big_oak'],
    ['dark_oak_door', 'items/door_dark_oak'],
    ['dark_oak_fence', 'blocks/planks_big_oak'],
    ['dark_oak_fence_gate', 'blocks/planks_big_oak'],
    ['dark_oak_hanging_sign', 'items/dark_oak_hanging_sign'],
    ['dark_oak_log', 'blocks/log_big_oak'],
    ['dark_oak_pressure_plate', 'blocks/planks_big_oak'],
    ['dark_oak_stairs', 'blocks/planks_big_oak'],
    ['dark_oak_trapdoor', 'blocks/dark_oak_trapdoor'],
    ['dark_prismarine_stairs', 'blocks/prismarine_dark'],
    ['darkoak_standing_sign', 'items/sign_darkoak'],
    ['darkoak_wall_sign', 'items/sign_darkoak'],
    ['daylight_detector', 'blocks/daylight_detector_top'],
    ['daylight_detector_inverted', 'blocks/daylight_detector_inverted_top'],
    ['dead_brain_coral', 'blocks/coral_plant_purple_dead'],
    ['dead_bubble_coral', 'blocks/coral_plant_pink_dead'],
    ['dead_fire_coral', 'blocks/coral_plant_red_dead'],
    ['dead_horn_coral', 'blocks/coral_plant_yellow_dead'],
    ['dead_tube_coral', 'blocks/coral_plant_blue_dead'],
    ['deadbush', 'blocks/deadbush'],
    ['decorated_pot', 'blocks/decorated_pot_side'],
    ['deepslate', 'blocks/deepslate/deepslate'],
    ['deepslate_brick_double_slab', 'blocks/deepslate/deepslate_bricks'],
    ['deepslate_brick_slab', 'blocks/deepslate/deepslate_bricks'],
    ['deepslate_brick_stairs', 'blocks/deepslate/deepslate_bricks'],
    ['deepslate_brick_wall', 'blocks/deepslate/deepslate_bricks'],
    ['deepslate_bricks', 'blocks/deepslate/deepslate_bricks'],
    ['deepslate_coal_ore', 'blocks/deepslate/deepslate_coal_ore'],
    ['deepslate_copper_ore', 'blocks/deepslate/deepslate_copper_ore'],
    ['deepslate_diamond_ore', 'blocks/deepslate/deepslate_diamond_ore'],
    ['deepslate_emerald_ore', 'blocks/deepsalte/deepslate_emerald_ore'],
    ['deepslate_gold_ore', 'blocks/deepslate/deepslate_gold_ore'],
    ['deepslate_iron_ore', 'blocks/deepslate/deepslate_iron_ore'],
    ['deepslate_lapis_ore', 'blocks/deepslate/deepslate_lapis_ore'],
    ['deepslate_redstone_ore', 'blocks/deepslate/deepslate_redstone_ore'],
    ['deepslate_tile_double_slab', 'blocks/deepslate/deepslate_tiles'],
    ['deepslate_tile_slab', 'blocks/deepslate/deepslate_tiles'],
    ['deepslate_tile_stairs', 'blocks/deepslate/deepslate_tiles'],
    ['deepslate_tile_wall', 'blocks/deepslate/deepslate_tiles'],
    ['deepslate_tiles', 'blocks/deepslate/deepslate_tiles'],
    ['deny', 'blocks/build_deny'],
    ['detector_rail', 'blocks/rail_detector'],
    ['diamond_block', 'blocks/diamond_block'],
    ['diamond_ore', 'blocks/diamond_ore'],
    ['diorite_stairs', 'blocks/stone_diorite'],
    ['dirt', 'blocks/dirt'],
    ['dirt_with_roots', 'blocks/dirt_with_roots'],
    ['dispenser', 'blocks/dispenser_front_horizontal'],
    ['double_cut_copper_slab', 'blocks/cut_copper'],
    ['double_plant', 'blocks/double_plant_fern_carried'],
    ['double_stone_block_slab', 'blocks/stone_slab_side'],
    ['double_stone_block_slab2', 'blocks/red_sandstone_bottom'],
    ['double_stone_block_slab3', 'blocks/end_bricks'],
    ['double_stone_block_slab4', 'blocks/stonebrick'],
    ['double_wooden_slab', 'blocks/planks_oak'],
    ['dragon_egg', 'blocks/dragon_egg'],
    ['dried_kelp_block', 'blocks/dried_kelp_top'],
    ['dripstone_block', 'blocks/dripstone_block'],
    ['dropper', 'blocks/dropper_front_horizontal'],
    ['emerald_block', 'blocks/emerald_block'],
    ['emerald_ore', 'blocks/emerald_ore'],
    ['enchanting_table', 'blocks/enchanting_table_side'],
    ['end_brick_stairs', 'blocks/end_bricks'],
    ['end_bricks', 'blocks/end_bricks'],
    ['end_gateway', 'blocks/end_gateway'],
    ['end_portal', 'blocks/end_portal'],
    ['end_portal_frame', 'blocks/endframe_top'],
    ['end_rod', 'blocks/end_rod'],
    ['end_stone', 'blocks/end_stone'],
    ['ender_chest', 'blocks/ender_chest_front'],
    ['exposed_copper', 'blocks/exposed_copper'],
    ['exposed_cut_copper', 'blocks/exposed_cut_copper'],
    ['exposed_cut_copper_slab', 'blocks/exposed_cut_copper'],
    ['exposed_cut_copper_stairs', 'blocks/exposed_cut_copper'],
    ['exposed_double_cut_copper_slab', 'blocks/cut_copper'],
    ['farmland', 'blocks/farmland_dry'],
    ['fence_gate', 'blocks/planks_oak'],
    ['fire', 'blocks/fire_1_placeholder'],
    ['fire_coral', 'blocks/coral_fan_red'],
    ['fletching_table', 'blocks/fletcher_table_side1'],
    ['flower_pot', 'blocks/flower_pot'],
    ['flowering_azalea', 'blocks/flowering_azalea_side'],
    ['flowing_lava', 'blocks/lava_placeholder'],
    ['flowing_water', 'blocks/water_placeholder'],
    ['frame', 'blocks/itemframe_background'],
    ['frog_spawn', 'blocks/frogspawn'],
    ['frosted_ice', 'blocks/frosted_ice_0'],
    ['furnace', 'blocks/furnace_front_off'],
    ['gilded_blackstone', 'blocks/gilded_blackstone'],
    ['glass', 'blocks/glass'],
    ['glass_pane', 'blocks/glass_pane_top'],
    ['glow_frame', 'blocks/glow_item_frame'],
    ['glow_lichen', 'blocks/glow_lichen'],
    ['glowingobsidian', 'blocks/glowing_obsidian'],
    ['glowstone', 'blocks/glowstone'],
    ['gold_block', 'blocks/gold_block'],
    ['gold_ore', 'blocks/gold_ore'],
    ['golden_rail', 'blocks/rail_golden'],
    ['granite_stairs', 'blocks/stone_granite'],
    ['grass', 'blocks/grass_side_carried'],
    ['grass_path', 'blocks/grass_path_side'],
    ['gravel', 'blocks/gravel'],
    ['gray_candle', 'blocks/candles/gray_candle'],
    ['gray_candle_cake', 'blocks/candles/gray_candle'],
    ['gray_carpet', 'blocks/wool_colored_gray'],
    ['gray_concrete', 'blocks/concrete_gray'],
    ['gray_glazed_terracotta', 'blocks/glazed_terracotta_gray'],
    ['gray_shulker_box', 'blocks/shulker_top_gray'],
    ['gray_wool', 'blocks/wool_colored_gray'],
    ['green_candle', 'blocks/candles/green_candle'],
    ['green_candle_cake', 'blocks/candles/green_candle'],
    ['green_carpet', 'blocks/wool_colored_green'],
    ['green_concrete', 'blocks/concrete_green'],
    ['green_glazed_terracotta', 'blocks/glazed_terracotta_green'],
    ['green_shulker_box', 'blocks/shulker_top_green'],
    ['green_wool', 'blocks/wool_colored_green'],
    ['grindstone', 'blocks/grindstone_side'],
    ['hanging_roots', 'blocks/hanging_roots'],
    ['hard_glass', 'blocks/glass'],
    ['hard_glass_pane', 'blocks/glass_pane_top'],
    ['hard_stained_glass', 'blocks/glass_blue'],
    ['hard_stained_glass_pane', 'blocks/glass_pane_top_cyan'],
    ['hardened_clay', 'blocks/hardened_clay'],
    ['hay_block', 'blocks/hay_block_side'],
    ['heavy_weighted_pressure_plate', 'blocks/iron_block'],
    ['honey_block', 'blocks/honey_side'],
    ['honeycomb_block', 'blocks/honeycomb'],
    ['hopper', 'items/hopper'],
    ['horn_coral', 'blocks/coral_yellow'],
    ['ice', 'blocks/ice'],
    ['infested_deepslate', 'blocks/deepslate/deepslate'],
    ['info_update', 'misc/missing_texture'],
    ['info_update2', 'misc/missing_texture'],
    ['invisible_bedrock', 'blocks/bedrock'],
    ['iron_bars', 'blocks/iron_bars'],
    ['iron_block', 'blocks/iron_block'],
    ['iron_door', 'items/door_iron'],
    ['iron_ore', 'blocks/iron_ore'],
    ['iron_trapdoor', 'blocks/iron_trapdoor'],
    ['jigsaw', 'blocks/jigsaw_front'],
    ['jukebox', 'blocks/jukebox_top'],
    ['jungle_button', 'blocks/planks_jungle'],
    ['jungle_door', 'items/door_jungle'],
    ['jungle_fence', 'blocks/planks_jungle'],
    ['jungle_fence_gate', 'blocks/planks_jungle'],
    ['jungle_hanging_sign', 'items/jungle_hanging_sign'],
    ['jungle_log', 'blocks/log_jungle_top'],
    ['jungle_pressure_plate', 'blocks/planks_jungle'],
    ['jungle_stairs', 'blocks/planks_jungle'],
    ['jungle_standing_sign', 'items/sign_jungle'],
    ['jungle_trapdoor', 'blocks/jungle_trapdoor'],
    ['jungle_wall_sign', 'items/sign_jungle'],
    ['kelp', 'items/kelp'],
    ['ladder', 'blocks/ladder'],
    ['lantern', 'blocks/lantern'],
    ['lapis_block', 'blocks/lapis_block'],
    ['lapis_ore', 'blocks/lapis_ore'],
    ['large_amethyst_bud', 'blocks/large_amethyst_bud'],
    ['lava', 'blocks/lava_still'],
    ['leaves', 'blocks/leaves_oak_carried'],
    ['leaves2', 'blocks/leaves_acacia_carried'],
    ['lectern', 'blocks/lectern_base'],
    ['lever', 'blocks/lever'],
    ['light_block', 'items/light_block_0'],
    ['light_blue_candle', 'blocks/candles/light_blue_candle'],
    ['light_blue_candle_cake', 'blocks/candles/light_blue_candle'],
    ['light_blue_carpet', 'blocks/wool_colored_light_blue'],
    ['light_blue_concrete', 'blocks/concrete_light_blue'],
    ['light_blue_glazed_terracotta', 'blocks/glazed_terracotta_light_blue'],
    ['light_blue_shulker_box', 'blocks/shulker_top_light_blue'],
    ['light_blue_wool', 'blocks/wool_colored_light_blue'],
    ['light_gray_candle', 'block/candles/light_gray_candle'],
    ['light_gray_candle_cake', 'block/candles/light_gray_candle'],
    ['light_gray_carpet', 'blocks/wool_colored_light_gray'],
    ['light_gray_concrete', 'blocks/concrete_light_gray'],
    ['light_gray_shulker_box', 'blocks/shulker_top_light_gray'],
    ['light_gray_wool', 'blocks/wool_colored_light_gray'],
    ['light_weighted_pressure_plate', 'blocks/gold_block'],
    ['lightning_rod', 'blocks/lightning_rod'],
    ['lime_candle', 'blocks/candles/lime_candle'],
    ['lime_candle_cake', 'blocks/candles/lime_candle'],
    ['lime_carpet', 'blocks/wool_colored_lime'],
    ['lime_concrete', 'blocks/concrete_lime'],
    ['lime_glazed_terracotta', 'blocks/glazed_terracotta_lime'],
    ['lime_shulker_box', 'blocks/shulker_top_lime'],
    ['lime_wool', 'blocks/wool_colored_lime'],
    ['lit_blast_furnace', 'blocks/blast_furnace_front_on'],
    ['lit_deepslate_redstone_ore', 'blocks/deepsalte/deepslate_redstone_ore'],
    ['lit_furnace', 'blocks/furnace_front_on'],
    ['lit_pumpkin', 'blocks/pumpkin_face_on'],
    ['lit_redstone_lamp', 'blocks/redstone_lamp_on'],
    ['lit_redstone_ore', 'blocks/redstone_ore'],
    ['lit_smoker', 'blocks/smoker_front_on'],
    ['lodestone', 'blocks/lodestone_side'],
    ['loom', 'blocks/loom_front'],
    ['magenta_candle', 'blocks/candles/magenta_candle'],
    ['magenta_candle_cake', 'blocks/candles/magenta_candle'],
    ['magenta_carpet', 'blocks/wool_colored_magenta'],
    ['magenta_concrete', 'blocks/concrete_magenta'],
    ['magenta_glazed_terracotta', 'blocks/glazed_terracotta_magenta'],
    ['magenta_shulker_box', 'blocks/shulker_top_magenta'],
    ['magenta_wool', 'blocks/wool_colored_magenta'],
    ['magma', 'blocks/magma'],
    ['mangrove_button', 'blocks/mangrove_planks'],
    ['mangrove_door', 'items/mangrove_door'],
    ['mangrove_double_slab', 'blocks/mangrove_planks'],
    ['mangrove_fence', 'blocks/mangrove_planks'],
    ['mangrove_fence_gate', 'blocks/mangrove_planks'],
    ['mangrove_hanging_sign', 'items/mangrove_hanging_sign'],
    ['mangrove_leaves', 'blocks/mangrove_leaves_carried'],
    ['mangrove_log', 'blocks/mangrove_log_top'],
    ['mangrove_planks', 'blocks/mangrove_planks'],
    ['mangrove_pressure_plate', 'blocks/mangrove_planks'],
    ['mangrove_propagule', 'blocks/mangrove_propagule'],
    ['mangrove_roots', 'blocks/mangrove_roots_top'],
    ['mangrove_slab', 'blocks/mangrove_planks'],
    ['mangrove_stairs', 'blocks/mangrove_planks'],
    ['mangrove_standing_sign', 'items/mangrove_sign'],
    ['mangrove_trapdoor', 'blocks/mangrove_trapdoor'],
    ['mangrove_wall_sign', 'items/mangrove_sign'],
    ['mangrove_wood', 'blocks/stripped_mangrove_log_side'],
    ['medium_amethyst_bud', 'blocks/medium_amethyst_bud'],
    ['melon_block', 'blocks/melon_top'],
    ['melon_stem', 'blocks/melon_stem_disconnected'],
    ['mob_spawner', 'blocks/mob_spawner'],
    ['monster_egg', 'blocks/stone'],
    ['moss_block', 'blocks/moss_block'],
    ['moss_carpet', 'blocks/moss_block'],
    ['mossy_cobblestone', 'blocks/cobblestone_mossy'],
    ['mossy_cobblestone_stairs', 'blocks/cobblestone_mossy'],
    ['mossy_stone_brick_stairs', 'blocks/cobblestone_mossy'],
    ['moving_block', 'blocks/missing_tile'],
    ['mud', 'blocks/mud'],
    ['mud_brick_double_slab', 'blocks/mud_bricks'],
    ['mud_brick_slab', 'blocks/mud_bricks'],
    ['mud_brick_stairs', 'blocks/mud_bricks'],
    ['mud_brick_wall', 'blocks/mud_bricks'],
    ['mud_bricks', 'blocks/mud_bricks'],
    ['muddy_mangrove_roots', 'blocks/muddy_mangrove_roots_side'],
    ['mycelium', 'blocks/mycelium_side'],
    ['nether_brick', 'blocks/nether_brick'],
    ['nether_brick_fence', 'blocks/nether_brick'],
    ['nether_brick_stairs', 'blocks/nether_brick'],
    ['nether_gold_ore', 'blocks/nether_gold_ore'],
    ['nether_sprouts', 'blocks/nether_sprouts'],
    ['nether_wart', 'items/nether_wart'],
    ['nether_wart_block', 'blocks/nether_wart_block'],
    ['netherite_block', 'blocks/netherite_block'],
    ['netherrack', 'blocks/netherrack'],
    ['normal_stone_stairs', 'blocks/stone'],
    ['noteblock', 'blocks/noteblock'],
    ['oak_fence', 'blocks/planks_oak'],
    ['oak_hanging_sign', 'items/oak_hanging_sign'],
    ['oak_log', 'blocks/log_oak_top'],
    ['oak_stairs', 'blocks/planks_oak'],
    ['observer', 'blocks/observer_front'],
    ['obsidian', 'blocks/obsidian'],
    ['ochre_froglight', 'blocks/ochre_froglight_side'],
    ['orange_candle', 'blocks/candles/orange_candle'],
    ['orange_candle_cake', 'blocks/candles/orange_candle'],
    ['orange_carpet', 'blocks/wool_colored_orange'],
    ['orange_concrete', 'blocks/concrete_orange'],
    ['orange_glazed_terracotta', 'blocks/glazed_terracotta_orange'],
    ['orange_shulker_box', 'blocks/shulker_top_orange'],
    ['orange_wool', 'blocks/wool_colored_orange'],
    ['oxidized_copper', 'blocks/oxidized_copper'],
    ['oxidized_cut_copper', 'blocks/oxidized_cut_copper'],
    ['oxidized_cut_copper_slab', 'blocks/oxidized_cut_copper'],
    ['oxidized_cut_copper_stairs', 'blocks/oxidized_cut_copper'],
    ['oxidized_double_cut_copper_slab', 'blocks/oxidized_cut_copper'],
    ['packed_ice', 'blocks/ice_packed'],
    ['packed_mud', 'blocks/packed_mud'],
    ['pearlescent_froglight', 'blocks/pearlescent_froglight_side'],
    ['pink_candle', 'blocks/candles/pink_candle'],
    ['pink_candle_cake', 'blocks/candles/pink_candle'],
    ['pink_carpet', 'blocks/wool_colored_pink'],
    ['pink_concrete', 'blocks/concrete_pink'],
    ['pink_glazed_terracotta', 'blocks/glazed_terracotta_pink'],
    ['pink_petals', 'blocks/pink_petals'],
    ['pink_shulker_box', 'blocks/shulker_top_pink'],
    ['pink_wool', 'blocks/wool_colored_pink'],
    ['piston', 'blocks/piston_top_normal'],
    ['piston_arm_collision', 'blocks/piston_inner'],
    ['pitcher_crop', 'items/pitcher_pod'],
    ['pitcher_plant', 'blocks/pitcher_crop_top_stage_4'],
    ['planks', 'blocks/planks_oak'],
    ['podzol', 'blocks/dirt_podzol_side'],
    ['pointed_dripstone', 'blocks/pointed_dripstone_up_tip'],
    ['polished_andesite_stairs', 'blocks/stone_andesite'],
    ['polished_basalt', 'blocks/polished_basalt_side'],
    ['polished_blackstone', 'blocks/polished_blackstone'],
    ['polished_blackstone_brick_double_slab', 'blocks/polished_blackstone_bricks'],
    ['polished_blackstone_brick_slab', 'blocks/polished_blackstone_bricks'],
    ['polished_blackstone_brick_stairs', 'blocks/polished_blackstone_bricks'],
    ['polished_blackstone_brick_wall', 'blocks/polished_blackstone_bricks'],
    ['polished_blackstone_bricks', 'blocks/polished_blackstone_bricks'],
    ['polished_blackstone_button', 'blocks/polished_blackstone'],
    ['polished_blackstone_double_slab', 'blocks/polished_blackstone'],
    ['polished_blackstone_pressure_plate', 'blocks/polished_blackstone'],
    ['polished_blackstone_slab', 'blocks/polished_blackstone'],
    ['polished_blackstone_stairs', 'blocks/polished_blackstone'],
    ['polished_blackstone_wall', 'blocks/polished_blackstone'],
    ['polished_deepslate', 'blocks/deepslate/polished_deepslate'],
    ['polished_deepslate_double_slab', 'blocks/deepslate/polished_deepslate'],
    ['polished_deepslate_slab', 'blocks/deepslate/polished_deepslate'],
    ['polished_deepslate_stairs', 'blocks/deepslate/polished_deepslate'],
    ['polished_deepslate_wall', 'blocks/deepslate/polished_deepslate'],
    ['polished_diorite_stairs', 'blocks/stone_diorite_smooth'],
    ['polished_granite_stairs', 'blocks/stone_granite_smooth'],
    ['portal', 'blocks/portal'],
    ['potatoes', 'items/potato'],
    ['powder_snow', 'blocks/powder_snow'],
    ['powered_comparator', 'blocks/comparator_on'],
    ['powered_repeater', 'blocks/repeater_on'],
    ['prismarine', 'blocks/prismarine_rough'],
    ['prismarine_bricks_stairs', 'blocks/prismarine_bricks'],
    ['prismarine_stairs', 'blocks/prismarine_rough'],
    ['pumpkin', 'blocks/pumpkin_top'],
    ['pumpkin_stem', 'blocks/pumpkin_stem_disconnected'],
    ['purple_candle', 'blocks/candles/purple_candle'],
    ['purple_candle_cake', 'blocks/candles/purple_candle'],
    ['purple_carpet', 'blocks/wool_colored_purple'],
    ['purple_concrete', 'blocks/concrete_purple'],
    ['purple_glazed_terracotta', 'blocks/glazed_terracotta_purple'],
    ['purple_shulker_box', 'blocks/shulker_top_purple'],
    ['purple_wool', 'blocks/wool_colored_purple'],
    ['purpur_block', 'blocks/purpur_block'],
    ['purpur_stairs', 'blocks/purpur_block'],
    ['quartz_block', 'blocks/quartz_block_side'],
    ['quartz_bricks', 'blocks/quartz_bricks'],
    ['quartz_ore', 'blocks/quartz_ore'],
    ['quartz_stairs', 'blocks/quartz_block_side'],
    ['rail', 'blocks/rail_normal'],
    ['raw_copper_block', 'blocks/raw_copper_block'],
    ['raw_gold_block', 'blocks/raw_gold_block'],
    ['raw_iron_block', 'blocks/raw_iron_block'],
    ['red_candle', 'blocks/candles/red_candle'],
    ['red_candle_cake', 'blocks/candles/red_candle'],
    ['red_carpet', 'blocks/wool_coloured_red'],
    ['red_concrete', 'blocks/concrete_red'],
    ['red_flower', 'blocks/flower_rose'],
    ['red_glazed_terracotta', 'blocks/glazed_terracotta_red'],
    ['red_mushroom', 'blocks/mushroom_red'],
    ['red_mushroom_block', 'mushroom_block_skin_red'],
    ['red_nether_brick', 'blocks/red_nether_brick'],
    ['red_nether_brick_stairs', 'blocks/red_nether_brick'],
    ['red_sandstone', 'blocks/red_sandstone_normal'],
    ['red_sandstone_stairs', 'blocks/red_sandstone_normal'],
    ['red_shulker_box', 'blocks/shulker_top_red'],
    ['red_wool', 'blocks/wool_coloured_red'],
    ['redstone_block', 'blocks/redstone_block'],
    ['redstone_lamp', 'blocks/redstone_lamp_off'],
    ['redstone_ore', 'blocks/redstone_ore'],
    ['redstone_torch', 'blocks/redstone_torch_off'],
    ['redstone_wire', 'blocks/redstone_dust_line'],
    ['reeds', 'blocks/reeds'],
    ['reinforced_deepslate', 'blocks/reinforced_deepslate_top'],
    ['repeating_command_block', 'blocks/repeating_command_block_front_mipmap'],
    ['reserved6', ''],
    ['respawn_anchor', 'blocks/respawn_anchor_top_off'],
    ['sand', 'blocks/sand'],
    ['sandstone', 'blocks/sandstone_normal'],
    ['sandstone_stairs', 'blocks/sandstone_normal'],
    ['sapling', 'blocks/sapling_oak'],
    ['scaffolding', 'blocks/scaffolding_top'],
    ['sculk', 'blocks/sculk'],
    ['sculk_catalyst', 'blocks/sculk_catalyst_top'],
    ['sculk_sensor', 'blocks/sculk_sensor_top'],
    ['sculk_shrieker', 'blocks/sculk_shrieker_top'],
    ['sculk_vein', 'blocks/sculk_vein'],
    ['sea_lantern', 'blocks/sea_lantern'],
    ['sea_pickle', 'blocks/sea_pickle'],
    ['seagrass', 'blocks/seagrass'],
    ['shroomlight', 'blocks/shroomlight'],
    ['silver_glazed_terracotta', 'blocks/glazed_terracotta_silver'],
    //Skull texture is under and entity and would need a shader.
    ['skull', ''],
    ['slime', 'blocks/slime'],
    ['small_amethyst_bud', 'blocks/small_amethyst_bud'],
    ['small_dripleaf_block', 'blocks/small_dripleaf_top'],
    ['smithing_table', 'blocks/smithing_table_front'],
    ['smoker', 'blocks/smoker_front_off'],
    ['smooth_basalt', 'blocks/smooth_basalt'],
    ['smooth_quartz_stairs', 'blocks/quartz_block_side'],
    ['smooth_red_sandstone_stairs', 'blocks/red_sandstone_smooth'],
    ['smooth_sandstone_stairs', 'blocks/sandstone_smooth'],
    ['smooth_stone', 'blocks/stone_slab_top'],
    ['sniffer_egg', 'items/sniffer_egg'],
    ['snow', 'blocks/snow'],
    ['snow_layer', 'blocks/snow'],
    ['soul_campfire', 'blocks/soul_campfire'],
    ['soul_fire', 'blocks/soul_fire_0'],
    ['soul_lantern', 'blocks/soul_lantern'],
    ['soul_sand', 'blocks/soul_sand'],
    ['soul_soil', 'blocks/soul_soil'],
    ['soul_torch', 'blocks/soul_torch'],
    ['sponge', 'blocks/sponge'],
    ['spore_blossom', 'blocks/spore_blossom'],
    ['spruce_button', 'blocks/planks_spruce'],
    ['spruce_door', 'items/door_spruce'],
    ['spruce_fence', 'blocks/planks_spruce'],
    ['spruce_fence_gate', 'blocks/planks_spruce'],
    ['spruce_hanging_sign', 'items/spruce_hanging_sign'],
    ['spruce_log', 'blocks/log_spruce_top'],
    ['spruce_pressure_plate', 'blocks/planks_spruce'],
    ['spruce_stairs', 'blocks/planks_spruce'],
    ['spruce_standing_sign', 'items/sign_spruce'],
    ['spruce_trapdoor', 'blocks/spruce_trapdoor'],
    ['spruce_wall_sign', 'items/sign_spruce'],
    ['stained_glass', 'blocks/glass_blue'],
    ['stained_glass_pane', 'blocks/glass_pane_top_blue'],
    ['stained_hardened_clay', 'blocks/hardened_clay_stained_blue'],
    ['standing_banner', 'entity\banner\banner_mojang'],
    ['standing_sign', 'items/sign_oak'],
    ['sticky_piston', 'blocks/piston_top_sticky'],
    ['sticky_piston_arm_collision', 'blocks/piston_inner'],
    ['stone', 'blocks/stone'],
    ['stone_block_slab', 'blocks/stone_slab_top'],
    ['stone_block_slab2', 'blocks/red_sandstone_bottom'],
    ['stone_block_slab3', 'blocks/end_stone'],
    ['stone_block_slab4', 'blocks/stonebrick'],
    ['stone_brick_stairs', 'blocks/stonebrick'],
    ['stone_button', 'blocks/stone'],
    ['stone_pressure_plate', 'blocks/stone'],
    ['stone_stairs', 'blocks/stone'],
    ['stonebrick', 'blocks/stonebrick'],
    ['stonecutter', 'blocks/stonecutter2_top'],
    ['stonecutter_block', 'blocks/stonecutter2_top'],
    ['stripped_acacia_log', 'blocks/stripped_acacia_log'],
    ['stripped_bamboo_block', 'blocks/stripped_bamboo_block'],
    ['stripped_birch_log', 'blocks/stripped_birch_log'],
    ['stripped_cherry_log', 'blocks/stripped_cherry_log_top'],
    ['stripped_cherry_wood', 'blocks/stripped_cherry_log_top'],
    ['stripped_crimson_hyphae', 'blocks/huge_fungus/stripped_crimson_stem_side'],
    ['stripped_crimson_stem', 'blocks/huge_fungus/stripped_crimson_stem_top'],
    ['stripped_dark_oak_log', 'blocks/stripped_dark_oak_log'],
    ['stripped_jungle_log', 'blocks/stripped_jungle_log'],
    ['stripped_mangrove_log', 'blocks/stripped_mangrove_log_top'],
    ['stripped_mangrove_wood', 'blocks/stripped_mangrove_log_side'],
    ['stripped_oak_log', 'blocks/stripped_oak_log'],
    ['stripped_spruce_log', 'blocks/stripped_spruce_log'],
    ['stripped_warped_hyphae', 'blocks/huge_fungus/stripped_warped_stem_side'],
    ['stripped_warped_stem', 'blocks/huge_fungus/stripped_warped_stem_top'],
    ['structure_block', 'blocks/structure_block'],
    ['structure_void', 'blocks/structure_void'],
    ['suspicious_gravel', 'blocks/suspicious_gravel_0'],
    ['suspicious_sand', 'blocks/suspicious_sand_0'],
    ['sweet_berry_bush', 'blocks/sweet_berry_bush_stage3'],
    ['tallgrass', 'blocks/tallgrass'],
    ['target', 'blocks/target_side'],
    ['tinted_glass', 'blocks/tinted_glass'],
    ['tnt', 'blocks/tnt_top'],
    ['torch', 'blocks/torch_on'],
    ['torchflower', 'blocks/torchflower'],
    ['torchflower_crop', 'blocks/torchflower_crop_stage_1'],
    ['trapdoor', 'blocks/trapdoor'],
    ['trapped_chest', 'blocks/trapped_chest_front'],
    ['trip_wire', 'blocks/trip_wire'],
    ['tripwire_hook', 'blocks/trip_wire_source'],
    ['tube_coral', 'blocks/coral_blue'],
    ['tuff', 'blocks/tuff'],
    ['turtle_egg', 'items/turtle_egg'],
    ['twisting_vines', 'blocks/twisting_vines_bottom'],
    ['underwater_torch', ''],
    ['undyed_shulker_box', 'blocks/shulker_top_pink'],
    ['unknown', ''],
    ['unlit_redstone_torch', 'blocks/redstone_torch_off'],
    ['unpowered_comparator', 'blocks/comparator_off'],
    ['unpowered_repeater', 'blocks/repeater_off'],
    ['verdant_froglight', 'blocks/verdant_froglight_top'],
    ['vine', 'blocks/vine'],
    ['wall_banner', ''],
    ['wall_sign', 'items/sign'],
    ['warped_button', 'blocks/huge_fungus/warped_planks'],
    ['warped_door', 'items/warped_door'],
    ['warped_double_slab', 'blocks/huge_fungus/warped_plankss'],
    ['warped_fence', 'blocks/huge_fungus/warped_planks'],
    ['warped_fence_gate', 'blocks/huge_fungus/warped_planks'],
    ['warped_fungus', 'blocks/warped_fungus'],
    ['warped_hanging_sign', 'items/warped_hanging_sign'],
    ['warped_hyphae', ''],
    ['warped_nylium', 'blocks/warped_nylium_side'],
    ['warped_planks', 'blocks/huge_fungus/warped_planks'],
    ['warped_pressure_plate', 'blocks/huge_fungus/warped_planks'],
    ['warped_roots', 'blocks/warped_roots'],
    ['warped_slab', 'blocks/huge_fungus/warped_planks'],
    ['warped_stairs', 'blocks/huge_fungus/warped_planks'],
    ['warped_standing_sign', 'items/sign_warped'],
    ['warped_stem', 'blocks/huge_fungus/warped_stem_top'],
    ['warped_trapdoor', 'blocks/huge_fungus/warped_trapdoor'],
    ['warped_wall_sign', 'items/sign_warped'],
    ['warped_wart_block', 'blocks/warped_wart_block'],
    ['water', 'blocks/water_still'],
    ['waterlily', 'blocks/waterlily'],
    ['waxed_copper', 'blocks/copper_block'],
    ['waxed_cut_copper', 'blocks/cut_copper'],
    ['waxed_cut_copper_slab', 'blocks/cut_copper'],
    ['waxed_cut_copper_stairs', 'blocks/cut_copper'],
    ['waxed_double_cut_copper_slab', 'blocks/cut_copper'],
    ['waxed_exposed_copper', 'blocks/exposed_copper'],
    ['waxed_exposed_cut_copper', 'blocks/exposed_cut_copper'],
    ['waxed_exposed_cut_copper_slab', 'blocks/exposed_cut_copper'],
    ['waxed_exposed_cut_copper_stairs', 'blocks/exposed_cut_copper'],
    ['waxed_exposed_double_cut_copper_slab', 'blocks/exposed_cut_copper'],
    ['waxed_oxidized_copper', 'blocks/oxidized_copper'],
    ['waxed_oxidized_cut_copper', 'blocks/oxidized_cut_copper'],
    ['waxed_oxidized_cut_copper_slab', 'blocks/oxidized_cut_copper'],
    ['waxed_oxidized_cut_copper_stairs', 'blocks/oxidized_cut_copper'],
    ['waxed_oxidized_double_cut_copper_slab', 'blocks/oxidized_cut_copper'],
    ['waxed_weathered_copper', 'blocks/weathered_copper'],
    ['waxed_weathered_cut_copper', 'blocks/weathered_cut_copper'],
    ['waxed_weathered_cut_copper_slab', 'blocks/weathered_cut_copper'],
    ['waxed_weathered_cut_copper_stairs', 'blocks/weathered_cut_copper'],
    ['waxed_weathered_double_cut_copper_slab', 'blocks/weathered_cut_copper'],
    ['weathered_copper', 'blocks/weathered_copper'],
    ['weathered_cut_copper', 'blocks/weathered_cut_copper'],
    ['weathered_cut_copper_slab', 'blocks/weathered_cut_copper'],
    ['weathered_cut_copper_stairs', 'blocks/weathered_cut_copper'],
    ['weathered_double_cut_copper_slab', 'blocks/weathered_cut_copper'],
    ['web', 'blocks/web'],
    ['weeping_vines', 'blocks/weeping_vines'],
    ['wheat', 'blocks/wheat_stage_7'],
    ['white_candle', 'blocks/candles/white_candle'],
    ['white_candle_cake', 'blocks/candles/white_candle'],
    ['white_carpet', 'blocks/wool_coloured_white'],
    ['white_concrete', 'blocks/concrete_white'],
    ['white_glazed_terracotta', 'blocks/glazed_terracotta_white'],
    ['white_shulker_box', 'blocks/shulker_top_white'],
    ['white_wool', 'blocks/wool_coloured_white'],
    ['wither_rose', ''],
    ['wood', 'blocks/planks_oak'],
    ['wooden_button', 'blocks/planks_oak'],
    ['wooden_door', 'items/door_wood'],
    ['wooden_pressure_plate', 'blocks/planks_oak'],
    ['wooden_slab', 'blocks/planks_oak'],
    ['yellow_candle', 'blocks/candles/yellow_candle'],
    ['yellow_candle_cake', 'blocks/candles/yellow_candle'],
    ['yellow_carpet', 'blocks/wool_coloured_yellow'],
    ['yellow_concrete', 'blocks/concrete_yellow'],
    ['yellow_flower', 'blocks/flower_dandelion'],
    ['yellow_glazed_terracotta', 'blocks/glazed_terracotta_yellow'],
    ['yellow_shulker_box', 'blocks/shulker_top_yellow'],
    ['yellow_wool', 'blocks/wool_coloured_yellow'],
    //items these have had the blocks excluded
    ['acacia_boat', 'items/boat_acacia'],
    ['acacia_chest_boat', 'items/acacia_chest_boat'],
    ['acacia_sign', 'items/sign_acacia'],
    ['allay_spawn_egg', 'items/egg_null'],
    ['amethyst_shard', 'items/amethyst_shard'],
    ['angler_pottery_sherd', 'items/angler_pottery_sherd'],
    ['apple', 'items/apple'],
    ['archer_pottery_sherd', 'items/archer_pottery_sherd'],
    ['armor_stand', 'items/armor_stand'],
    ['arms_up_pottery_sherd', 'items/arms_up_pottery_sherd'],
    ['arrow', 'items/arrow'],
    ['axolotl_bucket', 'items/bucket_axolotl'],
    ['axolotl_spawn_egg', 'items/egg_null'],
    ['baked_potato', 'items/potato_baked'],
    ['bamboo_chest_raft', 'items/bamboo_chest_raft'],
    ['bamboo_raft', 'items/bamboo_raft'],
    ['bamboo_sign', 'items/bamboo_sign'],
    ['banner', ''],
    ['banner_pattern', 'items/banner_pattern'],
    ['bat_spawn_egg', 'items/egg_bat'],
    ['bee_spawn_egg', 'items/egg_bee'],
    ['beef', 'items/beef_raw'],
    ['beetroot_seeds', 'items/seeds_beetroot'],
    ['beetroot_soup', 'items/beetroot_soup'],
    ['birch_boat', 'items/boat_birch'],
    ['birch_chest_boat', 'items/birch_chest_boat'],
    ['birch_sign', 'items/sign_birch'],
    ['black_dye', 'items/dye_powder_black_new'],
    ['blade_pottery_sherd', 'items/blade_pottery_sherd'],
    ['blaze_powder', 'items/blaze_powder'],
    ['blaze_rod', 'items/blaze_rod'],
    ['blaze_spawn_egg', 'items/egg_blaze'],
    ['blue_dye', 'items/dye_powder_blue_new'],
    ['boat', 'items/boat'],
    ['bone', 'items/bone'],
    ['bone_meal', 'items/dye_powder_white'],
    ['book', 'items/book_normal'],
    ['bordure_indented_banner_pattern', 'items/banner_pattern'],
    ['bow', 'items/bow_standby'],
    ['bowl', 'items/bowl'],
    ['bread', 'items/bread'],
    ['brewer_pottery_sherd', 'items/brewer_pottery_sherd'],
    ['brick', 'items/brick'],
    ['brown_dye', 'items/dye_powder_brown_new'],
    ['brush', 'items/brush'],
    ['bucket', 'items/bucket_empty'],
    ['burn_pottery_sherd', 'items/burn_pottery_sherd'],
    ['camel_spawn_egg', 'items/egg_mule'],
    ['carpet', 'blocks/wool_coloured_white'],
    ['carrot', 'items/carrot'],
    ['carrot_on_a_stick', 'items/carrot_on_a_stick'],
    ['cat_spawn_egg', 'items/egg_cat'],
    ['cave_spider_spawn_egg', 'items/egg_spider'],
    ['chainmail_boots', 'items/chainmail_boots'],
    ['chainmail_chestplate', 'items/chainmail_chestplate'],
    ['chainmail_helmet', 'items/chainmail_helmet'],
    ['chainmail_leggings', 'items/chainmail_leggings'],
    ['charcoal', 'items/charcoal'],
    ['cherry_boat', 'items/cherry_boat'],
    ['cherry_chest_boat', 'items/cherry_chest_boat'],
    ['cherry_sign', 'items/cherry_sign'],
    ['chest_boat', 'items/oak_chest_boat'],
    ['chest_minecart', 'items/minecart_chest'],
    ['chicken', 'items/chicken_raw'],
    ['chicken_spawn_egg', 'items/chicken_cooked'],
    ['chorus_fruit', 'items/chorus_fruit'],
    ['clay_ball', 'items/clay_ball'],
    ['clock', 'items/clock_item'],
    ['coal', 'items/coal'],
    ['coast_armor_trim_smithing_template', 'items/coast_armor_trim_smithing_template'],
    ['cocoa_beans', 'blocks/cocoa_stage_2'],
    ['cod', 'items/fish_raw'],
    ['cod_bucket', 'items/bucket_cod'],
    ['cod_spawn_egg', 'items/egg_cod'],
    ['command_block_minecart', 'items/minecart_command_block'],
    ['comparator', 'items/comparator'],
    ['compass', 'items/compass_item'],
    ['concrete', 'blocks/blocks/concrete_white'],
    ['cooked_beef', 'items/beef_cooked'],
    ['cooked_chicken', 'items/chicken_cooked'],
    ['cooked_cod', 'items/fish_cooked'],
    ['cooked_mutton', 'items/mutton_cooked'],
    ['cooked_porkchop', 'items/porkchop_cooked'],
    ['cooked_rabbit', 'items/rabbit_cooked'],
    ['cooked_salmon', 'items/salmon_cooked'],
    ['cookie', 'items/cookie'],
    ['copper_ingot', 'items/copper_ingot'],
    ['coral', 'blocks/coral_fan_pink'],
    ['cow_spawn_egg', 'items/egg_cow'],
    ['creeper_banner_pattern', 'items/banner_pattern'],
    ['creeper_spawn_egg', 'items/egg_creeper'],
    ['crimson_sign', 'items/sign_crimson'],
    ['crossbow', 'items/crossbow_standby'],
    ['cyan_dye', 'items/dye_powder_cyan'],
    ['danger_pottery_sherd', 'items/danger_pottery_sherd'],
    ['dark_oak_boat', 'items/boat_dark_oak'],
    ['dark_oak_chest_boat', 'items/dark_oak_chest_boat'],
    ['dark_oak_sign', 'items/sign_oak'],
    ['diamond', 'items/diamond'],
    ['diamond_axe', 'items/diamond_axe'],
    ['diamond_boots', 'items/diamond_boots'],
    ['diamond_chestplate', 'items/diamond_chestplate'],
    ['diamond_helmet', 'items/diamond_helmet'],
    ['diamond_hoe', 'items/diamond_hoe'],
    ['diamond_horse_armor', 'items/diamond_horse_armor'],
    ['diamond_leggings', 'items/diamond_leggings'],
    ['diamond_pickaxe', 'items/diamond_pickaxe'],
    ['diamond_shovel', 'items/diamond_shovel'],
    ['diamond_sword', 'items/diamond_sword'],
    ['disc_fragment_5', 'items/disc_fragment_5'],
    ['dolphin_spawn_egg', 'items/egg_dolphin'],
    ['donkey_spawn_egg', 'items/egg_donkey'],
    ['dragon_breath', 'items/dragons_breath'],
    ['dried_kelp', 'items/dried_kelp'],
    ['drowned_spawn_egg', 'items/egg_drowned'],
    ['dune_armor_trim_smithing_template', 'items/dune_armor_trim_smithing_template'],
    ['dye', 'items/dye_red'],
    ['echo_shard', 'items/echo_shard'],
    ['egg', 'items/egg'],
    ['elder_guardian_spawn_egg', 'items/egg_elderguardian'],
    ['elytra', 'items/elytra'],
    ['emerald', 'items/emerald'],
    ['empty_map', 'items/map_empty'],
    ['enchanted_book', 'items/book_enchanted'],
    ['enchanted_golden_apple', 'items/apple_golden'],
    ['end_crystal', 'items/end_crystal'],
    ['ender_dragon_spawn_egg', 'blocks/dragon_egg'],
    ['ender_eye', 'items/ender_eye'],
    ['ender_pearl', 'items/ender_pearl'],
    ['enderman_spawn_egg', 'items/egg_enderman'],
    ['endermite_spawn_egg', 'items/egg_endermite'],
    ['evoker_spawn_egg', 'items/egg_evoker'],
    ['experience_bottle', 'items/experience_bottle'],
    ['explorer_pottery_sherd', 'items/explorer_pottery_sherd'],
    ['eye_armor_trim_smithing_template', 'items/eye_armor_trim_smithing_template'],
    ['feather', 'items/feather'],
    ['fence', ''],
    ['fermented_spider_eye', 'items/spider_eye_fermented'],
    ['field_masoned_banner_pattern', 'items/banner_pattern'],
    ['filled_map', 'items/map_filled'],
    ['fire_charge', 'items/fireball'],
    ['firework_rocket', 'items/fireworks'],
    ['firework_star', 'items/fireworks_charge'],
    ['fishing_rod', 'items/fishing_rod_uncast'],
    ['flint', 'items/flint'],
    ['flint_and_steel', 'items/flint_and_steel'],
    ['flower_banner_pattern', 'items/banner_pattern'],
    ['fox_spawn_egg', 'items/egg_fox'],
    ['friend_pottery_sherd', 'items/friend_pottery_sherd'],
    //Unable to locate a texture.
    ['frog_spawn_egg', ''],
    ['ghast_spawn_egg', 'items/egg_ghast'],
    ['ghast_tear', 'items/ghast_tear'],
    ['glass_bottle', 'items/potion_bottle_empty'],
    ['glass_bottle', 'items/potion_bottle_empty'],
    ['glistering_melon_slice', 'items/melon_speckled'],
    ['globe_banner_pattern', 'items/banner_pattern'],
    ['glow_berries', 'items/glow_berries'],
    ['glow_ink_sac', 'items/dye_powder_glow'],
    ['glow_squid_spawn_egg', 'items/egg_glow_squid'],
    ['glowstone_dust', 'items/glowstone_dust'],
    ['goat_horn', 'items/goat_horn'],
    ['goat_spawn_egg', 'egg_goat'],
    ['gold_ingot', 'items/gold_ingot'],
    ['gold_nugget', 'items/gold_nugget'],
    ['golden_apple', 'items/apple_golden'],
    ['golden_axe', 'items/gold_axe'],
    ['golden_boots', 'items/gold_boots'],
    ['golden_carrot', 'items/carrot_golden'],
    ['golden_chestplate', 'items/gold_chestplate'],
    ['golden_helmet', 'items/gold_helmet'],
    ['golden_hoe', 'items/gold_hoe'],
    ['golden_horse_armor', 'items/gold_horse_armor'],
    ['golden_leggings', 'items/gold_leggings'],
    ['golden_pickaxe', 'items/gold_pickaxe'],
    ['golden_shovel', 'items/gold_shovel'],
    ['golden_sword', 'items/gold_sword'],
    ['gray_dye', 'items/dye_powder_grey'],
    ['green_dye', 'items/dye_powder_green'],
    ['guardian_spawn_egg', 'items/egg_guardian'],
    ['gunpowder', 'items/gunpowder'],
    ['heart_of_the_sea', 'items/heartofthesea_closed'],
    ['heart_pottery_sherd', 'items/heart_pottery_sherd'],
    ['heartbreak_pottery_sherd', 'items/heartbreak_pottery_sherd'],
    ['hoglin_spawn_egg', 'items/egg_hoglin'],
    ['honey_bottle', 'items/honey_bottle'],
    ['honeycomb', 'items/honeycomb'],
    ['hopper_minecart', 'items/minecart_hopper'],
    ['horse_spawn_egg', 'items/egg_horse'],
    ['host_armor_trim_smithing_template', 'items/host_armor_trim_smithing_template'],
    ['howl_pottery_sherd', 'items/howl_pottery_sherd'],
    ['husk_spawn_egg', 'items/egg_husk'],
    ['ink_sac', 'items/dye_powder_black'],
    ['iron_axe', 'items/iron_axe'],
    ['iron_boots', 'items/iron_boots'],
    ['iron_chestplate', 'items/iron_chestplate'],
    ['iron_golem_spawn_egg', 'items/egg_null'],
    ['iron_helmet', 'items/iron_helmet'],
    ['iron_hoe', 'items/iron_hoe'],
    ['iron_horse_armor', 'items/iron_horse_armor'],
    ['iron_ingot', 'items/iron_ingot'],
    ['iron_leggings', 'items/iron_leggings'],
    ['iron_nugget', 'items/iron_nugget'],
    ['iron_pickaxe', 'items/iron_pickaxe'],
    ['iron_shovel', 'items/iron_shovel'],
    ['iron_sword', 'items/iron_sword'],
    ['jungle_boat', 'items/boat_jungle'],
    ['jungle_chest_boat', 'items/jungle_chest_boat'],
    ['jungle_sign', 'items/sign_jungle'],
    ['lapis_lazuli', 'items/dye_powder_blue'],
    ['lava_bucket', 'items/bucket_lava'],
    ['lead', 'items/lead'],
    ['leather', 'items/leather'],
    ['leather_boots', 'items/leather_boots'],
    ['leather_chestplate', 'items/leather_chestplate'],
    ['leather_helmet', 'items/leather_helmet'],
    ['leather_horse_armor', 'items/leather_horse_armor'],
    ['leather_leggings', 'items/leather_leggings'],
    ['light_blue_dye', 'items/dye_powder_light_blue'],
    ['light_gray_dye', 'items/dye_powder_light_gray'],
    ['lime_dye', 'items/dye_powder_lime'],
    ['lingering_potion', 'items/potion_bottle_lingering'],
    ['llama_spawn_egg', 'items/egg_llama'],
    ['lodestone_compass', 'items/lodestonecompass_item'],
    ['log', 'blocks/log_big_oak'],
    ['log2', 'blocks/log_spruce'],
    ['magenta_dye', 'items/dye_powder_magenta'],
    ['magma_cream', 'items/magma_cream'],
    ['magma_cube_spawn_egg', 'items/egg_lava_slime'],
    ['mangrove_boat', 'items/mangrove_boat'],
    ['mangrove_chest_boat', 'items/mangrove_chest_boat'],
    ['mangrove_sign', 'items/mangrove_sign'],
    ['melon_seeds', 'items/seeds_melon'],
    ['melon_slice', 'items/melon'],
    ['milk_bucket', 'items/bucket_milk'],
    ['minecart', 'items/minecart_normal'],
    ['miner_pottery_sherd', 'items/miner_pottery_sherd'],
    ['mojang_banner_pattern', 'items/banner_pattern'],
    ['mooshroom_spawn_egg', 'items/egg_mushroomcow'],
    ['mourner_pottery_sherd', 'items/mourner_pottery_sherd'],
    ['mule_spawn_egg', 'items/egg_mule'],
    ['mushroom_stew', 'items/mushroom_stew'],
    ['music_disc_11', 'items/record_11'],
    ['music_disc_13', 'items/record_13'],
    ['music_disc_5', 'items/record_5'],
    ['music_disc_blocks', 'items/record_blocks'],
    ['music_disc_cat', 'items/record_cat'],
    ['music_disc_chirp', 'items/record_chirp'],
    ['music_disc_far', 'items/record_far'],
    ['music_disc_mall', 'items/record_mall'],
    ['music_disc_mellohi', 'items/record_mellohi'],
    ['music_disc_otherside', 'items/record_otherside'],
    ['music_disc_pigstep', 'items/record_pigstep'],
    ['music_disc_relic', 'items/music_disc_relic'],
    ['music_disc_stal', 'items/record_stal'],
    ['music_disc_strad', 'items/record_strad'],
    ['music_disc_wait', 'items/record_wait'],
    ['music_disc_ward', 'items/record_ward'],
    ['mutton', 'items/mutton_raw'],
    ['name_tag', 'items/name_tag'],
    ['nautilus_shell', 'items/nautilus'],
    ['nether_star', 'items/nether_star'],
    ['netherbrick', 'items/netherbrick'],
    ['netherite_axe', 'items/netherite_axe'],
    ['netherite_boots', 'items/netherite_boots'],
    ['netherite_chestplate', 'items/netherite_chestplate'],
    ['netherite_helmet', 'items/netherite_helmet'],
    ['netherite_hoe', 'items/netherite_hoe'],
    ['netherite_ingot', 'items/netherite_ingot'],
    ['netherite_leggings', 'items/netherite_leggings'],
    ['netherite_pickaxe', 'items/netherite_pickaxe'],
    ['netherite_scrap', 'items/netherite_scrap'],
    ['netherite_shovel', 'items/netherite_shovel'],
    ['netherite_sword', 'items/netherite_sword'],
    ['netherite_upgrade_smithing_template', 'items/netherite_upgrade_smithing_template'],
    ['oak_boat', 'items/boat_oak'],
    ['oak_chest_boat', 'items/oak_chest_boat'],
    ['oak_sign', 'items/sign_oak'],
    ['ocelot_spawn_egg', 'items/egg_ocelot'],
    ['orange_dye', 'items/dye_powder_orange'],
    ['painting', 'items/painting'],
    ['panda_spawn_egg', 'items/egg_panda'],
    ['paper', 'items/paper'],
    ['parrot_spawn_egg', 'items/egg_parrot'],
    ['phantom_membrane', 'items/phantom_membrane'],
    ['phantom_spawn_egg', 'items/egg_phantom'],
    ['pig_spawn_egg', 'items/egg_pig'],
    ['piglin_banner_pattern', 'items/banner'],
    ['piglin_brute_spawn_egg', 'items/egg_null'],
    ['piglin_spawn_egg', 'items/egg_null'],
    ['pillager_spawn_egg', 'items/egg_pillager'],
    ['pink_dye', 'items/dye_powder_pink'],
    ['pitcher_pod', 'items/pitcher_pod'],
    ['plenty_pottery_sherd', 'items/plenty_pottery_sherd'],
    ['poisonous_potato', 'items/potato_poisonous'],
    ['polar_bear_spawn_egg', 'items/egg_polarbear'],
    ['popped_chorus_fruit', 'items/chorus_fruit_popped'],
    ['porkchop', 'items/porkchop_raw'],
    ['potato', 'items/potato'],
    ['potion', 'items/potion_bottle_heal'],
    ['powder_snow_bucket', 'items/bucket_powder_snow'],
    ['prismarine_crystals', 'items/prismarine_crystals'],
    ['prismarine_shard', 'items/prismarine_shard'],
    ['prize_pottery_sherd', 'items/prize_pottery_sherd'],
    ['pufferfish', 'items/fish_pufferfish_raw'],
    ['pufferfish_bucket', 'items/bucket_pufferfish'],
    ['pufferfish_spawn_egg', 'items/egg_pufferfish'],
    ['pumpkin_pie', 'items/pumpkin_pie'],
    ['pumpkin_seeds', 'items/seeds_pumpjin'],
    ['purple_dye', 'dye_powder_purple'],
    ['quartz', 'items/quartz'],
    ['rabbit', 'items/rabbit_raw'],
    ['rabbit_foot', 'items/rabbit_foot'],
    ['rabbit_hide', 'items/rabbit_hide'],
    ['rabbit_spawn_egg', 'items/egg_rabbit'],
    ['rabbit_stew', 'items/rabbit_stew'],
    ['raiser_armor_trim_smithing_template', 'items/raiser_armor_trim_smithing_template'],
    ['ravager_spawn_egg', 'items/egg_ravanger'],
    ['raw_copper', 'items/raw_copper'],
    ['raw_gold', 'items/raw_gold'],
    ['raw_iron', 'items/raw_iron'],
    ['recovery_compass', 'items/compass_item'],
    ['red_dye', 'dye_powder_red'],
    ['redstone', 'items/redstone_dust'],
    ['repeater', 'items/repeater'],
    ['rib_armor_trim_smithing_template', 'items/rib_armor_trim_smithing_template'],
    ['rotten_flesh', 'items/rotten_flesh'],
    ['saddle', 'items/saddle'],
    ['salmon', 'items/fish_salmon_raw'],
    ['salmon_bucket', 'items/bucket_salmon'],
    ['salmon_spawn_egg', 'items/egg_salmon'],
    ['scute', 'items/turtle_shell_piece'],
    ['sentry_armor_trim_smithing_template', 'items/sentry_armor_trim_smithing_template'],
    ['shaper_armor_trim_smithing_template', 'items/shaper_armor_trim_smithing_template'],
    ['sheaf_pottery_sherd', 'items/sheaf_pottery_sherd'],
    ['shears', 'items/shears'],
    ['sheep_spawn_egg', 'items/egg_sheep'],
    ['shelter_pottery_sherd', 'items/shelter_pottery_sherd'],
    ['shield', ''],
    ['shulker_box', 'blocks/shulker_top_undyed'],
    ['shulker_shell', 'items/shulker_shell'],
    ['shulker_spawn_egg', 'items/egg_shulker'],
    ['silence_armor_trim_smithing_template', 'items/silence_armor_trim_smithing_template'],
    ['silverfish_spawn_egg', 'items/egg_silverfish'],
    ['skeleton_horse_spawn_egg', 'items/egg_skeletonhorse'],
    ['skeleton_spawn_egg', 'items/egg_skeleton'],
    ['skull_banner_pattern', 'items/banner'],
    ['skull_pottery_sherd', 'items/skull_pottery_sherd'],
    ['slime_ball', 'items/slimeball'],
    ['slime_spawn_egg', 'items/egg_slime'],
    ['sniffer_spawn_egg', 'items/egg_sniffer'],
    ['snort_pottery_sherd', 'items/snort_pottery_sherd'],
    ['snout_armor_trim_smithing_template', 'items/snout_armor_trim_smithing_template'],
    ['snow_golem_spawn_egg', 'items/egg_null'],
    ['snowball', 'items/snowball'],
    ['spawn_egg', 'items/spawn_egg'],
    ['spider_eye', 'items/spider_eye'],
    ['spider_spawn_egg', 'items/egg_spider'],
    ['spire_armor_trim_smithing_template', 'items/spire_armor_trim_smithing_template'],
    ['splash_potion', 'items/potion_bottle_splash'],
    ['spruce_boat', 'items/boat_spruce'],
    ['spruce_chest_boat', 'items/spruce_chest_boat'],
    ['spruce_sign', 'items/sign_spruce'],
    ['spyglass', 'items/spyglass'],
    ['squid_spawn_egg', 'items/egg_squid'],
    ['stick', 'items/stick'],
    ['stone_axe', 'items/stone_axe'],
    ['stone_hoe', 'items/stone_hoe'],
    ['stone_pickaxe', 'items/stone_pickaxe'],
    ['stone_shovel', 'items/stone_shovel'],
    ['stone_sword', 'items/stone_sword'],
    ['stray_spawn_egg', 'items/egg_stray'],
    ['strider_spawn_egg', 'items/egg_strider'],
    ['string', 'items/string'],
    ['sugar', 'items/sugar'],
    ['sugar_cane', 'items/reeds'],
    ['suspicious_stew', 'items/suspicious_stew'],
    ['sweet_berries', 'items/sweet_berries'],
    ['tadpole_bucket', 'items/bucket_tadpole'],
    ['tadpole_spawn_egg', 'items/egg_tadpole'],
    ['tide_armor_trim_smithing_template', 'items/tide_armor_trim_smithing_template'],
    ['tnt_minecart', 'items/minecart_tnt'],
    ['torchflower_seeds', 'items/torchflower_seeds'],
    ['totem_of_undying', 'items/totem'],
    ['trader_llama_spawn_egg', 'items/egg_llama'],
    ['trident', 'items/trident'],
    ['tropical_fish', 'items/fish_clownfish_raw'],
    ['tropical_fish_bucket', 'items/bucket_tropical'],
    ['tropical_fish_spawn_egg', 'items/egg_clownfish'],
    ['turtle_helmet', 'items/turtle_helmet'],
    ['turtle_spawn_egg', 'items/egg_turtle'],
    ['vex_armor_trim_smithing_template', 'items/vex_armor_trim_smithing_template'],
    ['vex_spawn_egg', 'items/egg_vex'],
    ['villager_spawn_egg', 'items/egg_villager'],
    ['vindicator_spawn_egg', 'items/egg_vindicator'],
    ['wandering_trader_spawn_egg', 'items/egg_wanderingtrader'],
    ['ward_armor_trim_smithing_template', 'items/ward_armor_trim_smithing_template'],
    ['warden_spawn_egg', 'items/egg_warden'],
    ['warped_fungus_on_a_stick', 'items/warped_fungus_on_a_stick'],
    ['warped_sign', 'items/sign_warped'],
    ['water_bucket', 'items/bucket_water'],
    ['wayfinder_armor_trim_smithing_template', 'items/wayfinder_armor_trim_smithing_template'],
    ['wheat_seeds', 'items/wheat'],
    ['white_dye', 'items/dye_powder_white_new'],
    ['wild_armor_trim_smithing_template', 'items/wild_armor_trim_smithing_template'],
    ['witch_spawn_egg', 'items/egg_witch'],
    ['wither_skeleton_spawn_egg', 'items/egg_null'],
    ['wither_spawn_egg', 'items/egg_wither'],
    ['wolf_spawn_egg', 'items/egg_wolf'],
    ['wooden_axe', 'items/wood_axe'],
    ['wooden_hoe', 'items/wood_hoe'],
    ['wooden_pickaxe', 'items/wood_pickaxe'],
    ['wooden_shovel', 'items/wood_shovel'],
    ['wooden_sword', 'items/wood_sword'],
    ['wool', 'blocks/coloured_wool_white'],
    ['writable_book', 'items/book_writeable'],
    ['yellow_dye', 'items/dye_powder_yellow'],
    ['zoglin_spawn_egg', 'items/egg_null'],
    ['zombie_horse_spawn_egg', 'items/egg_zombiehorse'],
    ['zombie_pigman_spawn_egg', 'items/egg_pigzombie'],
    ['zombie_spawn_egg', 'items/egg_zombie'],
    ['zombie_villager_spawn_egg', 'egg_zombievillager'],
  ]);
  const texturePath = textures.get(itemId);
  return texturePath !== undefined ? texturePath : 'ui/slots_bg';
}
