import { ItemStack, ItemTypes, world, ItemLockMode, system } from '@minecraft/server';
class CustomItemImpl {
    name;
    lore;
    item;
    amount;
    keepOnClose;
    rollback;
    placeableOn;
    notPlaceableOn;
    itemLock;
    remove;
    callback;
    constructor(options) {
        this.name = options.name;
        this.lore = options.lore;
        this.item = options.item;
        this.amount = options.amount ?? 1;
        this.keepOnClose = options.keepOnClose ?? false;
        this.rollback = options.rollback ?? false;
        this.placeableOn = options.placeableOn;
        this.notPlaceableOn = options.notPlaceableOn;
        this.itemLock = options.itemLock ?? ItemLockMode.none;
        this.remove = options.remove ?? false;
        world.beforeEvents.itemUse.subscribe((event) => {
            this.handleItemUse(event);
        });
        world.beforeEvents.playerPlaceBlock.subscribe((event) => {
            this.handleBlockPlacement(event);
        });
    }
    then(callback) {
        this.callback = callback;
        return this;
    }
    get() {
        const itemType = ItemTypes.get(this.item);
        if (!itemType) {
            throw new Error(`Invalid item type: ${this.item}`);
        }
        const itemStack = new ItemStack(itemType, this.amount);
        itemStack.nameTag = this.name;
        itemStack.setLore(this.lore);
        itemStack.lockMode = (this.itemLock);
        return itemStack;
    }
    give(player, amount) {
        const inventory = player.getComponent('inventory');
        if (inventory) {
            const giveAmount = amount ?? this.amount;
            const itemStack = this.get();
            itemStack.amount = giveAmount;
            if (itemStack.maxAmount > 1) {
                let remainingAmount = giveAmount;
                if (!inventory?.container)
                    return;
                for (let i = 0; i < inventory.container.size; i++) {
                    const currentItem = inventory?.container?.getItem(i);
                    if (currentItem && currentItem.typeId === itemStack.typeId && currentItem.nameTag === itemStack.nameTag && currentItem.amount < currentItem.maxAmount) {
                        const addAmount = Math.min(remainingAmount, currentItem.maxAmount - currentItem.amount);
                        currentItem.amount += addAmount;
                        inventory?.container?.setItem(i, currentItem);
                        remainingAmount -= addAmount;
                        if (remainingAmount <= 0)
                            break;
                    }
                }
                if (remainingAmount > 0) {
                    while (remainingAmount > 0) {
                        const itemToAdd = itemStack.clone();
                        itemToAdd.amount = Math.min(remainingAmount, itemToAdd.maxAmount);
                        inventory?.container?.addItem(itemToAdd);
                        remainingAmount -= itemToAdd.amount;
                    }
                }
            }
            else {
                for (let i = 0; i < giveAmount; i++) {
                    inventory?.container?.addItem(itemStack.clone());
                }
            }
        }
    }
    handleItemUse(event) {
        const player = event.source;
        const usedItemStack = event.itemStack;
        if (usedItemStack.typeId === this.item && usedItemStack.nameTag === this.name) {
            if (this.callback) {
                event.cancel = true;
                this.callback(player, usedItemStack);
                if (this.remove) {
                    this.removeItem(player, usedItemStack);
                }
            }
        }
    }
    handleBlockPlacement(event) {
        const player = event.player;
        const block = event.block;
        const itemStack = player.getComponent('inventory')?.container?.getItem(player.selectedSlotIndex);
        if (!itemStack || itemStack.typeId !== this.item || itemStack.nameTag !== this.name)
            return;
        if (this.placeableOn && !this.placeableOn.includes(block.typeId)) {
            event.cancel = true;
            player.sendMessage("そこには配置できません。(placeableOn)");
        }
        if (this.notPlaceableOn && this.notPlaceableOn.includes(block.typeId)) {
            event.cancel = true;
            player.sendMessage("そこには配置できません。(notPlaceableOn)");
        }
    }
    removeItem(player, usedItemStack) {
        const inventory = player.getComponent("inventory");
        if (!inventory || !inventory.container)
            return;
        system.run(() => {
            if (inventory.container) {
                for (let i = 0; i < inventory.container.size; i++) {
                    const currentItem = inventory.container.getItem(i);
                    if (currentItem && currentItem.typeId === usedItemStack.typeId && currentItem.nameTag === usedItemStack.nameTag) {
                        if (currentItem.amount <= 1) {
                            system.run(() => {
                                inventory.container?.setItem(i, undefined);
                            });
                        }
                        else {
                            system.run(() => {
                                currentItem.amount -= 1;
                                inventory.container?.setItem(i, currentItem);
                            });
                        }
                        return;
                    }
                }
            }
        });
    }
}
const CustomItem = CustomItemImpl;
export { CustomItem };
