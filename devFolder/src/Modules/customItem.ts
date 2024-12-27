import {
    Player,
    ItemStack,
    ItemTypes,
    EntityInventoryComponent,
    world,
    ItemUseBeforeEvent,
    PlayerPlaceBlockBeforeEvent,
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
    then(callback: (player: Player, itemStack: ItemStack) => void): CustomItem;
    get(): ItemStack;
    give(player: Player): void;
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
        return itemStack;
    }

    give(player: Player): void {
        const inventory = player.getComponent('inventory') as EntityInventoryComponent;
        if (inventory) {
            inventory.container?.addItem(this.get());
        }
    }

    private handleItemUse(event: ItemUseBeforeEvent): void {
        const player = event.source;
        const itemStack = event.itemStack;

        // 自身のカスタムアイテムが使用されたか確認
        if (itemStack.typeId === this.item && itemStack.nameTag === this.name) {
            if (this.callback) {
                event.cancel = true;
                this.callback(player, itemStack);
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
}

const CustomItem: new (options: CustomItemOptions) => CustomItem = CustomItemImpl;

export { CustomItem };