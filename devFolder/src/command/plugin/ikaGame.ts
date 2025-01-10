import {
    Player,
    system,
    Dimension,
    Vector3,
    EffectTypes,
    Block,
    BlockType,
    BlockTypes,
    BlockVolume,
    PlayerSoundOptions,
    EntityDamageCause,
    EntityRaycastOptions,
    Entity,
    ItemLockMode,
} from '@minecraft/server';
import { CustomItem } from '../../Modules/customItem';


// ----- グローバル関数 ----- //
/**
 * 指定したプレイヤーにサウンドを再生します。
 * @param player サウンドを再生するプレイヤー
 * @param soundId 再生するサウンドの識別子
 * @param options サウンドのオプション
 */
function playSoundForPlayer(player: Player, soundId: string, options: PlayerSoundOptions): void {
    system.run(() => {
        player.playSound(soundId, options);
    });
}

/**
 * 指定したエンティティにダメージを与えます。
 * @param target ダメージを受けるエンティティ
 * @param amount ダメージ量
 * @param damager ダメージを与えたエンティティ（オプション）
 * @param damageCause ダメージの原因（オプション）
 */
function applyDamageToEntity(
    target: Entity,
    amount: number,
    damager?: Player,
    damageCause?: EntityDamageCause,
): void {
    system.run(() => {
        target.applyDamage(amount, {
            damagingEntity: damager,
            cause: damageCause || EntityDamageCause.entityAttack,
        });
    });
}

// ----- チーム設定 ----- //
const TEAM_COLORS: { [key: string]: string } = {
    'spla:team1': 'cyan', // シアン
    'spla:team2': 'magenta', // マゼンタ
    'spla_team1': 'cyan', // シアン
    'spla_team2': 'magenta', // マゼンタ
};

// ----- 塗りクラス ----- //
class PaintManager {
    private dimension: Dimension;
    

    constructor(dimension: Dimension) {
        this.dimension = dimension;
    }

