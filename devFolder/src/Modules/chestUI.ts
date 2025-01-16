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
    Dimension,
    PlayerCursorInventoryComponent,
    PlayerInteractWithBlockBeforeEvent,
} from '@minecraft/server';

function locationToString(location: Vector3): string {
    return `${location.x} ${location.y} ${location.z}`;
}

function stringToLocation(locationString: string): Vector3 {
    const [x, y, z] = locationString.split(' ').map(Number);
    return { x, y, z };
}

export interface ChestFormResponse {
    canceled: boolean;
    selection: number;
    page: string | undefined;
}

interface ChestForm {
    title(title: string): ChestForm;
    location(location: string): ChestForm;
    button(slot: number, name: string, lore: string[], item: string, amount: number, keepOnClose?: boolean, rollback?: boolean, targetPage?: string): ChestForm;
    show(player: Player): ChestForm; // Modified to accept player
    rollback(enabled: boolean): ChestForm;
    then(callback: (response: ChestFormResponse) => void): ChestForm;
    transferChest(chestForm: ChestForm): void;
    page(pageName: string): ChestForm;
    setPageButton(currentPage: string, slot: number, targetPage: string, name: string, lore: string[], item: string, amount: number, keepOnClose?: boolean): ChestForm;
}

class ChestFormImpl implements ChestForm {
    //@ts-ignore
    private titleText: string = 'Chest UI';
    private locationString: string = '0 0 0';
    private buttons: {
        slot: number;
        name: string;
        lore: string[];
        item: string;
        amount: number;
        keepOnClose?: boolean;
        rollback?: boolean;
        page?: string;
        targetPage?: string;
    }[] = [];
    private isInitialized: boolean = false;
    private intervalId: number | undefined;
    private processedSlots: Set<number> = new Set();
    private chestContainer: Container | undefined;
    private activePlayer: Player | undefined; // Track the currently active player
    private rollbackEnabled: boolean = false;
    private pages: { [key: string]: ChestForm } = {};
    private currentPage: string | undefined;

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
        keepOnClose: boolean | undefined = false,
        rollback: boolean | undefined = false,
        targetPage: string | undefined = undefined
    ): ChestForm {
        this.buttons.push({
            slot,
            name,
            lore,
            item,
            amount,
            keepOnClose,
            rollback,
            page: this.currentPage,
            targetPage: targetPage,
        });
        return this;
    }

    show(player: Player): ChestForm {
        // Check if another player is already using the chest
        if (this.activePlayer && this.activePlayer.isValid() && this.activePlayer !== player) {
            player.sendMessage("§cThis chest is already in use by another player.");
            return this;
        }

        this.activePlayer = player;
        this.currentPage = Object.keys(this.pages)[0];
        this.placeItemsInChest(player); // Pass the player to placeItemsInChest
        this.detectItemSelection(player); // Pass the player to detectItemSelection
        this.processedSlots.clear();
        return this;
    }

    rollback(enabled: boolean): ChestForm {
        this.rollbackEnabled = enabled;
        return this;
    }

    transferChest(chestForm: ChestForm): void {
        if (!(chestForm instanceof ChestFormImpl)) {
            console.error("Error: transferChest can only be used with ChestFormImpl instances.");
            return;
        }

        this.buttons = [];
        chestForm.buttons.forEach(button => {
            this.buttons.push({ ...button });
        });

        this.titleText = chestForm.titleText;
        this.currentPage = chestForm.currentPage;

        if (this.activePlayer) {
            this.placeItemsInChest(this.activePlayer);
        }
    }

    page(pageName: string): ChestForm {
        this.currentPage = pageName;
        this.pages[pageName] = this;
        return this;
    }

    setPageButton(currentPage: string, slot: number, targetPage: string, name: string, lore: string[], item: string, amount: number, keepOnClose: boolean = false): ChestForm {
        this.pages[currentPage].button(slot, name, lore, item, amount, keepOnClose, undefined, targetPage);
        return this;
    }

    private initializeChestInteractionListener(): void {
        world.beforeEvents.playerInteractWithBlock.subscribe((event: PlayerInteractWithBlockBeforeEvent) => {
            const { block, player } = event;

            if (
                locationToString(block.location) === this.locationString &&
                block.typeId === 'minecraft:chest'
            ) {
                // Check if another player is already using the chest
                if (this.activePlayer && this.activePlayer.isValid() && this.activePlayer !== player) {
                    player.sendMessage("§cこのチェストUIを誰かが既に開いています");
                    event.cancel = true; 
                    return;
                }
                this.show(player)
            }
        });
    }

    private placeItemsInChest(player: Player): void {
        const loc = stringToLocation(this.locationString);
        const dimension = player.dimension;
        const chestBlock = dimension.getBlock(loc);
        const chest = chestBlock?.getComponent('inventory') as BlockInventoryComponent;
        this.chestContainer = chest?.container;

        if (!this.chestContainer) return;

        for (let i = 0; i < this.chestContainer.size; i++) {
            this.chestContainer.setItem(i, undefined);
        }

        for (const button of this.buttons) {
            if (button.page === this.currentPage) {
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
    }

    private detectItemSelection(player: Player): void {
        this.clearInterval();

        this.intervalId = system.runInterval(() => {
            if (!this.activePlayer || !this.activePlayer.isValid()) {
                this.clearInterval();
                return;
            }

            const loc = stringToLocation(this.locationString);
            const chestBlock = this.activePlayer.dimension.getBlock(loc);

            if (!chestBlock || chestBlock.typeId !== 'minecraft:chest' || this.activePlayer !== player) {
                this.clearInterval();
                return;
            }

            const chest = chestBlock.getComponent('inventory') as BlockInventoryComponent;
            const chestContainer = chest?.container;
            if (!chestContainer) return;

            for (let i = 0; i < chestContainer.size; i++) {
                const chestItem = chestContainer.getItem(i);

                if (!chestItem && this.buttons.some(button => button.slot === i && button.page === this.currentPage) && !this.processedSlots.has(i)) {
                    this.handleItemSelection(i, chestContainer, player); // Pass player to handleItemSelection
                    this.processedSlots.add(i);
                    return;
                }
            }

            this.removeForbiddenItemsFromInventory(player); // Pass player to removeForbiddenItemsFromInventory
        }, 8);
    }


    private removeForbiddenItemsFromInventory(player: Player): void {

        const inventoryComponent = player.getComponent('inventory') as EntityInventoryComponent;
        const container = inventoryComponent?.container;
        if (!container) return;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && this.shouldItemBeRemoved(item, this.buttons)) {
                container.setItem(i, undefined);
            }
        }
    }

    private shouldItemBeRemoved(item: ItemStack, buttons: any[]): boolean {
        return buttons.some(button => {
            const isSameType = button.item === item.typeId;
            const isSameName = button.name === item.nameTag;
            const isSameLore = JSON.stringify(button.lore) === JSON.stringify(item.getLore());
            return isSameType && isSameName && isSameLore;
        });
    }

    private handleItemSelection(slot: number, chestContainer: Container, player: Player): void {
        chestContainer.setItem(slot, undefined);

        const button = this.buttons.find(b => b.slot === slot && b.page === this.currentPage);
        const shouldRollback = this.rollbackEnabled || button?.rollback === true;

        if (button?.targetPage) {
            this.currentPage = button.targetPage;
            this.placeItemsInChest(player); // Pass player to placeItemsInChest
        } else {
            this.triggerCallback(slot);

            const cursorInventory = player.getComponent('cursor_inventory') as PlayerCursorInventoryComponent;
            if (cursorInventory) {
                cursorInventory.clear();
            }

            if (shouldRollback) {
                this.teleportPlayer(player, player.dimension); // Use the correct player here
            }
        }
    }

    private teleportPlayer(player: Player, dimension: Dimension): void {
        const originalLocation = player.location;
        const teleportLocation = {
            x: originalLocation.x,
            y: originalLocation.y + 150,
            z: originalLocation.z,
        };
        system.runTimeout(() => {
            player.teleport(teleportLocation, { dimension });
        }, 1);

        system.runTimeout(() => {
            player.teleport(originalLocation, { dimension });
        }, 2);
    }

    callback: ((response: ChestFormResponse) => void) | undefined;

    then(callback: (response: ChestFormResponse) => void): ChestForm {
        this.callback = callback;
        return this;
    }

    private triggerCallback(slot: number): void {
        if (this.callback) {
            this.callback({ canceled: false, selection: slot, page: this.currentPage });
        }
    }

    private clearInterval(): void {
        if (this.intervalId !== undefined) {
            system.clearRun(this.intervalId);
            this.intervalId = undefined;
            this.activePlayer = undefined;
            this.processedSlots.clear();
        }
    }
}

const ChestForm: new () => ChestForm = ChestFormImpl;
export { ChestForm };