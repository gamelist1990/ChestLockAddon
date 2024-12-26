import {
    Player,
    world,
    ItemStack,
    ItemTypes,
    Vector3,
    BlockInventoryComponent,
    system,
    Container,
    EntityInventoryComponent,
} from '@minecraft/server';

function locationToString(location: Vector3): string {
    return `${location.x} ${location.y} ${location.z}`;
}

function stringToLocation(locationString: string): Vector3 {
    const [x, y, z] = locationString.split(' ').map(Number);
    return { x, y, z };
}

class ChestForm {
    //@ts-ignore
    private titleText: string = 'Chest UI';
    private locationString: string = '0 0 0';
    private player: Player | undefined;
    private buttons: {
        slot: number;
        name: string;
        lore: string[];
        item: string;
        amount: number;
        keepOnClose?: boolean;
    }[] = [];
    private isInitialized: boolean = false;
    private intervalId: number | undefined;
    private processedSlots: Set<number> = new Set();
    private chestContainer: Container | undefined;

    constructor() { }

    title(title: string): ChestForm {
        this.titleText = title;
        return this;
    }

    location(location: string): ChestForm {
        this.locationString = location;
        if (!this.isInitialized) {
            this.initializeChestInteractionListener();
            this.isInitialized = true;
        }
        return this;
    }

    button(
        slot: number,
        name: string,
        lore: string[],
        item: string,
        amount: number = 1,
        keepOnClose?: boolean,
    ): ChestForm {
        this.buttons.push({
            slot,
            name,
            lore,
            item,
            amount,
            keepOnClose,
        });
        return this;
    }

    private initializeChestInteractionListener(): void {
        world.afterEvents.playerInteractWithBlock.subscribe((event) => {
            const { block, player } = event;

            if (
                locationToString(block.location) === this.locationString &&
                block.typeId === 'minecraft:chest'
            ) {
                this.player = player;
                this.placeItemsInChest();
                this.detectItemSelection();
                this.processedSlots.clear();
            }
        });
    }

    private placeItemsInChest(): void {
        if (!this.player) return;
        const loc = stringToLocation(this.locationString);
        const dimension = this.player.dimension;
        const chestBlock = dimension.getBlock(loc);
        const chest = chestBlock?.getComponent('inventory') as BlockInventoryComponent;
        this.chestContainer = chest?.container;

        if (!this.chestContainer) return;

        for (let i = 0; i < this.chestContainer.size; i++) {
            this.chestContainer.setItem(i, undefined);
        }

        for (const button of this.buttons) {
            const itemType = ItemTypes.get(button.item);
            if (!itemType) {
                console.warn(`Invalid item type: ${button.item}`);
                continue;
            }
            const itemStack = new ItemStack(itemType, button.amount);

            itemStack.nameTag = button.name;
            itemStack.setLore(button.lore);

            this.chestContainer.setItem(button.slot, itemStack);
        }
    }

    private detectItemSelection(): void {
        if (!this.player) return;

        this.intervalId = system.runInterval(() => {
            if (!this.player || !this.player.isValid()) {
                this.clearInterval();
                return;
            }

            const loc = stringToLocation(this.locationString);
            const chestBlock = this.player.dimension.getBlock(loc);

            // チェストが存在しない、またはチェストでなくなった場合、タイマーをクリア
            if (!chestBlock || chestBlock.typeId !== 'minecraft:chest') {
                this.clearInterval();
                return;
            }

            // チェストのインベントリを取得
            const chest = chestBlock.getComponent('inventory') as BlockInventoryComponent;
            const chestContainer = chest?.container;
            if (!chestContainer) return;

            // チェストの各スロットをチェック
            for (let i = 0; i < chestContainer.size; i++) {
                const chestItem = chestContainer.getItem(i);

                // チェストのスロットが空で、かつボタンがそのスロットに設定されていて、かつそのスロットが処理済みでない場合
                if (!chestItem && this.buttons.some(button => button.slot === i) && !this.processedSlots.has(i)) {
                    this.handleItemSelection(i, chestContainer);
                    this.processedSlots.add(i);
                    return;
                }
            }

            // プレイヤーのインベントリをチェック
            this.removeForbiddenItemsFromInventory();
        }, 4);
    }

    private removeForbiddenItemsFromInventory(): void {
        if (!this.player) return;

        const inventoryComponent = this.player.getComponent('inventory') as EntityInventoryComponent;
        const container = inventoryComponent?.container;
        if (!container) return;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && this.shouldItemBeRemoved(item)) {
                container.setItem(i, undefined);
            }
        }
    }

    private shouldItemBeRemoved(item: ItemStack): boolean {
        return this.buttons.some(button => {
            const isSameType = button.item === item.typeId;
            const isSameName = button.name === item.nameTag;
            const isSameLore = JSON.stringify(button.lore) === JSON.stringify(item.getLore());
            return isSameType && isSameName && isSameLore;
        });
    }

    private handleItemSelection(slot: number, chestContainer: Container): void {
        if (!this.player) return;

        console.warn(`${this.player.name} Item selected at slot: ${slot}`);

        // チェストからアイテムを削除
        chestContainer.setItem(slot, undefined);

        this.triggerCallback(slot);
    }

    private callback: ((response: { canceled: boolean; selection: number }) => void) | undefined;

    then(callback: (response: { canceled: boolean; selection: number }) => void): ChestForm {
        this.callback = callback;
        return this;
    }

    private triggerCallback(slot: number): void {
        if (this.callback) {
            this.callback({ canceled: false, selection: slot });
        }
    }

    private clearInterval(): void {
        if (this.intervalId !== undefined) {
            system.clearRun(this.intervalId);
            this.intervalId = undefined;
        }
    }
}

function main(player: Player) {
    const chestUI = new ChestForm()
        .title('Sub Menu')
        .location("0 -60 0")
        .button(0, 'Back to Main', ['Click to go back'], 'minecraft:diamond', 1);

    chestUI
        .then((response) => {
            if (!response.canceled && response.selection === 0) {
                console.warn('Target item action triggered!');
                player.runCommand('tp @s ~ ~1 ~');
                player.runCommand('give @s apple');
            }
        })
}

// プレイヤーのインベントリ情報を確認する関数
function checkPlayerInventory(player: Player) {
    const inventoryComponent = player.getComponent('inventory') as EntityInventoryComponent;
    const container = inventoryComponent?.container;

    if (container) {
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item) {
                player.sendMessage(`Slot ${i}: ${item.typeId} x ${item.amount}`);
            } else {
                player.sendMessage(`Slot ${i}: Empty`);
            }
        }
    } else {
        player.sendMessage("Could not retrieve inventory information.");
    }
}

world.afterEvents.chatSend.subscribe(event => {
    const { sender, message } = event;

    if (message === "#testchest") {
        console.warn("testchest");
        main(sender);
    } else if (message === "#checkInv") {
        checkPlayerInventory(sender);
    }
});