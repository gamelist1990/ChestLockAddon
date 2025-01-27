import {
    Player,
    ItemStack,
    ItemTypes,
    EntityInventoryComponent,
    world,
    ItemUseBeforeEvent,
    PlayerPlaceBlockBeforeEvent,
    ItemLockMode,
    system
} from '@minecraft/server';

interface CustomItemOptions {
    name: string;
    lore: string[];
    item: string;
    amount?: number;
    keepOnClose?: boolean;
    rollback?: boolean;
    placeableOn?: string[];  // 配置可能なブロックのリスト
    notPlaceableOn?: string[]; // 配置不可能なブロックのリスト
    itemLock?: ItemLockMode;
    remove?: boolean; // アイテム使用時に削除するかどうか
}

interface CustomItem {
    name: string;
    lore: string[];
    item: string;
    amount: number;
    keepOnClose: boolean;
    rollback: boolean;
    placeableOn: string[] | undefined;
    notPlaceableOn: string[] | undefined;
    itemLock: ItemLockMode;
    remove: boolean;
    then(callback: (player: Player, itemStack: ItemStack) => void): CustomItem;
    get(): ItemStack;
    give(player: Player, amount?: number): void;
    removeItem(player: Player, itemStack: ItemStack): void;
}

class CustomItemImpl implements CustomItem {
    public name: string;
    public lore: string[];
    public item: string;
    public amount: number;
    public keepOnClose: boolean;
    public rollback: boolean;
    public placeableOn: string[] | undefined;
    public notPlaceableOn: string[] | undefined;
    public itemLock: ItemLockMode;
    public remove: boolean;
    private callback?: (player: Player, itemStack: ItemStack) => void;

    constructor(options: CustomItemOptions) {
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

        world.beforeEvents.itemUse.subscribe((event: ItemUseBeforeEvent) => {
            this.handleItemUse(event);
        });

        world.beforeEvents.playerPlaceBlock.subscribe((event: PlayerPlaceBlockBeforeEvent) => {
            this.handleBlockPlacement(event);
        });
    }

    then(callback: (player: Player, itemStack: ItemStack) => void): CustomItem {
        this.callback = callback;
        return this;
    }

    get(): ItemStack {
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

    give(player: Player, amount?: number): void {
        const inventory = player.getComponent('inventory') as EntityInventoryComponent;
        if (inventory) {
            const giveAmount = amount ?? this.amount; // amountが指定されていなければ、デフォルトのamountを使用
            const itemStack = this.get();
            itemStack.amount = giveAmount; // 付与する個数を設定

            // スタック可能なアイテムの場合、空きスロットを探して追加、または新しいスロットに追加
            if (itemStack.maxAmount > 1) {
                let remainingAmount = giveAmount;
                if (!inventory?.container) return;
                for (let i = 0; i < inventory.container.size; i++) {
                    const currentItem = inventory?.container?.getItem(i);
                    if (currentItem && currentItem.typeId === itemStack.typeId && currentItem.nameTag === itemStack.nameTag && currentItem.amount < currentItem.maxAmount) {
                        const addAmount = Math.min(remainingAmount, currentItem.maxAmount - currentItem.amount);
                        currentItem.amount += addAmount;
                        inventory?.container?.setItem(i, currentItem);
                        remainingAmount -= addAmount;
                        if (remainingAmount <= 0) break;
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
            } else {
                // スタック不可のアイテムの場合、指定された個数分繰り返して追加
                for (let i = 0; i < giveAmount; i++) {
                    inventory?.container?.addItem(itemStack.clone());
                }
            }
        }
    }

    private handleItemUse(event: ItemUseBeforeEvent): void {
        const player = event.source;
        const usedItemStack = event.itemStack; // 使用されたアイテムのItemStack

        if (usedItemStack.typeId === this.item && usedItemStack.nameTag === this.name) {
            if (this.callback) {
                event.cancel = true;
                this.callback(player, usedItemStack);

                if (this.remove) {
                    this.removeItem(player, usedItemStack); // 使用されたItemStackを渡す
                }
            }
        }
    }

    private handleBlockPlacement(event: PlayerPlaceBlockBeforeEvent): void {
        const player = event.player;
        const block = event.block;
        const itemStack = player.getComponent('inventory')?.container?.getItem(player.selectedSlotIndex);

        if (!itemStack || itemStack.typeId !== this.item || itemStack.nameTag !== this.name) return;

        // ブロックの配置可否をチェック
        if (this.placeableOn && !this.placeableOn.includes(block.typeId)) {
            event.cancel = true; // 配置不可
            player.sendMessage("そこには配置できません。(placeableOn)");
        }
        if (this.notPlaceableOn && this.notPlaceableOn.includes(block.typeId)) {
            event.cancel = true; // 配置不可
            player.sendMessage("そこには配置できません。(notPlaceableOn)");
        }
    }

    public removeItem(player: Player, usedItemStack: ItemStack): void {
        const inventory = player.getComponent("inventory") as EntityInventoryComponent;
        if (!inventory || !inventory.container) return;

        system.run(() => {
            if (inventory.container) {
                for (let i = 0; i < inventory.container.size; i++) {
                    const currentItem = inventory.container.getItem(i);

                    if (currentItem && currentItem.typeId === usedItemStack.typeId && currentItem.nameTag === usedItemStack.nameTag) {
                        if (currentItem.amount <= 1) {
                            system.run(() => {
                                inventory.container?.setItem(i, undefined);
                            });
                        } else {
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

const CustomItem: new (options: CustomItemOptions) => CustomItem = CustomItemImpl;
export { CustomItem };