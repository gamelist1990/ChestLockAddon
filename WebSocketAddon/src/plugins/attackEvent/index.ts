import {
    EntityInventoryComponent,
    EntityDamageCause,
    EntityDamageSource,
    ItemStack,
    world,
    Player,
    Entity,
    system,
    EntityHurtAfterEvent,
    EntityDieAfterEvent,
    ProjectileHitBlockAfterEvent,
    ProjectileHitEntityAfterEvent, // Import ProjectileHitEntityAfterEvent
} from '@minecraft/server';
import { Module, moduleManager } from '../../module/module';
import { Database } from '../../module/DataBase';

class AttackModule implements Module {
    name = 'Attack_Manager';
    enabledByDefault = true;
    docs = `プレイヤーの攻撃/キル/死亡/被ダメージを記録します。\n
**データ**\n
§r- キル数: §9ws_attack_kill_counts\n
§r- 死亡数: §9ws_attack_death_counts\n
§r- 攻撃数: §9ws_attack_counts\n
\n
**タグ**\n
§r- キル: §9w:kill\n
§r- 死亡: §9w:dead\n
§r- 攻撃: §9w:attack\n
§r- 被ダメージ: §9w:damaged\n
§r- 攻撃アイテム: §9w:attack_<アイテムID>\n
§r- 死亡原因: §9w:dead_case_<原因>\n
§r- ブロックに当たった矢: §9w:hit_block\n
§r- 当たったブロック: §9w:hit_block_<ブロックID>\n
§r- エンティティに当たった矢: §9w:hit_entity\n
§r- 当たったエンティティのアイテム: §9w:hit_entity_<アイテムID>\n`;


    private playerAttackMap = new Map<string, string>(); // 攻撃者と被攻撃者のマッピング
    private tagTimeout = 40; // タグの有効時間 (tick)

    private cachedPlayers: Player[] = []; // プレイヤーリストのキャッシュ
    private killCountDb: Database;
    private deathCountDb: Database;
    private attackCountDb: Database;

    private static readonly KILL_TAG = 'w:kill';
    private static readonly DEAD_TAG = 'w:dead';
    private static readonly ATTACK_TAG = 'w:attack';
    private static readonly DAMAGED_TAG = 'w:damaged';
    private static readonly ATTACK_ITEM_TAG = 'w:attack_';
    private static readonly HIT_BLOCK_TAG = 'w:hit_block';
    private static readonly HIT_BLOCK_ID_TAG = 'w:hit_block_';
    private static readonly HIT_ENTITY_TAG = 'w:hit_entity'; // Add hit entity tag
    private static readonly HIT_ENTITY_ITEM_TAG = 'w:hit_entity_'; // Add hit entity item tag


    constructor() {
        this.killCountDb = Database.create('ws_attack_kill_counts');
        this.deathCountDb = Database.create('ws_attack_death_counts');
        this.attackCountDb = Database.create('ws_attack_counts');
    }

    onEnable(): void {
        this.cachePlayers();
        this.registerEventListeners();
    }
    onInitialize(): void {
        this.cachePlayers();
        this.registerEventListeners();

    }

    onDisable(): void {
        this.unregisterEventListeners();
    }

    private registerEventListeners(): void {
        world.afterEvents.playerSpawn.subscribe(() => this.cachePlayers());
        world.afterEvents.playerLeave.subscribe(() => this.cachePlayers());
        world.afterEvents.entityHurt.subscribe(this.handleEntityHurt);
        world.afterEvents.entityDie.subscribe(this.handleEntityDie);
        world.afterEvents.projectileHitBlock.subscribe(this.handleProjectileHitBlock);
        world.afterEvents.projectileHitEntity.subscribe(this.handleProjectileHitEntity); // Subscribe to projectileHitEntity
    }

    private unregisterEventListeners(): void {
        world.afterEvents.entityHurt.unsubscribe(this.handleEntityHurt);
        world.afterEvents.entityDie.unsubscribe(this.handleEntityDie);
        world.afterEvents.playerSpawn.unsubscribe(() => this.cachePlayers());
        world.afterEvents.playerLeave.unsubscribe(() => this.cachePlayers());
        world.afterEvents.projectileHitBlock.unsubscribe(this.handleProjectileHitBlock);
        world.afterEvents.projectileHitEntity.unsubscribe(this.handleProjectileHitEntity); // Unsubscribe projectileHitEntity
    }

    private cachePlayers(): void {
        this.cachedPlayers = Array.from(world.getAllPlayers());
    }