    /**
     * 指定した座標のブロックとその下のブロックを指定した色で塗る（置き換える）
     * @param location 座標
     * @param colorName 色の名前 (例: "cyan", "magenta")
     * @param radius 範囲 (半径)
     */
    paint(location: Vector3, colorName: string, radius: number = 1.5): void {
        const worldMinX = -30000000; // ワールドの最小X座標
        const worldMaxX = 30000000; // ワールドの最大X座標
        const worldMinY = -64; // ワールドの最小Y座標 (Bedrock Editionのデフォルト)
        const worldMaxY = 319; // ワールドの最大Y座標 (Bedrock Editionのデフォルト)
        const worldMinZ = -30000000; // ワールドの最小Z座標
        const worldMaxZ = 30000000; // ワールドの最大Z座標

        const minX = Math.max(Math.floor(location.x - radius), worldMinX); // 境界を超えないように制限
        const maxX = Math.min(Math.floor(location.x + radius), worldMaxX); // 境界を超えないように制限
        const minY = Math.max(Math.floor(location.y - radius), worldMinY); // 境界を超えないように制限
        const maxY = Math.min(Math.floor(location.y + radius), worldMaxY); // 境界を超えないように制限
        const minZ = Math.max(Math.floor(location.z - radius), worldMinZ); // 境界を超えないように制限
        const maxZ = Math.min(Math.floor(location.z + radius), worldMaxZ); // 境界を超えないように制限

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    // 円形に塗るための距離チェック
                    if (
                        Math.sqrt((x - location.x) ** 2 + (y - location.y) ** 2 + (z - location.z) ** 2) <=
                        radius
                    ) {
                        const blockLocation = { x, y, z };

                        // 指定された座標とその下のブロックをチェックして塗る
                        this.checkAndPaintBlock(blockLocation, colorName); // 現在の座標をチェックして塗る
                        for (let i = 0; i < 5; i++) {
                            const belowBlockLocation = { x, y: y - i, z };
                            if (belowBlockLocation.y >= worldMinY) {
                                this.checkAndPaintBlock(belowBlockLocation, colorName);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * 指定した座標のブロックをチェックし、塗ることができる場合は指定した色で塗る
     * @param location 座標
     * @param colorName 色の名前 (例: "cyan", "magenta")
     */
    private checkAndPaintBlock(location: Vector3, colorName: string): void {
        const block = this.dimension.getBlock(location);
        if (block) {
            const replacedBlockType = this.getReplacementBlockType(block, colorName);
            if (replacedBlockType) {
                try {
                    system.run(() => {
                        const blockVolume = new BlockVolume(location, location);
                        this.dimension.fillBlocks(blockVolume, replacedBlockType);
                    });
                } catch (error) {
                    console.error('ブロックの置き換えでエラー:', error);
                }
            }
        }
    }

    /**
     * 置き換えるべきブロックのタイプを取得する
     * @param block 置き換え対象のブロック
     * @param colorName 置き換える色の名前 (例: "cyan", "magenta")
     * @returns 置き換えるべきブロックのタイプ、置き換える必要がない場合は null
     */
    private getReplacementBlockType(block: Block, colorName: string): BlockType | null {
        const blockType = block.typeId;

        // 置き換え対象のブロックのリスト
        const replaceableBlocks = [
            'minecraft:white_concrete',
            'minecraft:magenta_concrete',
            'minecraft:cyan_concrete',
            'minecraft:white_concrete_powder',
            'minecraft:magenta_concrete_powder',
            'minecraft:cyan_concrete_powder',
            'minecraft:white_stained_glass',
            'minecraft:white_wool',
            'minecraft:cyan_wool',
            'minecraft:magenta_wool',
            'minecraft:white_terracotta',
            //砂
            'minecraft:sand',
            'minecraft:smooth_sandstone',
        ];

        // 指定された色で置き換える必要があるかどうかのフラグ
        let shouldReplace = false;

        // ブロックタイプに基づいて、指定された色で置き換える必要があるかどうかを判定
        if (replaceableBlocks.includes(blockType)) {
            shouldReplace = true; // replaceableBlocks に含まれていれば置き換えが必要
        }

        // 置き換える必要がない場合、または色の名前がなかった場合は null を返す
        if (!shouldReplace || !colorName) {
            return null;
        }

        // 置き換えるブロックのタイプを取得する
        let replacementBlockType;

        if (blockType.includes('sand')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_concrete_powder`);
        } else if (blockType.includes('smooth_sandstone')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_concrete`);
        } else if (blockType.includes('_concrete_powder')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_concrete_powder`);
        } else if (blockType.includes('_concrete')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_concrete`);
        } else if (blockType.includes('stained_glass')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_stained_glass`);
        } else if (blockType.includes('wool')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_wool`);
        } else if (blockType.includes('terracotta')) {
            replacementBlockType = BlockTypes.get(`minecraft:${colorName}_terracotta`);
        } else {
            replacementBlockType = null; // 置き換え対象外のブロックの場合は null
        }

        return replacementBlockType;
    }
}

// ----- スプラシューター ----- //
const splatShooterItem = new CustomItem({
    name: '§bスプラシューター',
    lore: ['§7前方へインクを高速発射！', '§7インクを飛ばして塗るぞ！'],
    item: 'minecraft:wooden_hoe',
    amount: 1,
    itemLock: (ItemLockMode.inventory),
    //  remove: true,
}).then((player: Player) => {
    // プレイヤーのディメンションを取得
    const dimension = player.dimension;

    const playerState = squidDashPlayerStates.get(player.id);
    if (playerState && playerState.isUsingSquidDash) {
        player.sendMessage('§cイカダッシュ中は使用できません！');
        return;
    }

    // PaintManager インスタンスを生成
    const paintManager = new PaintManager(dimension);

    // プレイヤーのチームカラーを取得
    let teamColorName = 'white'; // デフォルトは白
    for (const tag in TEAM_COLORS) {
        if (player.hasTag(tag)) {
            teamColorName = TEAM_COLORS[tag];
            break;
        }
    }

    // プレイヤーのレベル（インクレベル）を確認
    if (player.level < 1) {
        player.sendMessage('§cインクレベルが足りません！');
        return;
    }

    const location = player.location;
    const viewDirection = player.getViewDirection();

    // インク発射音を再生
    const soundOptions: PlayerSoundOptions = {
        location: location,
        volume: 0.5,
        pitch: 1.5,
    };
    playSoundForPlayer(player, 'camera.take_picture', soundOptions);

    // 視線の方向にインクを発射して塗る (最大5回)
    for (let i = 0; i < 5; i++) {
        // インクの飛沫の位置を計算 (視線方向に飛ばす)
        const inkLocation = {
            x: location.x + viewDirection.x * (1 + i),
            y: location.y + viewDirection.y * (1 + i) + 1.5,
            z: location.z + viewDirection.z * (1 + i),
        };

        // 塗りの処理
        paintManager.paint({ x: inkLocation.x, y: inkLocation.y, z: inkLocation.z }, teamColorName, 0.8);

        // レイキャストのオプションを設定
        const raycastOptions: EntityRaycastOptions = {
            maxDistance: 5, // レイの最大距離

        };

        // インクの飛沫の位置から視線方向にレイキャストを実行
        const raycastResult = dimension.getEntitiesFromRay(inkLocation, viewDirection, raycastOptions);

        // レイキャストの結果からエンティティにダメージを与える
        for (const entityHit of raycastResult) {
            const entity = entityHit.entity;
            // 自分自身にはダメージを与えない
            if (entity.id !== player.id) {

                // ダメージ適用時に敵チームかどうかをチェック
                let isEnemy = true;
                for (const tag in TEAM_COLORS) {
                    if (player.hasTag(tag) && entity.hasTag(tag)) {
                        isEnemy = false;
                        break;
                    }
                }

                if (isEnemy) {
                    applyDamageToEntity(entity, 5, player, EntityDamageCause.entityAttack);

                    // 敵にヒットしたときに効果音を鳴らす
                    const hitSoundOptions: PlayerSoundOptions = {
                        location: entity.location,
                        volume: 0.5,
                        pitch: 1.2,
                    };
                    playSoundForPlayer(player, 'random.orb', hitSoundOptions);
                }
            }
        }
    }

    // インク発射後にレベルを1減らす
    system.run(() => {
        player.addLevels(-1);
    });
});

// ----- イカダッシュ ----- //
interface SquidDashPlayerState {
    isActive: boolean;
    teamColor: string;
    intervalId?: number;
    hasLeftTeamBlock: boolean;
    isUsingSquidDash: boolean; // イカダッシュ中かどうかを示すフラグ
    lastTeamBlockLocation?: Vector3; // 最後に自チームのブロックにいた位置
    lastTeamBlockLeftTime?: number; // 最後に自チームのブロックを離れた時間
}

const squidDashPlayerStates: Map<string, SquidDashPlayerState> = new Map();

/**
 * プレイヤーのイカダッシュ状態を完全にリセットする関数
 * @param player 状態をリセットするプレイヤー
 */
function resetSquidDashState(player: Player) {
    const playerState = squidDashPlayerStates.get(player.id);
    if (playerState) {
        playerState.isActive = false;
        playerState.hasLeftTeamBlock = false;
        playerState.isUsingSquidDash = false;
        playerState.lastTeamBlockLocation = undefined;
        playerState.lastTeamBlockLeftTime = undefined;
        if (playerState.intervalId) {
            system.clearRun(playerState.intervalId);
            playerState.intervalId = undefined;
        }
        squidDashPlayerStates.set(player.id, playerState);

        // エフェクトを削除
        system.run(() => {
            player.removeEffect('speed');
            player.removeEffect('resistance');
            player.removeEffect('invisibility');
            player.removeEffect('regeneration');
            player.removeEffect('saturation');
        });
    }
}

const squidDashItem = new CustomItem({
    name: '§eイカダッシュ',
    lore: [
        '§7イカになって素早くダッシュ！',
        '',
        '使用条件:',
        '- 足元が自チームの色のブロックであること。',
        '',
        '効果:',
        '- 移動速度上昇、ダメージ耐性、透明化、HP自動回復、満腹度回復の効果を得る。',
        '- 使用中はインクタンクが自動的に補充される(経験値レベルが上昇)。',
        '- 足元または頭上が自チームの色のブロックであれば効果が持続する。',
        '- 自チームの色のブロックから離れた場合:',
        '    - その位置からx,z方向に1.5以上移動する、あるいは',
        '    - 3秒以上経過すると効果が終了する。',
        '- スニーク中は壁を登ることができる。',
        '',
        '※ このアイテムは使用しても消費されません。',
    ],
    item: 'minecraft:ender_eye',
    amount: 1,
    itemLock: (ItemLockMode.inventory),
    remove: false, // アイテムを消費しないように変更
}).then((player: Player) => {
    let playerState = squidDashPlayerStates.get(player.id);

    // プレイヤーのチームカラーを取得
    let teamColorName = 'white';
    for (const tag in TEAM_COLORS) {
        if (player.hasTag(tag)) {
            teamColorName = TEAM_COLORS[tag];
            break;
        }
    }

    const playerRollerState = playerRollerStates.get(player.id);
    const playerChargeState = playerChargeStates.get(player.id);
    if (playerRollerState && playerRollerState.isRollerMode) {
        player.sendMessage('§cスプラローラー使用中はイカダッシュを使用できません');
        return;
    }
    if (playerChargeState && playerChargeState.isCharging) {
        player.sendMessage('§cスプラチャージャー使用中はイカダッシュを使用できません');
        return;
    }

    if (!playerState) {
        // プレイヤーの状態を初期化
        playerState = {
            isActive: false,
            teamColor: teamColorName,
            hasLeftTeamBlock: false,
            isUsingSquidDash: false,
            lastTeamBlockLocation: undefined,
            lastTeamBlockLeftTime: undefined,
        };
        squidDashPlayerStates.set(player.id, playerState);
    } else {
        // 既に状態が存在する場合は、チームカラーを更新
        playerState.teamColor = teamColorName;
    }

    if (!playerState.isActive) {
        // イカダッシュを開始
        // (1) プレイヤーの足元のブロック（必須条件）
        const blockBelow = player.dimension.getBlock({
            x: player.location.x,
            y: Math.floor(player.location.y) - 1,
            z: player.location.z,
        });

        if (!blockBelow || !blockBelow.typeId.includes(playerState.teamColor)) {
            player.sendMessage(`§c${squidDashItem.name} は自チームの色のブロックの上でのみ使用できます`);
            return; // 足元が条件を満たさない場合はそもそも開始しない
        }

        // (2) 壁に密着しているか判定（isClimbingから流用しつつ調整）
        const viewDirection = player.getViewDirection();
        const horizontalViewDirection = {
            x: viewDirection.x,
            y: 0,
            z: viewDirection.z,
        };
        const magnitude = Math.sqrt(horizontalViewDirection.x ** 2 + horizontalViewDirection.z ** 2);

        // 水平方向の単位ベクトルを求める
        const normalizedHorizontalViewDirection = {
            x: horizontalViewDirection.x / magnitude,
            y: 0, // 水平方向なのでyは0
            z: horizontalViewDirection.z / magnitude,
        };

        const checkDistance = 0.3; // 密着判定のための距離。密着していたら0でも良いが、多少余裕を持たせる。小さくしすぎると壁抜けすることがあるので注意
        const isCloseToWall = (checkDistance: number) => {
            const checkLocation = {
                x: player.location.x + normalizedHorizontalViewDirection.x * checkDistance,
                y: player.location.y, // プレイヤーと同じ高さの水平方向
                z: player.location.z + normalizedHorizontalViewDirection.z * checkDistance,
            };
            const blockAtCheckLocation = player.dimension.getBlock(checkLocation);
            return blockAtCheckLocation && blockAtCheckLocation.isSolid; // ブロックが固体なら密着していると判定
        };

        const wallCheckDistance = 0.3; // 必要に応じて調整してください



        // (3) 前方のブロックの座標を取得
        // checkDistance を使ってプレイヤーの「前」の位置を取得します。y座標は調整する場合があります。
        const forwardCheckLocation = {
            x: player.location.x + normalizedHorizontalViewDirection.x * checkDistance,
            y: Math.floor(player.location.y), // 床の高さと同じか、+1ブロックくらいが良いでしょう
            z: player.location.z + normalizedHorizontalViewDirection.z * checkDistance,
        };

        // (4) 前方のブロックを取得し、自チームの色であることを確認
        const blockForward = player.dimension.getBlock(forwardCheckLocation);
        if (
            blockBelow.typeId.includes(playerState.teamColor) && //地面が自チームブロック
            (!isCloseToWall(wallCheckDistance) || blockForward?.typeId.includes(playerState.teamColor))
        ) {
            // 地面が自チームのブロックの場合 かつ 壁に密着している場合は前が自チームの色のブロック かどうか
            // -> イカダッシュを開始できる！

            playerState.isActive = true;
            playerState.hasLeftTeamBlock = false;
            playerState.isUsingSquidDash = true; // イカダッシュ開始時にフラグを true に設定

            // applyEffectsToPlayer 関数を展開
            system.run(() => {
                const speedEffect = EffectTypes.get('speed');
                const resistanceEffect = EffectTypes.get('resistance');
                const invisibilityEffect = EffectTypes.get('invisibility');
                const regenerationEffect = EffectTypes.get('regeneration');
                const saturationEffect = EffectTypes.get('saturation');

                if (speedEffect) {
                    player.addEffect(speedEffect, 6000, {
                        amplifier: 3,
                        showParticles: false,
                    });
                }
                if (resistanceEffect) {
                    player.addEffect(resistanceEffect, 6000, {
                        amplifier: 2,
                        showParticles: false,
                    });
                }
                if (invisibilityEffect) {
                    player.addEffect(invisibilityEffect, 6000, {
                        amplifier: 0,
                        showParticles: false,
                    });
                }
                if (regenerationEffect) {
                    player.addEffect(regenerationEffect, 6000, {
                        amplifier: 1,
                        showParticles: false,
                    });
                }
                if (saturationEffect) {
                    player.addEffect(saturationEffect, 6000, {
                        amplifier: 1,
                        showParticles: false,
                    });
                }
            });

            // インターバルを設定してプレイヤーの状態を監視
            const intervalId = system.runInterval(() => {
                const updatedPlayerState = squidDashPlayerStates.get(player.id);
                if (!updatedPlayerState || !updatedPlayerState.isActive) {
                    // イカダッシュが終了している場合、状態をリセットしてインターバルをクリア
                    resetSquidDashState(player);
                    return;
                }

                // プレイヤーの足元のブロックをチェック
                const blockBelow = player.dimension.getBlock({
                    x: player.location.x,
                    y: Math.floor(player.location.y) - 1,
                    z: player.location.z,
                });
                //プレイヤーの頭上のブロックを取得
                const blockUp = player.dimension.getBlock({
                    x: player.location.x,
                    y: Math.floor(player.location.y) + 2,
                    z: player.location.z,
                });

                // 自チームのブロックの外に出たかどうかをチェック（どちらか一方を満たせばOK）
                // プレイヤーの足元または頭上が自チームのブロックでなければ、自チームのブロックから離れたと判定
                if (
                    !(blockBelow && blockBelow.typeId.includes(updatedPlayerState.teamColor)) &&
                    !(blockUp && blockUp.typeId.includes(updatedPlayerState.teamColor)) &&
                    !updatedPlayerState.hasLeftTeamBlock
                ) {
                    // プレイヤーが最後に自チームのブロックにいた位置を記録
                    updatedPlayerState.lastTeamBlockLocation = player.location;
                    updatedPlayerState.hasLeftTeamBlock = true;
                }

                // 自チームのブロックから離れた後、一定距離以上移動したか、または一定時間経過したかをチェック
                if (updatedPlayerState.hasLeftTeamBlock) {
                    const hasMovedFarEnough =
                        updatedPlayerState.lastTeamBlockLocation &&
                        (Math.abs(player.location.x - updatedPlayerState.lastTeamBlockLocation.x) > 1.5 ||
                            Math.abs(player.location.z - updatedPlayerState.lastTeamBlockLocation.z) > 1.5);

                    const hasExceededInactivityThreshold =
                        updatedPlayerState.lastTeamBlockLeftTime !== undefined &&
                        Date.now() - updatedPlayerState.lastTeamBlockLeftTime > 3000; // 3秒経過でtrue

                    if (hasMovedFarEnough || hasExceededInactivityThreshold) {
                        // イカダッシュを完全に停止して状態をリセット
                        resetSquidDashState(player);
                        // player.sendMessage(`§7${squidDashItem.name} の効果が停止しました`);
                        return; // リセットしたので、このインターバルはここで終了
                    } else if (!updatedPlayerState.lastTeamBlockLeftTime) {
                        updatedPlayerState.lastTeamBlockLeftTime = Date.now();
                    }
                }

                // 壁に張り付いているかどうかをチェックし、登る
                if (player.isSneaking) {
                    const viewDirection = player.getViewDirection();
                    const horizontalViewDirection = {
                        x: viewDirection.x,
                        y: 0,
                        z: viewDirection.z,
                    };
                    const magnitude = Math.sqrt(
                        horizontalViewDirection.x ** 2 + horizontalViewDirection.z ** 2,
                    );
                    const normalizedHorizontalViewDirection = {
                        x: horizontalViewDirection.x / magnitude,
                        y: 0,
                        z: horizontalViewDirection.z / magnitude,
                    };
                    const checkDistance = 0.55; // ブロックを判定する距離を少し伸ばす
                    const checkLocation = {
                        x: player.location.x + normalizedHorizontalViewDirection.x * checkDistance,
                        y: player.location.y + 1,
                        z: player.location.z + normalizedHorizontalViewDirection.z * checkDistance,
                    };

                    // プレイヤーの前のブロックをチェック
                    const blockInFront = player.dimension.getBlock(checkLocation);
                    if (blockInFront && blockInFront.typeId.includes(updatedPlayerState.teamColor)) {
                        // ノックバックを使用して壁を登る
                        system.run(() => {
                            player.applyKnockback(0, 0, 0, 0); // 現在のノックバックをリセット
                            player.applyKnockback(
                                normalizedHorizontalViewDirection.x,
                                normalizedHorizontalViewDirection.z,
                                0,
                                0.5,
                            ); // 上向きのノックバックを適用
                        });
                    }
                }

                // インクの自動補充処理
                const INK_TANK_MAX_LEVEL = 50;
                if (player.level < INK_TANK_MAX_LEVEL) {
                    player.addLevels(1);
                    if (player.level >= INK_TANK_MAX_LEVEL) {
                        player.sendMessage(`§aインクレベル§fが §6MAX§f になりました！`);
                        const soundOptions: PlayerSoundOptions = {
                            location: player.location,
                            volume: 0.5,
                            pitch: 0.8,
                        };
                        playSoundForPlayer(player, 'random.levelup', soundOptions);
                    }
                }
            }, 5); // 短い間隔でチェック (5 ticks)

            playerState.intervalId = intervalId;
            squidDashPlayerStates.set(player.id, playerState);
            //  player.sendMessage(`§a${squidDashItem.name} の効果が開始されました`);
        } else {
            player.sendMessage(
                `§c${squidDashItem.name} は自チームの色のブロックの上で、前がひらけている必要があります`,
            );
        }
    } else {
        // イカダッシュを停止
        resetSquidDashState(player); // 状態を完全にリセットする関数を呼び出す
        //player.sendMessage(`§7${squidDashItem.name} の効果が停止しました`);
    }
});










const splatChargerItem = new CustomItem({
    name: "§bスプラチャージャー",
    lore: [
        "§7長射程のチャージ式狙撃用武器",
        "§7使用でチャージ開始、シフトで強力なインクショットを発射",
        "§7チャージ中に移動速度が低下",
        "§7着弾地点を大きく塗りつぶす",
        "§7フルチャージで敵プレイヤーを一撃で倒せる",
        "§7フルチャージでない場合は中程度のダメージ",
        "§7使用時、インクレベルを多く消費",
    ],
    item: "minecraft:stone_hoe",
    amount: 1,
    itemLock: (ItemLockMode.inventory),
});

// プレイヤーごとのチャージ状態を管理するマップ
const playerChargeStates: Map<string, {
    isCharging: boolean;
    chargeStartTime: number;
    chargeIntervalId?: number;
    teamColorName: string; // プレイヤーのチームカラー
    sneakIntervalId?: number; // スニーク監視用のインターバルID
    isChargeKept?: boolean; // チャージキープ状態
}> = new Map();

splatChargerItem.then((player: Player) => {
    const dimension = player.dimension;

    // プレイヤーの状態をマップから取得、または初期化
    let playerState = playerChargeStates.get(player.id);
    if (!playerState) {
        playerState = {
            isCharging: false,
            chargeStartTime: 0,
            teamColorName: "white",
            isChargeKept: false,
        };
        playerChargeStates.set(player.id, playerState);
    }

    const playerState_dash = squidDashPlayerStates.get(player.id);

    if (playerState_dash && playerState_dash.isUsingSquidDash) {
        player.sendMessage("§cイカダッシュ中は使用できません！");
        return;
    }

    const paintManager = new PaintManager(dimension);

    // プレイヤーのチームカラーを取得
    for (const tag in TEAM_COLORS) {
        if (player.hasTag(tag)) {
            playerState.teamColorName = TEAM_COLORS[tag];
            break;
        }
    }
    //チームカラーが変わった場合の対策
    playerChargeStates.set(player.id, playerState);

    // 必要なインクレベル
    const requiredInkLevel = 5;

    const startCharge = () => {
        // プレイヤーの状態をマップから取得
        let playerState = playerChargeStates.get(player.id);
        if (!playerState) return; // playerState が undefined なら何もしない

        // チャージ開始時の処理
        playerState.isCharging = true;
        playerState.isChargeKept = false; // チャージ開始時にチャージキープ状態をリセット
        playerState.chargeStartTime = Date.now();
        playerChargeStates.set(player.id, playerState); // 状態を更新
        player.sendMessage("§7チャージ開始...");

        // 移動速度低下の効果を付与
        system.run(() => {
            const slownessEffect = EffectTypes.get("slowness");
            if (slownessEffect) {
                player.addEffect(slownessEffect, 100, {
                    amplifier: 4, // 移動速度低下のレベル (0-255)
                    showParticles: false,
                });
            }
        });

        playerState.chargeIntervalId = system.runInterval(() => {
            // playerStateを毎tick更新
            playerState = playerChargeStates.get(player.id);
            if (!playerState) {
                return; // プレイヤーの状態がなければ処理を中断
            }
            const chargeTime = Date.now() - playerState.chargeStartTime;

            // チャージ完了の判定
            if (chargeTime >= 3000) {
                // チャージ完了時の処理
                if (!playerState.isChargeKept) {
                    player.sendMessage("§aチャージ完了！チャージキープ発動可能");
                    system.runTimeout(() => {
                        player.onScreenDisplay.setActionBar("§aチャージキープ発動OK");
                    }, 20)

                    playerState.isChargeKept = true; // チャージキープ状態に設定

                    // チャージ完了音を再生
                    const soundOptions: PlayerSoundOptions = {
                        location: player.location,
                        volume: 0.5,
                        pitch: 2.0,
                    };
                    playSoundForPlayer(player, "random.orb", soundOptions);

                    // チャージインターバルは維持（エフェクトとアクションバーのため）
                }
            } else {
                // チャージ中の処理 (プログレスバーのような表示)
                const progress = Math.floor((chargeTime / 3000) * 10);
                const progressBar =
                    "§e|".repeat(progress) + "§7-".repeat(10 - progress);
                player.onScreenDisplay.setActionBar(progressBar);
            }
            playerChargeStates.set(player.id, playerState); // 状態を更新
        }, 1);

        // スニーク状態の監視を開始
        playerState.sneakIntervalId = system.runInterval(() => {
            let playerState = playerChargeStates.get(player.id);
            if (!playerState) {
                return;
            }

            // チャージ中にスニークしたら射撃
            if (playerState.isCharging && player.isSneaking) {
                const chargeTime = Date.now() - playerState.chargeStartTime;
                shoot(chargeTime >= 3000); // チャージ時間に応じてフルチャージかどうかを判断
            }
        }, 1); // 1tickごとにスニークを監視
        playerChargeStates.set(player.id, playerState);
    };

    const shoot = (isFullCharge: boolean) => {
        // プレイヤーの状態をマップから取得
        let playerState = playerChargeStates.get(player.id);
        if (!playerState) return; // playerState が undefined なら何もしない

        // 射撃処理
        playerState.isCharging = false; //射撃したらチャージ状態は終了
        playerState.isChargeKept = false; // 射撃したらチャージキープ状態も終了
        if (playerState.chargeIntervalId) {
            system.clearRun(playerState.chargeIntervalId);
            playerState.chargeIntervalId = undefined;
        }
        if (playerState.sneakIntervalId) {
            system.clearRun(playerState.sneakIntervalId);
            playerState.sneakIntervalId = undefined;
        }
        playerChargeStates.set(player.id, playerState); // 状態を更新

        const startLocation = player.location;

        // 射撃音を再生 (フルチャージ時と通常時で異なる音)
        const soundOptions: PlayerSoundOptions = {
            location: startLocation,
            volume: 0.5,
            pitch: isFullCharge ? 0.5 : 1.0,
        };
        playSoundForPlayer(player, "crossbow.shoot", soundOptions);

        // インクの初速（フルチャージ時は大きくする）
        const initialVelocity = isFullCharge ? 4 : 2;

        // 飛翔角度
        const pitch = (player.getRotation().x * Math.PI) / 180;
        const yaw = (player.getRotation().y * Math.PI) / 180;

        // 重力加速度
        const gravity = -0.05;

        const paintRadius = isFullCharge ? 1.2 : 0.6;
        const damageRadius = 1; // ダメージ判定の半径
        const maxDistance = isFullCharge ? 200 : 100; // 飛距離

        let currentPosition = { ...startLocation };
        for (let i = 0; i < maxDistance * 2; i++) { // より細かいステップで処理
            const time = i * 0.05; // 時間の経過を細かくする

            // 放物線運動の計算
            const deltaX = initialVelocity * Math.cos(pitch) * Math.sin(-yaw) * time;
            const deltaY = initialVelocity * Math.sin(-pitch) * time + 0.5 * gravity * time * time;
            const deltaZ = initialVelocity * Math.cos(pitch) * Math.cos(-yaw) * time;

            const newX = startLocation.x + deltaX;
            const newY = startLocation.y + deltaY + player.getHeadLocation().y - player.location.y; // 発射点を頭の位置に調整
            const newZ = startLocation.z + deltaZ;

            currentPosition = { x: newX, y: newY, z: newZ };

            // 地面またはブロックに当たったらループを抜ける
            const blockAtPosition = dimension.getBlock(currentPosition);
            if (blockAtPosition && blockAtPosition.typeId !== 'minecraft:air') {
                // 着弾地点を塗りつぶす
                paintManager.paint(currentPosition, playerState.teamColorName, paintRadius * 1.5);
                break;
            }

            // 塗りの処理
            paintManager.paint(currentPosition, playerState.teamColorName, paintRadius);

            // ダメージ判定
            const nearbyEntities = dimension.getPlayers({
                location: currentPosition,
                maxDistance: damageRadius,
            });

            for (const entity of nearbyEntities) {
                if (entity.id !== player.id) {
                    let isEnemy = true;
                    for (const tag in TEAM_COLORS) {
                        if (player.hasTag(tag) && entity.hasTag(tag)) {
                            isEnemy = false;
                            break;
                        }
                    }

                    if (isEnemy) {
                        const damage = isFullCharge ? 100 : 8;
                        applyDamageToEntity(
                            entity,
                            damage,
                            player,
                            EntityDamageCause.entityAttack
                        );

                        const hitSoundOptions: PlayerSoundOptions = {
                            location: entity.location,
                            volume: 0.5,
                            pitch: 1.2,
                        };
                        playSoundForPlayer(player, "random.orb", hitSoundOptions);
                        // ダメージを与えたらループを抜ける (貫通しないようにする場合)
                        break;
                    }
                }
            }
        }

        // インク発射後にレベルを減らす (フルチャージ時と通常時で消費量を変える)
        system.run(() => {
            player.addLevels(isFullCharge ? -5 : -3);
            player.removeEffect("slowness");
            player.onScreenDisplay.setActionBar(""); // アクションバーをクリア
        });

        player.sendMessage(
            isFullCharge ? "§aフルチャージショット！" : "§7チャージショット"
        );
    };

    // アイテム使用時の処理 (チャージ開始)
    let currentPlayerState = playerChargeStates.get(player.id);
    if (!currentPlayerState || !currentPlayerState.isCharging) {
        // インクレベルの確認
        if (player.level < requiredInkLevel) {
            player.sendMessage(
                `§cインクレベルが足りません！(最低 ${requiredInkLevel} 必要)`
            );
            return;
        }
        // チャージを開始
        startCharge();
    } else {
        player.sendMessage("§c既にチャージ中です");
    }
});


// ----- スプラッシュボム ----- //
const splatBombItem = new CustomItem({
    name: "§bスプラッシュボム",
    lore: [
        "§7起爆式のインク式ボム",
        "§7投げた後数秒後に起爆する",
        "§7爆心地を大きく塗りつぶす",
        "§7敵に直撃させると大ダメージ！",
        "§7使用時、多くのインクを消費"
    ],
    item: "minecraft:turtle_helmet",
    remove: true,
    amount: 5,
    itemLock: (ItemLockMode.inventory),
});

// スプラッシュボムをプレイヤーが使ったときの処理
splatBombItem.then((player: Player) => {
    const dimension = player.dimension;

    // 必要なインクレベル
    const requiredInkLevel = 10;

    // インクレベルの確認
    if (player.level < requiredInkLevel) {
        player.sendMessage(`§cインクレベルが足りません！(最低 ${requiredInkLevel} 必要)`);
        return;
    }

    // インクを消費
    system.run(() => {
        player.addLevels(-requiredInkLevel);
    });

    // ダッシュ中には使えない
    const playerState_dash = squidDashPlayerStates.get(player.id);

    if (playerState_dash && playerState_dash.isUsingSquidDash) {
        player.sendMessage("§cイカダッシュ中は使用できません！");
        return;
    }

    // スプラッシュボムを投げる処理
    const teamColorName = getTeamColorName(player);
    const viewDirection = player.getViewDirection();
    const velocityMultiplier = 5; // 投げる強さの調整用

    // 初速を計算
    const initialVelocity: Vector3 = {
        x: viewDirection.x * velocityMultiplier,
        y: viewDirection.y * velocityMultiplier,
        z: viewDirection.z * velocityMultiplier,
    };

    // 初期位置を計算
    const initialPosition: Vector3 = {
        x: player.location.x + viewDirection.x,
        y: player.location.y + 1.5, // プレイヤーの目の高さから
        z: player.location.z + viewDirection.z,
    };

    // 予測と塗りの実行
    predictAndPaint(initialVelocity, initialPosition, teamColorName, dimension, player);

});

// 爆発処理用の関数（以前と同じ）
function explode(location: Vector3, dimension: Dimension, player: Player, teamColorName: string) {
    const paintManager = new PaintManager(dimension);

    // 爆発範囲を塗る
    paintManager.paint(location, teamColorName, 6); // 半径6の範囲を塗る 変更点(1) 3 -> 6

    // 爆発範囲内のエンティティにダメージを与える
    const entities = dimension.getEntities({
        location: location,
        maxDistance: 6, // 半径6の範囲内のエンティティを取得 変更点(2) 3 -> 6
    });

    for (const entity of entities) {
        // 自分自身にはダメージを与えない
        if (entity.id !== player.id) {
            // ダメージ適用時に敵チームかどうかをチェック
            let isEnemy = true;
            for (const tag in TEAM_COLORS) {
                if (player.hasTag(tag) && entity.hasTag(tag)) {
                    isEnemy = false;
                    break;
                }
            }

            if (isEnemy) {
                // ダメージ量を設定
                const damage = 40; // とりあえず固定ダメージ 変更点(3) 20 -> 40
                applyDamageToEntity(entity, damage, player, EntityDamageCause.entityExplosion);
            }
        }
    }
    dimension.spawnParticle("minecraft:huge_explosion_emitter", location);

    // 爆発音を再生
    const soundOptions: PlayerSoundOptions = {
        location: location,
        volume: 0.8,
        pitch: 1.0,
    };
    playSoundForPlayer(player, "random.explode", soundOptions);
}

// プレイヤーのチームカラーを取得する関数（以前と同じ）
function getTeamColorName(player: Player): string {
    for (const tag in TEAM_COLORS) {
        if (player.hasTag(tag)) {
            return TEAM_COLORS[tag];
        }
    }
    return "white"; // デフォルトは白
}

/**
 * エンティティを使わずにスプラッシュボムの軌道を計算し、着地地点を予測して塗る関数
 * @param initialVelocity 初速
 * @param initialPosition 初期位置
 * @param teamColorName チームカラー名
 * @param dimension ディメンション
 * @param player プレイヤー
 */
function predictAndPaint(initialVelocity: Vector3, initialPosition: Vector3, teamColorName: string, dimension: Dimension, player: Player) {
    const paintManager = new PaintManager(dimension);
    const gravity = -1; // 重力加速度
    const timeInterval = 2;  // 軌道計算と塗りの間隔(tick)
    const maxDuration = 60; // 処理を継続する最大時間(tick) (=3秒)
    const maxDistance = 30; // プレイヤーからこれ以上離れたら処理を停止する距離
    const explosionRadius = 6; // 爆発半径 変更点(4) 3 -> 6
    let timeElapsed = 0;

    let velocity: Vector3 = initialVelocity;
    let position: Vector3 = initialPosition;

    const intervalId = system.runInterval(() => {
        // 速度を更新（重力加速度を適用）
        velocity.y += gravity * (timeInterval / 20); // timeInterval tick分の重力加速度を適用

        // 位置を更新
        position = {
            x: position.x + velocity.x * (timeInterval / 20), // timeInterval tick分の移動量を適用
            y: position.y + velocity.y * (timeInterval / 20),
            z: position.z + velocity.z * (timeInterval / 20),
        };

        timeElapsed += timeInterval;

        // プレイヤーからの距離を計算
        const distance = Math.sqrt(
            Math.pow(position.x - player.location.x, 2) +
            Math.pow(position.y - player.location.y, 2) +
            Math.pow(position.z - player.location.z, 2)
        );

        // 地面、壁に当たったか、最大時間を超えたか、プレイヤーから離れすぎたら処理を停止
        if (dimension.getBlock(position)?.typeId !== "minecraft:air" || timeElapsed >= maxDuration || distance >= maxDistance) {
            //着弾を検知して起爆時に塗った場所に塗る
            system.runTimeout(() => {
                paintManager.paint(position, teamColorName, explosionRadius); // 着地地点を塗る
            }, 6)

            system.clearRun(intervalId);
            // 着弾時に音とパーティクルを生成
            dimension.spawnParticle(`spla:${teamColorName}_particle`, position,);

            const soundOptions: PlayerSoundOptions = {
                location: position,
                volume: 0.8,
                pitch: 1.0,
            };

            playSoundForPlayer(player, "random.explode", soundOptions);
            explode(position, dimension, player, teamColorName)

            return;
        }

        // 軌道上にパーティクルを表示
        system.runTimeout(() => {
            dimension.spawnParticle("minecraft:cauldron_explosion_emitter", position); // バブルバーストのエフェクト

        }, 3)

    }, timeInterval);
}





const splatRollerItem = new CustomItem({
    name: '§bスプラローラー',
    lore: [
        '§7前方の地面を塗るローラー',
        '§7使用でローラーモードに切り替え',
        '§7ローラーモード中は移動した場所を塗りつぶす',
        '§7ローラーモード中はインクレベルが徐々に減少',
        '§7再度使用でローラーモードを終了',
        '§7インクが切れると強制的にローラーモードが終了する',
        '§7ローラーで轢いた敵にダメージを与える',
        '§7ローラーモード中はスニークで低速移動モード',
    ],
    item: 'minecraft:iron_hoe',
    amount: 1,
    itemLock: (ItemLockMode.inventory),
});

// プレイヤーごとのローラーモード状態を管理するマップ
const playerRollerStates: Map<
    string,
    {
        isRollerMode: boolean;
        teamColorName: string;
        intervalId?: number;
        paintedLocations: { x: number; y: number; z: number }[]; // 塗った座標を記録
    }
> = new Map();

splatRollerItem.then((player: Player) => {
    const dimension = player.dimension;
    const paintManager = new PaintManager(dimension);

    // プレイヤーの状態をマップから取得、または初期化
    let playerState = playerRollerStates.get(player.id);
    if (!playerState) {
        playerState = {
            isRollerMode: false,
            teamColorName: 'white',
            paintedLocations: [], // 塗った座標のリストを初期化
        };
        playerRollerStates.set(player.id, playerState);
    }

    const playerState_dash = squidDashPlayerStates.get(player.id);
    if (playerState_dash && playerState_dash.isUsingSquidDash) {
        player.sendMessage('§cイカダッシュ中は使用できません！');
        return;
    }

    // プレイヤーのチームカラーを取得
    for (const tag in TEAM_COLORS) {
        if (player.hasTag(tag)) {
            playerState.teamColorName = TEAM_COLORS[tag];
            break;
        }
    }
    playerRollerStates.set(player.id, playerState);

    const startRollerMode = () => {
        playerState = playerRollerStates.get(player.id); // playerState を更新
        if (!playerState) return;
        playerState.isRollerMode = true;
        playerState.paintedLocations = []; // 塗った座標のリストをリセット
        playerRollerStates.set(player.id, playerState);
        //  player.sendMessage('§aローラーモード開始');

        // ローラーモード中はスニークで低速モードにするためのエフェクト付与
        system.run(() => {
            const slownessEffect = EffectTypes.get('slowness');
            if (slownessEffect) {
                player.addEffect(slownessEffect, 1200, {
                    amplifier: 3,
                    showParticles: false,
                });
            }
        });

        playerState.intervalId = system.runInterval(() => {
            playerState = playerRollerStates.get(player.id); // playerState を毎tick更新
            if (!playerState || !playerState.isRollerMode) {
                // ローラーモードが終了している場合はインターバルをクリア
                if (playerState?.intervalId) {
                    system.clearRun(playerState.intervalId);
                    playerState.intervalId = undefined;
                    playerRollerStates.set(player.id, playerState);
                }
                return;
            }

            // インク消費とモード終了判定
            if (player.level <= 0) {
                player.sendMessage('§cインク切れ！ローラーモードを終了します');
                stopRollerMode();
                return;
            }
            // インクレベルを減らす（0.25秒に1レベル減少）
            if (system.currentTick % 5 === 0) {
                player.addLevels(-2);
            }

            const currentLocation = player.location;
            const paintRadius = player.isSneaking ? 1 : 2; // スニーク中は範囲を狭く

            // ローラーの進行方向に塗る（プレイヤーの視線方向を考慮）
            const viewDirection = player.getViewDirection();
            const paintLocation = {
                x: currentLocation.x + viewDirection.x * paintRadius,
                y: currentLocation.y - 0.1,
                z: currentLocation.z + viewDirection.z * paintRadius,
            };
            const paintedX = Math.floor(paintLocation.x);
            const paintedY = Math.floor(paintLocation.y); // y座標を整数に調整
            const paintedZ = Math.floor(paintLocation.z);

            paintManager.paint(
                {
                    x: paintedX,
                    y: paintedY,
                    z: paintedZ,
                },
                playerState.teamColorName,
                paintRadius,
            );

            // 塗った座標を記録
            playerState.paintedLocations.push({ x: paintedX, y: paintedY, z: paintedZ });

            // 塗った座標にいるプレイヤーにダメージを与える
            for (const paintedLocation of playerState.paintedLocations) {
                const entities = dimension.getEntities({
                    location: paintedLocation,
                    maxDistance: 2, // 塗った場所の周囲1ブロック以内のエンティティを取得
                });

                if (entities) {
                    for (const entity of entities) {
                        if (entity.id !== player.id && entity.typeId === 'minecraft:player') {
                            let isEnemy = true;
                            for (const tag in TEAM_COLORS) {
                                if (player.hasTag(tag) && entity.hasTag(tag)) {
                                    isEnemy = false;
                                    break;
                                }
                            }

                            if (isEnemy) {
                                applyDamageToEntity(entity, 2, player, EntityDamageCause.entityAttack);
                                const hitSoundOptions: PlayerSoundOptions = {
                                    location: entity.location,
                                    volume: 0.5,
                                    pitch: 1.2,
                                };
                                playSoundForPlayer(player, 'random.orb', hitSoundOptions);
                            }
                        }
                    }
                }
            }
            // 古い塗った座標を削除（ここでは直近の10座標のみを保持）
            if (playerState.paintedLocations.length > 10) {
                playerState.paintedLocations.shift();
            }

        }, 1);
    };

    const stopRollerMode = () => {
        playerState = playerRollerStates.get(player.id); // playerState を更新
        if (!playerState) return;
        playerState.isRollerMode = false;
        playerState.paintedLocations = []; // 塗った座標のリストをリセット
        if (playerState.intervalId) {
            system.clearRun(playerState.intervalId);
            playerState.intervalId = undefined;
        }
        playerRollerStates.set(player.id, playerState);
        // player.sendMessage('§7ローラーモード終了');
        system.run(() => {
            player.removeEffect('slowness');
        });
    };

    // アイテム使用時の処理
    if (!playerState.isRollerMode) {
        // ローラーモードを開始
        startRollerMode();
    } else {
        // ローラーモードを終了
        stopRollerMode();
    }
});






// ----- アルティメット: スーパー着地 ----- //
const superLandingItem = new CustomItem({
    name: '§dアルティメット: スーパー着地',
    lore: [
        '§7その場でジャンプし、強力な着地攻撃！',
        '§7着地地点周辺を大きく塗りつぶし、敵に大ダメージ！',
        '§7使用時、50レベルのインクを消費',
        '§7発動中はノックバック無効',
    ],
    item: 'minecraft:nether_star',
    amount: 1,
    itemLock: (ItemLockMode.inventory),
});

// スーパー着地の状態を管理するマップ
const playerSuperLandingStates: Map<
    string,
    {
        isSuperLanding: boolean;
        teamColorName: string;
    }
> = new Map();

superLandingItem.then((player: Player) => {
    const dimension = player.dimension;
    const requiredInkLevel = 50;

    let playerState = playerSuperLandingStates.get(player.id);
    if (!playerState) {
        playerState = {
            isSuperLanding: false,
            teamColorName: 'white',
        };
        playerSuperLandingStates.set(player.id, playerState);
    }

    // 他の処理中は使用不能に
    const playerState_dash = squidDashPlayerStates.get(player.id);
    if (playerState_dash && playerState_dash.isUsingSquidDash) {
        player.sendMessage('§cイカダッシュ中は使用できません！');
        return;
    }
    if (playerState.isSuperLanding) {
        player.sendMessage('§cスーパー着地発動中は使用できません！');
        return;
    }
    let playerState_Roller = playerRollerStates.get(player.id);
    if (playerState_Roller && playerState_Roller.isRollerMode) {
        player.sendMessage('§cローラーモード中は使用できません！');
        return;
    }

    // インクレベルの確認
    if (player.level < requiredInkLevel) {
        player.sendMessage(`§cインクレベルが足りません！(最低 ${requiredInkLevel} 必要)`);
        return;
    }

    // チームカラーを取得
    playerState.teamColorName = getTeamColorName(player);

    // スーパー着地を開始
    playerState.isSuperLanding = true;
    playerSuperLandingStates.set(player.id, playerState);
    player.sendMessage('§dスーパー着地発動！');

    // インク消費
    system.run(() => {
        player.addLevels(-requiredInkLevel);
    });

    // 上昇と下降の処理
    const jumpHeight = 10; // 上昇の高さ（ブロック）
    const landingLocation = player.location; // 着地地点

    // ジャンプ時の効果音とパーティクル
    const jumpSoundOptions: PlayerSoundOptions = {
        location: player.location,
        volume: 1.0,
        pitch: 1.2,
    };
    playSoundForPlayer(player, 'component.jump_to_block', jumpSoundOptions); // ジャンプ音
    system.run(() => {
        dimension.spawnParticle('minecraft:breeze_wind_explosion_emitter', player.location); // ジャンプ時パーティクル

    })

    // 上昇中にノックバック無効を付与する関数 (上昇中のみエフェクト)
    const applyJumpEffects = (player: Player) => {
        system.run(() => {
            const resistanceEffect = EffectTypes.get('resistance');
            if (resistanceEffect) {
                player.addEffect(resistanceEffect, 120, {
                    amplifier: 255, // 最大レベル
                    showParticles: false,
                });
            }
        });
    };
    applyJumpEffects(player);

    // 上昇
    system.run(() => {
        player.applyKnockback(0, 0, 0, jumpHeight); // 上向きのノックバック
    });

    // 一定時間後に下降と効果の適用 (20 tick = 1秒)
    system.runTimeout(() => {
        //着地時に、効果無効削除
        system.run(() => {
            player.removeEffect('resistance');
        });
        executeSuperLanding(player, landingLocation, dimension, playerState.teamColorName);
    }, 20);
});

// スーパー着地を実行する関数
function executeSuperLanding(
    player: Player,
    landingLocation: Vector3,
    dimension: Dimension,
    teamColorName: string
) {
    const paintManager = new PaintManager(dimension);

    // 下降と着地処理
    const landingSpeed = -20; // 下降の速度（負の値で下向き）
    const explosionRadius = 8; // 爆発の半径（ブロック） 5 -> 8 に変更
    const damage = 50; // ダメージ量 30 -> 50 に変更

    // 下降
    system.run(() => {
        player.applyKnockback(0, 0, 0, landingSpeed); // 下向きのノックバック
    });

    // 着地時の効果とダメージ処理（少し遅らせる）
    system.runTimeout(() => {
        // 爆発範囲を塗る
        paintManager.paint(landingLocation, teamColorName, explosionRadius);

        // 爆発範囲内のエンティティにダメージを与える
        const entities = dimension.getEntities({
            location: landingLocation,
            maxDistance: explosionRadius,
        });
        for (const entity of entities) {
            if (entity.id !== player.id) {
                let isEnemy = true;
                for (const tag in TEAM_COLORS) {
                    if (player.hasTag(tag) && entity.hasTag(tag)) {
                        isEnemy = false;
                        break;
                    }
                }
                if (isEnemy) {
                    applyDamageToEntity(entity, damage, player, EntityDamageCause.entityExplosion);
                }
            }
        }

        // パーティクルとサウンド効果
        system.run(() => {
            dimension.spawnParticle(
                'minecraft:smash_ground_particle_center',
                { x: landingLocation.x, y: landingLocation.y, z: landingLocation.z }
            );
            dimension.spawnParticle('minecraft:basic_explosion_particle', landingLocation); // 爆発エフェクト
        })
        const soundOptions: PlayerSoundOptions = {
            location: landingLocation,
            volume: 1.0,
            pitch: 1.0,
        };
        playSoundForPlayer(player, 'mace.heavy_smash_ground', soundOptions); // 着地音
        system.runTimeout(() => {
            player.playSound('mace.heavy_smash_ground');
        }, 20);

        // スーパー着地の状態をリセット
        let playerState = playerSuperLandingStates.get(player.id);
        if (playerState) {
            playerState.isSuperLanding = false;
            playerSuperLandingStates.set(player.id, playerState);
        }
    }, 1); // 下降の速さに合わせて調整（例：下降に0.5秒かかるなら10）
}


// ----- アイテムの入手処理 ----- //
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === 'ch:weapon') {
        const player = event.sourceEntity;
        if (!player || !(player instanceof Player)) return;

        const message = event.message;
        const args = message.split(/\s+/);

        if (args.length >= 2 && args[0].toLowerCase() === 'give') {
            const itemName = args[1].toLowerCase();
            let amount = 1;

            if (args.length >= 3) {
                amount = parseInt(args[2]);
                if (isNaN(amount) || amount <= 0) {
                    player.sendMessage('§c個数は正の整数で指定してください');
                    return;
                }
            }

            try {
                switch (itemName) {
                    case 'splatshooter': // スプラシューターに変更
                        splatShooterItem.give(player, amount);
                        player.sendMessage(`§a${splatShooterItem.name} §7を ${amount} 個入手しました`);
                        break;
                    case 'squiddash':
                        squidDashItem.give(player, amount);
                        player.sendMessage(`§a${squidDashItem.name} §7を ${amount} 個入手しました`);
                        break;
                    case 'splatcharger':
                        splatChargerItem.give(player, amount);
                        player.sendMessage(`§a${splatChargerItem.name} §7を ${amount} 個入手しました`);
                        break;
                    case 'splatbomb':
                        splatBombItem.give(player, amount);
                        player.sendMessage(`§a${splatBombItem.name} §7を ${amount} 個入手しました`);
                        break;
                    case 'splatroller':
                        splatRollerItem.give(player, amount);
                        player.sendMessage(`§a${splatRollerItem.name} §7を ${amount} 個入手しました`);
                        break;
                    case 'superlanding':
                        superLandingItem.give(player, amount);
                        player.sendMessage(`§a${superLandingItem.name} §7を ${amount} 個入手しました`);
                        break;
                    default:
                        player.sendMessage(`§c不明なアイテム名: ${itemName}`);
                        break;
                }
            } catch (error) {
                console.error('Error in giving item:', error);
                player.sendMessage(`§cアイテムの付与中にエラーが発生しました`);
            }
        } else {
            player.sendMessage('§c無効なコマンドです。使用法: ch:weapon give <アイテム名> [個数]');
        }
    }
})