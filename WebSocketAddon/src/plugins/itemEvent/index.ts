import {
    world,
    Player,
    system,
    ItemStack,
    ItemUseAfterEvent,
    ItemUseOnAfterEvent
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

class ItemEventModule implements Module {
    name = 'Item_Event';
    enabledByDefault = true;

    docs = `アイテム使用(特にブロックへの使用完了)を検出し、タグを付与。\n
**機能**\n
§r- 'itemUse', 'itemUseOn'イベントを使用。\n
§r- 使用アイテムIDのタグを付与:\n
  §r  - §9w:item_use_<item_id>§r: 単純使用\n
  §r  - §9w:item_useOn_<item_id>§r: ブロックに使用&完了\n
§r- タグは自動削除(デフォルト1tick後)。`;

    private readonly ITEM_USE_TAG_PREFIX = 'w:item_use_';
    private readonly ITEM_USE_ON_TAG_PREFIX = 'w:item_useOn_'; // useOn 用のプレフィックス
    private tagTimeout = 1;


    onEnable(): void {
        this.registerEventListeners();
    }

    onInitialize(): void {
        this.registerEventListeners();
    }

    onDisable(): void {
        this.unregisterEventListeners();
    }

    private registerEventListeners(): void {
        world.afterEvents.itemUse.subscribe(this.handleItemUse);
        world.afterEvents.itemUseOn.subscribe(this.handleItemUseOn);
    }

    private unregisterEventListeners(): void {
        world.afterEvents.itemUse.unsubscribe(this.handleItemUse);
        world.afterEvents.itemUseOn.unsubscribe(this.handleItemUseOn);
    }


    private handleItemUse = (event: ItemUseAfterEvent) => {
        const player = event.source;
        if (!(player instanceof Player)) return;
        const itemStack = event.itemStack;
        this.addItemUseTag(player, itemStack);

    };

    private handleItemUseOn = (event: ItemUseOnAfterEvent) => {
        const player = event.source;
        if (!(player instanceof Player)) return;
        const itemStack = event.itemStack;
        this.addItemUseOnTag(player, itemStack); // useOn 専用のタグ付与メソッドを呼び出す
    };


    // アイテム使用タグを追加 (itemUse 用)
    private addItemUseTag(player: Player, itemStack: ItemStack): void {
        const itemId = itemStack.typeId.replace(':', '_');
        const tag = `${this.ITEM_USE_TAG_PREFIX}${itemId}`;
        this.addTagWithTimeout(player, tag, this.tagTimeout);
    }

    // アイテム使用タグを追加 (itemUseOn 用)
    private addItemUseOnTag(player: Player, itemStack: ItemStack): void {
        const itemId = itemStack.typeId.replace(':', '_');
        
        const tag = `${this.ITEM_USE_ON_TAG_PREFIX}${itemId}`; // useOn 用のタグ
        this.addTagWithTimeout(player, tag, this.tagTimeout);
    }

    // タグ付与 (共通化)
    private addTagWithTimeout(player: Player, tag: string, timeout: number): void {
        player.addTag(tag);
        system.runTimeout(() => {
            player.removeTag(tag);
        }, timeout);
    }
}

const itemEventModule = new ItemEventModule();
moduleManager.registerModule(itemEventModule);