    /**
     * エンティティがダメージを受けたときの処理
     */
    private handleEntityHurt = (event: EntityHurtAfterEvent) => {
        const { hurtEntity, damageSource } = event;
        const attacker = this.getDamagingEntity(damageSource);

        // 攻撃者がプレイヤーである場合のみ処理
        if (attacker instanceof Player) {
            this.playerAttackMap.set(hurtEntity.id, attacker.id);
            this.incrementAttackCount(attacker);
            attacker.addTag(AttackModule.ATTACK_TAG);
            this.removeTagWithTimeout(attacker, AttackModule.ATTACK_TAG, this.tagTimeout);

            // 攻撃アイテムのタグを追加
            const inventory = attacker.getComponent('inventory') as EntityInventoryComponent;
            if (inventory && inventory.container) {
                const itemStack = inventory.container.getItem(
                    attacker.selectedSlotIndex
                );
                if (itemStack) {
                    this.addAttackItemTag(attacker, itemStack);
                }
            }
            // 被攻撃者がプレイヤーの場合、ダメージタグを追加
            if (hurtEntity instanceof Player) {
                hurtEntity.addTag(AttackModule.DAMAGED_TAG);
                this.removeTagWithTimeout(hurtEntity, AttackModule.DAMAGED_TAG, this.tagTimeout);
            }
        }


    };

    /**
     * 攻撃アイテムのタグを追加する
     */
    private addAttackItemTag(attacker: Player, itemStack: ItemStack): void {
        const tag = `${AttackModule.ATTACK_ITEM_TAG}${itemStack.typeId.replace(
            ':',
            '_'
        )}`;

        attacker.addTag(tag);
        this.removeTagWithTimeout(attacker, tag, this.tagTimeout); //タグは上書きではなく、時間経過で消えるようにする
    }

    /**
     * 指定したタグを一定時間後に削除する
     */
    private removeTagWithTimeout(entity: Entity, tag: string, timeout: number): void {
        system.runTimeout(() => {
            try {
                if (entity.hasTag(tag)) {
                    entity.removeTag(tag);
                }
            } catch (error) {

            }
        }, timeout);
    }

    /**
     * エンティティが死亡したときの処理
     */
    private handleEntityDie = (event: EntityDieAfterEvent) => {
        const { deadEntity, damageSource } = event;

        if (!(deadEntity instanceof Player)) return;
        const { cause } = damageSource;

        this.addDeathCauseTag(deadEntity, cause);
        system.run(() => {
            deadEntity.addTag(`${AttackModule.DEAD_TAG}`);
        })
        this.incrementDeathCount(deadEntity);

        if (cause === EntityDamageCause.suicide) {
            this.playerAttackMap.delete(deadEntity.id);
            this.removeTags(deadEntity, cause);
            return;
        }

        const lastAttackerId = this.playerAttackMap.get(deadEntity.id);
        if (!lastAttackerId || lastAttackerId === deadEntity.id) {
            this.removeTags(deadEntity, cause);
            this.playerAttackMap.delete(deadEntity.id);
            return;
        }
        const lastAttacker = this.cachedPlayers.find((p) => p.id === lastAttackerId);

        if (!lastAttacker) {
            this.removeTags(deadEntity, cause);
            this.playerAttackMap.delete(deadEntity.id);
            return;
        }

        this.onPlayerKill(lastAttacker, deadEntity);
        this.removeTags(deadEntity, cause);
        this.playerAttackMap.delete(deadEntity.id);
    };

    /**
     * ダメージソースから攻撃エンティティを取得
     */
    private getDamagingEntity(damageSource: EntityDamageSource): Entity | undefined {
        let attacker: Entity | undefined = damageSource.damagingEntity;
        if (!attacker && damageSource.damagingProjectile) {
            attacker = damageSource.damagingProjectile;
        }
        return attacker;
    }

    /**
     * プレイヤーがキルを達成したときの処理 (カスタマイズ可能)
     */
    private async onPlayerKill(attacker: Player, _victim: Player): Promise<void> {
        this.applyKillTags(attacker);
        this.removeKillTagsWithTimeout(attacker, this.tagTimeout);

        await this.incrementKillCount(attacker);
    }
    /**
  * Kill Count を増やす (DB)
  */
    private async incrementKillCount(player: Player): Promise<void> {
        const currentKillCount = (await this.killCountDb.get(player)) ?? 0;
        const newKillCount = currentKillCount + 1;
        await this.killCountDb.set(player, newKillCount);
    }

    /**
     * Death Count を増やす (DB)
     */
    private async incrementDeathCount(player: Player): Promise<void> {
        const currentDeathCount = (await this.deathCountDb.get(player)) ?? 0;
        const newDeathCount = currentDeathCount + 1;
        await this.deathCountDb.set(player, newDeathCount); // Player オブジェクトをキーとして使用
    }

