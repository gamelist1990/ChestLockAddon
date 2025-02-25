import {
    world,
    PlayerBreakBlockBeforeEvent,
    Player,
    system,
    PlayerPlaceBlockBeforeEvent,
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

class BreakEvent implements Module {
    name = 'BreakEvent';
    enabledByDefault = true;
    docs = `プレイヤーがブロックを破壊/設置した際に\n
    tagが付与されます\n
    **機能**\n
    §r- ブロック破壊時:\n
    §r  - §9w:break§r タグを付与\n
    §r  - §9w:break_[ブロックID]§r タグを付与\n
    §r  - §9w:break_item_[アイテム名]§r タグを付与 (アイテム使用時)\n
    §r  - §9w:break_cancel§r タグを持つプレイヤーは破壊不可\n
    §r- ブロック設置時:\n
    §r  - §9w:place§r タグを付与\n
    §r  - §9w:place_[ブロックID]§r タグを付与\n
    §r  - §9w:place_cancel§r タグを持つプレイヤーは設置不可\n
    §r- タグは付与後、1tick後に削除されます\n`;


    constructor() {
    }


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
        world.beforeEvents.playerBreakBlock.subscribe(this.BreakBlock);
        world.beforeEvents.playerPlaceBlock.subscribe(this.PlaceBlock);
    }


    private unregisterEventListeners(): void {
        world.beforeEvents.playerBreakBlock.unsubscribe(this.BreakBlock);
        world.beforeEvents.playerPlaceBlock.unsubscribe(this.PlaceBlock);
    }

    private PlaceBlock = (event: PlayerPlaceBlockBeforeEvent) => {
        const { block } = event;
        const player = event.player;
        const BlockName = block.typeId;
        // Block Tag
        const PLACE_TAG = `w:place`;
        const PLACE_TAG_ID = `w:place_${BlockName}`;
        const PLACE_TAG_CANCEL = `w:place_cancel`;
        // Block Tag

        if (player) {
            this.tag(player, PLACE_TAG);
            this.tag(player, PLACE_TAG_ID);
            if (player.hasTag(PLACE_TAG_CANCEL)) {
                event.cancel = true;
            }
        }
    }

    /**
     * ブロック破壊時
     */
    private BreakBlock = (event: PlayerBreakBlockBeforeEvent) => {
        const { itemStack, block } = event;
        const player = event.player;
        const itemName = itemStack?.nameTag;
        const BlockName = block.typeId;
        // Block Tag
        const BREAK_TAG = `w:break`;
        const BREAK_TAG_ID = `w:break_${BlockName}`;
        const BREAK_TAG_ITEM = `w:break_item_${itemName}`;
        const BREAK_TAG_CANCEL = `w:break_cancel`;
        // Block Tag

        if (player) {
            this.tag(player, BREAK_TAG);
            this.tag(player, BREAK_TAG_ID);
            this.tag(player, BREAK_TAG_ITEM);
            if (player.hasTag(BREAK_TAG_CANCEL)) {
                event.cancel = true;
            }
        }
    };

    private tag(player: Player, tag: string) {
        system.run(() => {
            player.addTag(tag);
            system.runTimeout(() => {
                player.removeTag(tag);
            }, 20) //1tickに変更
        })
    }
}


const Break_Place_Event = new BreakEvent();
moduleManager.registerModule(Break_Place_Event);