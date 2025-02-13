import {
    world,
    Player,
    system,
    ItemStack,
    ItemUseAfterEvent,
    ItemUseOnAfterEvent,
    ItemReleaseUseAfterEvent,
    Entity,
    EntityHurtAfterEvent,
    EntityDamageCause,
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';

class ItemEventModule implements Module {
    name = 'Item_Event';
    enabledByDefault = true;

    docs = `
プレイヤーによるアイテムの使用、特定のアイテムの発射を検出し、タグを付与するモジュールです。
Minecraft Bedrock Edition で利用可能なイベント (\`itemUse\`, \`itemUseOn\`, \`itemReleaseUse\`, \`entityHurt\`) を使用して、
getShooter() メソッドを使わずに、発射者と発射物を高精度に紐付けます。

**機能:**

-   **アイテム使用の検出:** 
    -   \`itemUse\` イベント: プレイヤーがアイテムを「使用」したとき (手に持ったアイテムを右クリックしたとき) に発生します。
    -   \`itemUseOn\` イベント: プレイヤーがアイテムをブロックに対して使用したときに発生します。
    -   使用されたアイテムのIDに基づいたタグ (\`w:item_use_<item_id>\`) をプレイヤーに付与します。
-   **タグの自動削除:**  付与されたタグは、\`tagTimeout\` で設定された時間 (デフォルトでは 1 tick) 後に自動的に削除されます。

**使用されるタグ:**

-   \`w:item_use_<item_id>\`: プレイヤーが使用したアイテムの ID に基づいたタグ (例: \`w:item_use_diamond_sword\`)。

**重要な内部メカニズム:**

-   **\`projectilePlayerMap\` (Map):** 発射物 (の ID) と、それを発射したプレイヤー (の ID) 、発射時のtickを紐付けるために使用されます。
-   **\`getFiredProjectile()\`:** 指定された tick 後に発射される*予定*の投射物を予測して取得します。 \`system.runTimeout()\` と組み合わせて、実際に発射された直後の投射物を取得するために使用されます。
-  **\`cleanupProjectilePlayerMap()\`:** 一定時間経過した、または消滅したはずの発射物に対応するエントリを \`projectilePlayerMap\` から定期的に削除し、メモリリークを防ぎます。



`;

    private readonly ITEM_USE_TAG_PREFIX = 'w:item_use_';
    private tagTimeout = 1;
    // 発射物とプレイヤーを紐付ける Map
    private projectilePlayerMap = new Map<string, { playerId: string; tick: number }>();

    private readonly maxProjectileLifetime = 20 * 60; 

    onEnable(): void {
        this.log('Module Enabled');
        this.registerEventListeners();
    }

    onInitialize(): void {
        this.registerEventListeners();
    }

    onDisable(): void {
        this.log('Module Disabled');
        this.unregisterEventListeners();
    }

    private registerEventListeners(): void {
        world.afterEvents.itemUse.subscribe(this.handleItemUse);
        world.afterEvents.itemUseOn.subscribe(this.handleItemUseOn);
        world.afterEvents.itemReleaseUse.subscribe(this.handleItemReleaseUse);
        world.afterEvents.entityHurt.subscribe(this.handleEntityHurt);
    }

    private unregisterEventListeners(): void {
        world.afterEvents.itemUse.unsubscribe(this.handleItemUse);
        world.afterEvents.itemUseOn.unsubscribe(this.handleItemUseOn);
        world.afterEvents.itemReleaseUse.unsubscribe(this.handleItemReleaseUse);
        world.afterEvents.entityHurt.unsubscribe(this.handleEntityHurt);
    }

    private log(message: string): void {
        console.log(`${this.name}: ${message}`);
        // world.sendMessage(`${this.name}: ${message}`); // デバッグ用
    }

    private handleItemUse = (event: ItemUseAfterEvent) => {
        const player = event.source;
        if (!(player instanceof Player)) return;
        const itemStack = event.itemStack;

        if (itemStack.typeId === "minecraft:snowball") {
            const projectile = this.getFiredProjectile(player, "minecraft:snowball");
            if (projectile) {
                // 雪玉とプレイヤーを紐付け
                this.projectilePlayerMap.set(projectile.id, { playerId: player.id, tick: system.currentTick });
            }
        }
        this.addItemUseTag(player, itemStack);
    };

    private handleItemUseOn = (event: ItemUseOnAfterEvent) => { //ブロックに使用
        const player = event.source;
        if (!(player instanceof Player)) return;
        const itemStack = event.itemStack;
        this.addItemUseTag(player, itemStack);
    };

    private handleItemReleaseUse = (event: ItemReleaseUseAfterEvent) => {
        const player = event.source;
        if (!(player instanceof Player)) return;

        const itemStack = event.itemStack;
        if (!itemStack) return;

        // 弓の場合
        if (itemStack.typeId === 'minecraft:bow') {
            // 弓を射る直前に呼び出されるため、次のtickで発射される矢のIDを予測
            const arrow = this.getFiredProjectile(player, 'minecraft:arrow');
            if (arrow) {
                // 矢とプレイヤーを紐付け
                this.projectilePlayerMap.set(arrow.id, { playerId: player.id, tick: system.currentTick });
            }
        } // クロスボウの場合
        else if (itemStack.typeId === 'minecraft:crossbow') {
            const arrow = this.getFiredProjectile(player, 'minecraft:arrow');
            if (arrow) {
                this.projectilePlayerMap.set(arrow.id, { playerId: player.id, tick: system.currentTick });
            }
        }
    };

    // エンティティがダメージを受けたときのイベント
    private handleEntityHurt = (event: EntityHurtAfterEvent) => {
        const { damageSource } = event;
        // ダメージ原因が投射物によるものかどうかを確認
        if (damageSource.cause === EntityDamageCause.projectile) {
            const projectile = damageSource.damagingEntity; //発射物
            if (!projectile) return;

            const projectileId = projectile.id;
            // Map から発射物に対応するプレイヤー情報を取得
            const playerInfo = this.projectilePlayerMap.get(projectileId);
            if (playerInfo) {

                const player = world.getAllPlayers().find(p => p.id === playerInfo.playerId);
                if (!player) return;

                if (projectile.typeId === "minecraft:snowball") {
                } else if (projectile.typeId === "minecraft:trident") {
                } else if (projectile.typeId === 'minecraft:arrow') {
                }
                // 紐付けを削除
                this.projectilePlayerMap.delete(projectileId);
            }
            // 古くなったエントリを削除 (発射物が消滅した、または時間切れ)
            this.cleanupProjectilePlayerMap();
        }
    };
    // 古くなったエントリを削除
    private cleanupProjectilePlayerMap(): void {
        const currentTick = system.currentTick;
        for (const [projectileId, playerInfo] of this.projectilePlayerMap) {
            if (currentTick - playerInfo.tick > this.maxProjectileLifetime) {
                this.projectilePlayerMap.delete(projectileId); //古ければ消す
            }
        }
    }

    // アイテム使用タグを追加 (共通化)
    private addItemUseTag(player: Player, itemStack: ItemStack): void {
        const itemId = itemStack.typeId.replace(':', '_');
        const tag = `${this.ITEM_USE_TAG_PREFIX}${itemId}`;
        this.addTagWithTimeout(player, tag, this.tagTimeout);
    }

    // タグ付与 (共通化)
    private addTagWithTimeout(player: Player, tag: string, timeout: number): void {
        player.addTag(tag);
        console.log(tag)
        system.runTimeout(() => {
            player.removeTag(tag);

        }, timeout);
    }

    /**
     * 指定された tick 後に発射される、指定タイプの投射物を取得
     */
    private getFiredProjectile(
        player: Player,
        projectileType: string,
        afterTicks: number = 1
    ): Entity | undefined {
        let projectile: Entity | undefined = undefined;
        system.runTimeout(() => {
            const projectiles = player.dimension.getEntities({
                type: projectileType,
                location: player.location,
                closest: 1,
            });
            if (projectiles.length > 0) {
                projectile = projectiles[0];
            }
        }, afterTicks);
        return projectile;
    }
}

const itemEventModule = new ItemEventModule();
moduleManager.registerModule(itemEventModule);