    /**
     * 殴打カウントを増やす (DB)
     */
    private async incrementAttackCount(player: Player): Promise<void> {
        const currentAttackCount = (await this.attackCountDb.get(player)) ?? 0;
        const newAttackCount = currentAttackCount + 1;
        await this.attackCountDb.set(player, newAttackCount);
    }


    /**
     * キルタグを付与
     */
    private applyKillTags(attacker: Player): void {
        attacker.addTag(AttackModule.KILL_TAG);
    }

    /**
     * 一定時間後にキルタグを削除
     */
    private removeKillTagsWithTimeout(attacker: Player, timeout: number): void {
        system.runTimeout(() => {
            if (attacker.hasTag(AttackModule.KILL_TAG)) {
                attacker.removeTag(AttackModule.KILL_TAG);
            }
        }, timeout);
    }

    /**
     * 死亡したプレイヤーのタグを削除
     * w:dead は残す
     */
    private removeTags(deadPlayer: Player, cause: EntityDamageCause): void {
        if (deadPlayer.hasTag(`w:dead_case_${cause}`)) {
            deadPlayer.removeTag(`w:dead_case_${cause}`);
        }
        if (deadPlayer.hasTag(AttackModule.DEAD_TAG)) {
            deadPlayer.removeTag(AttackModule.DEAD_TAG);
        }
        if (deadPlayer.hasTag(AttackModule.KILL_TAG)) {
            deadPlayer.removeTag(AttackModule.KILL_TAG);
        }
        if (deadPlayer.hasTag(AttackModule.ATTACK_TAG)) {
            deadPlayer.removeTag(AttackModule.ATTACK_TAG);
        }
        if (deadPlayer.hasTag(AttackModule.DAMAGED_TAG)) {
            deadPlayer.removeTag(AttackModule.DAMAGED_TAG);
        }
        //他のタグを消すときに、攻撃アイテムのタグも消えてしまわないように、startsWidthで検索
        for (const tag of deadPlayer.getTags()) {
            if (tag.startsWith(AttackModule.ATTACK_ITEM_TAG)) {
                deadPlayer.removeTag(tag);
            }
        }
    }
    /**
     * 死亡原因に基づいたタグを追加する
     */
    private addDeathCauseTag(player: Player, cause: EntityDamageCause): void {
        system.run(() => {
            player.addTag(`w:dead_case_${cause}`);
        })

        system.runTimeout(() => {
            player.removeTag(`w:dead_case_${cause}`)
        }, 40)
    }


    /**
     * ProjectileHitBlockAfterEventのハンドラ
     */
    private handleProjectileHitBlock = (event: ProjectileHitBlockAfterEvent) => {
        const { source, projectile } = event;
        const hitBlock = event.getBlockHit()?.block;

        if (!(source instanceof Entity)) return;
        if (!hitBlock) return;


        try {
            projectile.addTag(AttackModule.HIT_BLOCK_TAG);
            this.removeTagWithTimeout(projectile, AttackModule.HIT_BLOCK_TAG, this.tagTimeout);
        } catch (error) {
        }
        source.addTag(AttackModule.HIT_BLOCK_TAG);
        this.removeTagWithTimeout(source, AttackModule.HIT_BLOCK_TAG, this.tagTimeout);

        const blockIdTag = `${AttackModule.HIT_BLOCK_ID_TAG}${hitBlock.typeId.replace(':', '_')}`;
        source.addTag(blockIdTag);
        this.removeTagWithTimeout(source, blockIdTag, this.tagTimeout);
        try {
            projectile.addTag(blockIdTag);
            this.removeTagWithTimeout(projectile, blockIdTag, this.tagTimeout);
        } catch (error) {
        }
    };

    /**
      * ProjectileHitEntityAfterEventのハンドラ
      */
    private handleProjectileHitEntity = (event: ProjectileHitEntityAfterEvent) => {
        const { source, } = event;
        const hitEntity = event.getEntityHit()?.entity;

        if (!(source instanceof Player)) return;
        if (!hitEntity) return;

        source.addTag(AttackModule.HIT_ENTITY_TAG);
        this.removeTagWithTimeout(source, AttackModule.HIT_ENTITY_TAG, this.tagTimeout);


        // Get the entity type ID and add the tag.
        const entityTypeIdTag = `${AttackModule.HIT_ENTITY_ITEM_TAG}${hitEntity.typeId.replace(':', '_')}`;
        source.addTag(entityTypeIdTag);
        this.removeTagWithTimeout(source, entityTypeIdTag, this.tagTimeout);
    };
}

const attackModule = new AttackModule();
moduleManager.registerModule(attackModule);