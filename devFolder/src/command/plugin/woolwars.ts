import {
    Player,
    ExplosionOptions,
    EntityProjectileComponent,
    system,
    Vector3,
    world,
    TeleportOptions,
    Entity,
    Dimension,
    EntityComponentTypes,
    EffectTypes,
    PlayerSoundOptions,
    EntityDamageCause,
    EntityQueryOptions,
} from "@minecraft/server";
import { CustomItem } from "../../Modules/customItem";

// ----- 定数 ----- //

// 羊の種類識別用タグ
const TAGS = {
    explosive: "explosive_sheep",
    rideable: "rideable_sheep",
    blackHole: "black_hole_sheep",
    earthquake: "earthquake_sheep",
    heal: "heal_sheep",
    orange: "orange_sheep",
    team1: "team1",
    team2: "team2",
};

// 羊の共通設定
const SHEEP_SETTINGS = {
    impulseMultiplier: 7,
    impulseMultiplierY: 2,
    gravity: 0.50,
};

// 爆発羊の設定
const EXPLOSIVE_SHEEP = {
    name: "§cExplosive Sheep",
    color: 14, // Red
    explosionRadius: 5, // 爆発範囲
    maxDamage: 25, // 最大ダメージ
    knockbackMultiplier: 1.5, // ノックバック倍率
    falloffFunction: (distance: number, radius: number) => (1 - distance / radius) ** 2, // ダメージ減衰関数(2次関数)
};

// 乗れる羊の設定
const RIDEABLE_SHEEP = {
    name: "§fRideable Sheep",
    color: 0, // White
    impulseMultiplier: 3,
    impulseMultiplierY: 2,
    maxRideDistance: 50,
};

// ブラックホール羊の設定
const BLACK_HOLE_SHEEP = {
    name: "§8Black Hole Sheep",
    color: 15, // Black
    duration: 5,
    strength: 5,
    range: 10,
    pullInterval: 40, // 2秒 = 40 ticks
    effectRange: 10,
};

// 地震羊の設定
const EARTHQUAKE_SHEEP = {
    name: "§6Earthquake Sheep",
    color: 12, // Brown
    effectRadius: 10,
    effectDuration: 5,
    effectInterval: 1,
    explosionDelay: 5,
    explosionRadius: 5,
};

// ヒール羊の設定
const HEAL_SHEEP = {
    name: "§aHeal Sheep",
    color: 5, // Lime
    effectRadius: 5,
    effectAmplifier: 0,
    lifeTime: 5,
};

// オレンジ羊の設定 (赤色羊の上位互換)
const ORANGE_SHEEP = {
    name: "§6Orange Sheep",
    color: 1, // Orange
    explosionRadius: 15, // 爆発範囲
    maxDamage: 1, // 最大ダメージ (かなり大きく)
    knockbackMultiplier: 2.5, // ノックバック倍率 (かなり大きく)
};

// カスタムアイテムの共通設定
const CUSTOM_ITEM_SETTINGS = {
    amount: 16,
};

// ----- 関数 ----- //

/**
 * 羊をスポーンさせる共通関数
 * @param player プレイヤー
 * @param tag 羊のタグ
 * @param nameTag 羊の名前
 * @param color 羊の色
 * @returns 生成された羊
 */
function spawnSheep(player: Player, tag: string, nameTag: string, color: number): Promise<Entity> {
    return new Promise((resolve, reject) => { // Promiseを返す (エラーハンドリング)
        try {
            const headLocation = player.getHeadLocation();
            const direction = player.getViewDirection();

            system.run(() => {
                try {
                    // 羊をスポーンさせる
                    const sheep = player.dimension.spawnEntity("minecraft:sheep", headLocation);

                    // 羊に推進力を与える
                    // ヒール羊の場合は推進力を与えない
                    if (tag !== TAGS.heal) {
                        sheep.applyImpulse({
                            x: direction.x * SHEEP_SETTINGS.impulseMultiplier,
                            y: direction.y * SHEEP_SETTINGS.impulseMultiplierY,
                            z: direction.z * SHEEP_SETTINGS.impulseMultiplier,
                        });
                    }

                    // 羊に名前と色を設定
                    sheep.nameTag = nameTag;
                    const colorComponent = sheep.getComponent(EntityComponentTypes.Color);
                    if (colorComponent) {
                        colorComponent.value = color;
                    }

                    // 発射物コンポーネントを追加
                    const projectileComponent = sheep.getComponent(EntityComponentTypes.Projectile) as EntityProjectileComponent;
                    if (projectileComponent) {
                        projectileComponent.gravity = SHEEP_SETTINGS.gravity;
                    }

                    // 羊にタグを追加
                    sheep.addTag(tag);

                    resolve(sheep);
                } catch (error) {
                    console.error("Error in system.run:", error);
                    reject(error);
                }
            });
        } catch (error) {
            console.error("Error in spawnSheep:", error);
            reject(error);
        }
    });
}

/**
 * 爆発する羊を発射する
 * @param player プレイヤー
 */
async function launchExplosiveSheep(player: Player): Promise<void> {
    try {
        // 羊をスポーンさせる
        const sheep = await spawnSheep(
            player,
            TAGS.explosive,
            EXPLOSIVE_SHEEP.name,
            EXPLOSIVE_SHEEP.color
        );
        if (!sheep) {
            console.error("Failed to spawn explosive sheep.");
            return;
        }

        // 羊が何かに当たったか定期的に確認
        let ticks = 0;
        const intervalId = system.runInterval(async () => {
            try {
                ticks++;

                // 羊が消えたか、移動していない（何かに当たったと推定）場合
                const velocity = sheep.getVelocity();
                const speed = Math.sqrt(
                    velocity.x * velocity.x +
                    velocity.y * velocity.y +
                    velocity.z * velocity.z
                );
                if (!sheep || !sheep.isValid() || (ticks > 5 && speed < 0.01)) {
                    let explosionLoc: Vector3;

                    // 羊が消えていなければ、その位置を爆発位置とする
                    if (sheep && sheep.isValid()) {
                        explosionLoc = sheep.location;

                        // 羊がブロックに埋まっている可能性があるため、少し上にずらす
                        explosionLoc.y += 0.5;

                        // 羊を削除
                        sheep.remove();
                    } else {
                        // 羊が消えていた場合、発射時の位置を爆発位置とする（不正確な可能性あり）
                        explosionLoc = player.getHeadLocation();
                    }

                    // 爆発を発生させる
                    createExplosion(
                        player.dimension,
                        explosionLoc,
                        EXPLOSIVE_SHEEP.explosionRadius,
                        player,
                        EXPLOSIVE_SHEEP.explosionRadius * 1.5,
                        EXPLOSIVE_SHEEP.knockbackMultiplier,
                        EXPLOSIVE_SHEEP.maxDamage,
                        EXPLOSIVE_SHEEP.falloffFunction
                    );

                    // インターバルをクリア
                    system.clearRun(intervalId);
                }
            } catch (error) {
                console.error("Error in explosive sheep interval:", error);
                system.clearRun(intervalId);
            }
        }, 1); // 1 tick ごとに確認
    } catch (error) {
        console.error("Error in launchExplosiveSheep:", error);
    }
}

/**
 * 乗れる羊を発射する
 * @param player プレイヤー
 */
async function launchRideableSheep(player: Player): Promise<void> {
    try {
        const headLocation = player.getHeadLocation();
        const direction = player.getViewDirection();
        // 羊をスポーンさせる (少し前に出す)
        const spawnLocation: Vector3 = {
            x: headLocation.x + direction.x * 1.5,
            y: headLocation.y,
            z: headLocation.z + direction.z * 1.5,
        };

        // 羊をスポーンさせる
        const sheep = await spawnSheep(
            player,
            TAGS.rideable,
            RIDEABLE_SHEEP.name,
            RIDEABLE_SHEEP.color
        );

        if (!sheep) {
            console.error("Failed to spawn rideable sheep.");
            return;
        }

        sheep.applyImpulse({
            x: direction.x * RIDEABLE_SHEEP.impulseMultiplier,
            y: direction.y * RIDEABLE_SHEEP.impulseMultiplierY,
            z: direction.z * RIDEABLE_SHEEP.impulseMultiplier,
        });

        // ブロックとの衝突をチェックするためのオプション
        const teleportOptions: TeleportOptions = {
            checkForBlocks: true,
        };

        // 飛距離を監視するための変数
        let startLocation = spawnLocation;
        let accumulatedDistance = 0;
        let isBlocked = false;

        // 羊を先にテレポートさせるためのインターバル
        const sheepTeleportInterval = system.runInterval(() => {
            try {
                if (!sheep || !sheep.isValid() || isBlocked) {
                    system.clearRun(sheepTeleportInterval);
                    return;
                }
                const sheepLocation = sheep.location;
                const velocity = sheep.getVelocity();
                const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);

                // 羊の移動距離を計算
                accumulatedDistance += distanceTo(sheepLocation, startLocation);
                startLocation = sheepLocation;

                // 飛距離が制限を超えた場合、または羊が停止した場合
                if (accumulatedDistance > RIDEABLE_SHEEP.maxRideDistance || speed < 0.1) {
                    isBlocked = true;
                    sheep.remove();
                    system.clearRun(sheepTeleportInterval);
                    if (playerTeleportInterval) {
                        system.clearRun(playerTeleportInterval);
                    }
                }
            } catch (error) {
                console.error("Error in rideable sheep teleport interval:", error);
                isBlocked = true;
                if (sheep && sheep.isValid()) {
                    sheep.remove();
                }
                system.clearRun(sheepTeleportInterval);
                if (playerTeleportInterval) {
                    system.clearRun(playerTeleportInterval);
                }
            }
        }, 1);

        // プレイヤーを羊の頭の位置にテレポートさせるインターバル
        const playerTeleportInterval = system.runInterval(() => {
            try {
                if (!sheep || !sheep.isValid() || isBlocked) {
                    system.clearRun(playerTeleportInterval);
                    return;
                }

                // 羊の頭の位置を取得 (少し上にずらす)
                const sheepHeadLocation = sheep.getHeadLocation();
                const teleportLocation = {
                    x: sheepHeadLocation.x,
                    y: sheepHeadLocation.y + 0.5,
                    z: sheepHeadLocation.z,
                };

                // 衝突をチェックしながらテレポート
                player.teleport(teleportLocation, teleportOptions);
            } catch (error) {
                console.error("Error in rideable sheep player teleport interval:", error);
                isBlocked = true;
                if (sheep && sheep.isValid()) {
                    sheep.remove();
                }
                system.clearRun(sheepTeleportInterval);
                system.clearRun(playerTeleportInterval);
            }
        }, 1);
    } catch (error) {
        console.error("Error in launchRideableSheep:", error);
    }
}

/**
 * ブラックホール羊を発射する
 * @param player プレイヤー
 */
async function launchBlackHoleSheep(player: Player): Promise<void> {
    try {
        // 羊をスポーンさせる
        const sheep = await spawnSheep(
            player,
            TAGS.blackHole,
            BLACK_HOLE_SHEEP.name,
            BLACK_HOLE_SHEEP.color
        );

        if (!sheep) {
            console.error("Failed to spawn black hole sheep.");
            return;
        }

        // 羊が停止したかを定期的に確認
        let ticks = 0;
        const intervalId = system.runInterval(() => {
            try {
                ticks++;

                const velocity = sheep.getVelocity();
                const speed = Math.sqrt(
                    velocity.x * velocity.x +
                    velocity.y * velocity.y +
                    velocity.z * velocity.z
                );
                const isStopped = speed < 0.05;
                // 羊が消えた、または、発射5ティック後から速度が0.05未満になった場合
                if (!sheep || !sheep.isValid() || (ticks > 5 && isStopped)) {
                    // インターバルをクリア
                    //停止
                    stopSheep(sheep, isStopped);
                    system.clearRun(intervalId);
                    let blackHoleIntervalId: number | undefined;
                    // 一定時間ごとに周囲のプレイヤーを吸い込む処理を開始
                    blackHoleIntervalId = system.runInterval(() => {
                        try {
                            if (sheep && sheep.isValid()) {
                                pullNearbyEntities(player, sheep, BLACK_HOLE_SHEEP.strength, BLACK_HOLE_SHEEP.range);
                            } else {
                                if (blackHoleIntervalId !== undefined) {
                                    system.clearRun(blackHoleIntervalId);
                                }
                            }
                        } catch (error) {
                            console.error("Error in black hole sheep pull interval:", error);
                            if (blackHoleIntervalId !== undefined) {
                                system.clearRun(blackHoleIntervalId);
                            }
                        }
                    }, BLACK_HOLE_SHEEP.pullInterval);

                    // 一定時間後に羊を削除
                    system.runTimeout(() => {
                        try {
                            system.clearRun(blackHoleIntervalId);
                            if (sheep && sheep.isValid()) {
                                sheep.remove();
                            }
                        } catch (error) {
                            console.error("Error in black hole sheep removal timeout:", error);
                        }
                    }, BLACK_HOLE_SHEEP.duration * 20);
                }
            } catch (error) {
                console.error("Error in black hole sheep interval:", error);
                system.clearRun(intervalId);
            }
        }, 1);
    } catch (error) {
        console.error("Error in launchBlackHoleSheep:", error);
    }
}

/**
 * 周囲のエンティティを吸い込む
 * @param shooter 羊を撃ったプレイヤー
 * @param sheep 羊
 * @param strength 吸い込む力
 * @param range 吸い込む範囲
 */
function pullNearbyEntities(
    shooter: Player,
    sheep: Entity,
    strength: number,
    range: number
): void {
    try {
        const sheepLocation = sheep.location;
        const players = world.getPlayers();
        for (const player of players) {
            try {
                // 撃ったプレイヤー自身、または異なるチームのプレイヤー以外は対象外
                if (
                    player.name === shooter.name ||
                    isSameTeam(shooter, player) // チーム判定を修正
                ) {
                    continue;
                }

                // 指定範囲内にいるか確認
                const distance = distanceTo(sheepLocation, player.location);
                if (distance > range) continue;

                pullEntity(player, sheep, strength);
            } catch (error) {
                console.error("Error in pullNearbyEntities for player:", player.name, error);
            }
        }
    } catch (error) {
        console.error("Error in pullNearbyEntities:", error);
    }
}

/**
 * エンティティを吸い込む共通処理 (一定の力で引き寄せるバージョン)
 * @param entity 吸い込まれるエンティティ
 * @param sheep 羊
 * @param strength 吸い込む力
 */
function pullEntity(entity: Entity, sheep: Entity, strength: number): void {
    try {
        const entityLocation = entity.location;
        const sheepLocation = sheep.location;

        const directionVector = {
            x: sheepLocation.x - entityLocation.x,
            y: sheepLocation.y - entityLocation.y,
            z: sheepLocation.z - entityLocation.z,
        };

        // ベクトルを正規化して方向のみを抽出
        const magnitude = Math.sqrt(
            directionVector.x * directionVector.x +
            directionVector.y * directionVector.y +
            directionVector.z * directionVector.z
        );
        const normalizedDirection = {
            x: directionVector.x / magnitude,
            y: directionVector.y / magnitude,
            z: directionVector.z / magnitude,
        };

        // 距離に関係なく一定の強さでノックバックを適用
        entity.applyKnockback(
            normalizedDirection.x,
            normalizedDirection.z,
            strength, // 距離で除算しない
            0.5
        );
    } catch (error) {
        console.error("Error in pullEntity:", error);
    }
}

/**
 * 地震羊を発射する
 * @param player プレイヤー
 */
async function launchEarthquakeSheep(player: Player): Promise<void> {
    try {
        // 羊をスポーンさせる
        const sheep = await spawnSheep(
            player,
            TAGS.earthquake,
            EARTHQUAKE_SHEEP.name,
            EARTHQUAKE_SHEEP.color
        );

        if (!sheep) {
            console.error("Failed to spawn earthquake sheep.");
            return;
        }

        // 羊が停止したかを定期的に確認
        let ticks = 0;
        let isHit = false;
        const intervalId = system.runInterval(() => {
            try {
                ticks++;

                // 羊が消えたか、移動していない（何かに当たったと推定）場合
                const velocity = sheep.getVelocity();
                const speed = Math.sqrt(
                    velocity.x * velocity.x +
                    velocity.y * velocity.y +
                    velocity.z * velocity.z
                );

                if (!sheep || !sheep.isValid() || (ticks > 5 && speed < 0.05)) {
                    isHit = true;
                }

                if (isHit) {
                    system.clearRun(intervalId);

                    if (!sheep || !sheep.isValid()) return;

                    const earthquakeLocation = sheep.location;
                    earthquakeLocation.y += 0.5; // 羊を少し上に移動させる

                    // 羊をその場に固定
                    sheep.teleport(earthquakeLocation, {
                        facingLocation: earthquakeLocation, // 移動しないように向いている方向を固定
                        keepVelocity: false,
                    });

                    system.runTimeout(() => {
                        try {
                            if (!sheep || !sheep.isValid()) return;
                            const players = player.dimension.getPlayers();
                            for (const p of players) {
                                const distance = distanceTo(earthquakeLocation, p.location);
                                if (p.name !== player.name && distance <= EARTHQUAKE_SHEEP.effectRadius) {
                                    p.sendMessage(`§6今すぐ離れてください地震が発生します!!`);
                                }
                            }
                        } catch (error) {
                            console.error("Error in earthquake sheep message timeout:", error);
                        }
                    }, 20);

                    // 地震エフェクト開始時間まで待機
                    system.runTimeout(() => {
                        try {
                            if (!sheep || !sheep.isValid()) return;
                            // 羊を消す
                            sheep.remove();

                            // 地震エフェクトを開始
                            startEarthquakeEffect(player.dimension, earthquakeLocation, player);

                            // 地震効果開始時に近くのプレイヤーに影響を与える
                            const players = player.dimension.getPlayers();
                            for (const p of players) {
                                const distance = distanceTo(earthquakeLocation, p.location);
                                if (p.name !== player.name && distance <= EARTHQUAKE_SHEEP.effectRadius) {
                                    p.addEffect("slowness", EARTHQUAKE_SHEEP.effectDuration * 20, {
                                        amplifier: 5,
                                        showParticles: true,
                                    });
                                    p.sendMessage("§c地震の影響を受けてしまいました");
                                }
                            }
                        } catch (error) {
                            console.error("Error in earthquake sheep effect timeout:", error);
                        }
                    }, EARTHQUAKE_SHEEP.explosionDelay * 20);
                }
            } catch (error) {
                console.error("Error in earthquake sheep interval:", error);
                system.clearRun(intervalId);
            }
        }, 1);
    } catch (error) {
        console.error("Error in launchEarthquakeSheep:", error);
    }
}

/**
 * 地震エフェクトを開始する
 * @param dimension 爆発が起きるディメンション
 * @param location 爆発が起きる座標
 * @param player 羊を撃ったプレイヤー
 */
function startEarthquakeEffect(dimension: Dimension, location: Vector3, player: Player): void {
    try {
        const duration = (EARTHQUAKE_SHEEP.effectDuration - EARTHQUAKE_SHEEP.explosionDelay) * 20;
        const interval = EARTHQUAKE_SHEEP.effectInterval * 20;
        let remainingDuration = duration;
        // 地震効果を定期的に実行
        const earthquakeInterval = system.runInterval(() => {
            try {
                remainingDuration -= interval;

                createExplosion(dimension, location, EARTHQUAKE_SHEEP.explosionRadius, player);

                // 持続時間が切れたらインターバルをクリア
                if (remainingDuration <= 0) {
                    system.clearRun(earthquakeInterval);
                }
            } catch (error) {
                console.error("Error in earthquake effect interval:", error);
                system.clearRun(earthquakeInterval);
            }
        }, interval);
    } catch (error) {
        console.error("Error in startEarthquakeEffect:", error);
    }
}

/**
 * ヒール羊を発射する
 * @param player プレイヤー
 */
async function launchHealSheep(player: Player): Promise<void> {
    try {
        const headLocation = player.getHeadLocation();
        const sheep = await spawnSheep(player, TAGS.heal, HEAL_SHEEP.name, HEAL_SHEEP.color);
        if (!sheep) {
            console.error("Failed to spawn heal sheep.");
            return;
        }

        sheep.teleport(headLocation, {
            facingLocation: headLocation,
            keepVelocity: false,
        });
        //停止
        system.runTimeout(() => {
            try {
                stopSheep(sheep, true);
            } catch (error) {
                console.error("Error in heal sheep stop timeout:", error);
            }
        }, 20 * 3);

        // リストを使い、効果を受けたプレイヤーを管理し重複付与を回避する
        const healedPlayers: string[] = [];

        // 周囲のプレイヤーを回復する間隔 (1tickごとに実行)
        const healInterval = system.runInterval(() => {
            try {
                if (!sheep || !sheep.isValid()) {
                    system.clearRun(healInterval);
                    return;
                }
                healNearbyPlayers(sheep, HEAL_SHEEP.effectRadius, healedPlayers);

                // 効果範囲外に出たプレイヤーをリストから削除し、効果を消す
                for (let i = healedPlayers.length - 1; i >= 0; i--) {
                    const playerName = healedPlayers[i];
                    const player = world.getPlayers({ name: playerName })[0];

                    if (!player || distanceTo(sheep.location, player.location) > HEAL_SHEEP.effectRadius) {
                        healedPlayers.splice(i, 1);
                        player?.removeEffect(EffectTypes.get("regeneration")!);
                        player?.removeEffect(EffectTypes.get("saturation")!);
                    }
                }
            } catch (error) {
                console.error("Error in heal sheep interval:", error);
                system.clearRun(healInterval);
            }
        }, 1);

        // 一定時間後に羊を削除
        system.runTimeout(() => {
            try {
                system.clearRun(healInterval);
                if (sheep && sheep.isValid()) {
                    sheep.remove();
                }
            } catch (error) {
                console.error("Error in heal sheep removal timeout:", error);
            }
        }, HEAL_SHEEP.lifeTime * 20);
    } catch (error) {
        console.error("Error in launchHealSheep:", error);
    }
}

/**
 * 周囲のプレイヤーを回復する
 * @param sheep 羊
 * @param radius 回復範囲
 * @param healedPlayers 効果を適用したプレイヤーのリスト
 */
function healNearbyPlayers(sheep: Entity, radius: number, healedPlayers: string[]): void {
    try {
        const sheepLocation = sheep.location;
        const players = world.getPlayers();
        for (const player of players) {
            try {
                const distance = distanceTo(sheepLocation, player.location);

                // 効果範囲内にいて、まだ効果を受けていないプレイヤーに効果を適用
                if (distance <= radius && !healedPlayers.includes(player.name)) {
                    player.addEffect(EffectTypes.get("regeneration")!, 80, {
                        amplifier: HEAL_SHEEP.effectAmplifier,
                        showParticles: true,
                    });
                    player.addEffect(EffectTypes.get("saturation")!, 80, {
                        amplifier: HEAL_SHEEP.effectAmplifier,
                        showParticles: true,
                    });
                    healedPlayers.push(player.name);
                }
            } catch (error) {
                console.error("Error in healNearbyPlayers for player:", player.name, error);
            }
        }
    } catch (error) {
        console.error("Error in healNearbyPlayers:", error);
    }
}

/**
 * 爆発を発生させ、プレイヤーにノックバックとダメージを与える共通関数
 * @param dimension 爆発を発生させるディメンション
 * @param location 爆発の座標
 * @param radius 爆発の半径
 * @param source 爆発の発生源（オプション）
 * @param knockbackRadius ノックバックの影響範囲（オプション、デフォルトは爆発半径と同じ）
 * @param knockbackMultiplier ノックバックの強さの倍率（オプション、デフォルトは1.0）
 * @param damagePerDistance 爆発地点からの距離に応じたダメージ量 (1メートルあたりのダメージ) (オプション、デフォルトは5)
 */
function createExplosion(
    dimension: Dimension,
    location: Vector3,
    radius: number,
    source?: Entity,
    knockbackRadius: number = radius,
    knockbackMultiplier: number = 1.0,
    maxDamage: number = 20,
    falloffFunction: (distance: number, radius: number) => number = (distance, radius) => 1 - distance / radius
): void {
    const minX = -30000000;
    const maxX = 30000000;
    const minY = -64;
    const maxY = 320;
    const minZ = -30000000;
    const maxZ = 30000000;

    if (
        location.x >= minX &&
        location.x <= maxX &&
        location.y >= minY &&
        location.y <= maxY &&
        location.z >= minZ &&
        location.z <= maxZ
    ) {
        try {
            const explosionOptions: ExplosionOptions = {
                breaksBlocks: true,
                causesFire: false,
                allowUnderwater: true,
                source: source,
            };
            dimension.createExplosion(location, radius, explosionOptions);

            // 爆発地点周辺のプレイヤーを取得
            const players = dimension.getPlayers({
                location: location,
                maxDistance: knockbackRadius,
            });

            for (const player of players) {
                // プレイヤーと爆発地点との距離を計算
                const distance = Math.sqrt(
                    (player.location.x - location.x) ** 2 +
                    (player.location.y - location.y) ** 2 +
                    (player.location.z - location.z) ** 2
                );

                // 距離に基づいてノックバックの強さを調整
                const knockbackStrength =
                    (1 - distance / knockbackRadius) * knockbackMultiplier;

                // プレイヤーの方向ベクトルを計算（爆発地点からプレイヤーへの方向）
                const direction: Vector3 = {
                    x: player.location.x - location.x,
                    y: player.location.y - location.y,
                    z: player.location.z - location.z,
                };

                // ベクトルを正規化して、方向にのみ依存するようにする
                const magnitude = Math.sqrt(
                    direction.x ** 2 + direction.y ** 2 + direction.z ** 2
                );
                if (magnitude !== 0) {
                    direction.x /= magnitude;
                    direction.y /= magnitude;
                    direction.z /= magnitude;
                }

                // ノックバックを適用
                player.applyKnockback(
                    direction.x,
                    direction.z,
                    knockbackStrength * 5, // ノックバックの水平方向の強さ
                    0.5 // ノックバックの垂直方向の強さ(固定値)
                );

                // ダメージを計算 (減衰関数を適用)
                const damage = Math.max(0, maxDamage * falloffFunction(distance, radius));

                // ダメージを与える
                if (damage > 0) {
                    player.applyDamage(damage, {
                        cause: EntityDamageCause.entityExplosion,
                        damagingEntity: source,
                    });
                }
            }
        } catch (error) {
            console.error("Error in createExplosion:", error);
        }
    }
}

/**
 * 2つのプレイヤーが同じチームかどうかを判定する
 * @param player1 プレイヤー1
 * @param player2 プレイヤー2
 * @returns 同じチームならtrue、そうでなければfalse
 */
function isSameTeam(player1: Player, player2: Player): boolean {
    try {
        return (
            (player1.hasTag(TAGS.team1) && player2.hasTag(TAGS.team1)) ||
            (player1.hasTag(TAGS.team2) && player2.hasTag(TAGS.team2))
        );
    } catch (error) {
        console.error("Error in isSameTeam:", error);
        return false; // エラーが発生した場合はfalseを返す
    }
}

/**
 * 羊の動きを止める/再開する関数
 * @param sheep 対象の羊
 * @param stop true: 停止, false: 再開
 */
function stopSheep(sheep: Entity, stop: boolean): void {
    try {
        if (stop) {
            // 羊を停止させる (テレポートを繰り返して位置を固定)
            system.runInterval(() => {
                try {
                    if (!sheep || !sheep.isValid()) return;
                    sheep.addTag("ch:stopped");

                    const sheepLocation = sheep.location;
                    sheep.teleport(sheepLocation, {
                        facingLocation: sheepLocation,
                        keepVelocity: false,
                    });
                } catch (error) {
                    console.error("Error in stopSheep interval:", error);
                }
            }, 1); // 1 tick ごとに実行

        } else {
            if (!sheep || !sheep.isValid()) return;
            sheep.removeTag("ch:stopped");
            sheep.remove();
        }
    } catch (error) {
        console.error("Error in stopSheep:", error);
    }
}

/**
 * 2点間の距離を計算する
 * @param v1 座標1
 * @param v2 座標2
 * @returns 距離
 */
function distanceTo(v1: Vector3, v2: Vector3): number {
    try {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const dz = v2.z - v1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    } catch (error) {
        console.error("Error in distanceTo:", error);
        return 0; // エラーが発生した場合は0を返す
    }
}

/**
 * オレンジ羊を発射する
 * @param player プレイヤー
 */
async function launchOrangeSheep(player: Player): Promise<void> {
    try {
        // 羊をスポーンさせる
        const sheep = await spawnSheep(
            player,
            TAGS.orange,
            ORANGE_SHEEP.name,
            ORANGE_SHEEP.color
        );

        if (!sheep) {
            console.error("Failed to spawn orange sheep.");
            return;
        }

        // 羊が何かに当たったか定期的に確認
        let ticks = 0;
        const intervalId = system.runInterval(async () => {
            try {
                ticks++;

                // 羊が消えたか、移動していない（何かに当たったと推定）場合
                const velocity = sheep.getVelocity();
                const speed = Math.sqrt(
                    velocity.x * velocity.x +
                    velocity.y * velocity.y +
                    velocity.z * velocity.z
                );
                if (!sheep || !sheep.isValid() || (ticks > 5 && speed < 0.01)) {
                    let explosionLoc: Vector3;

                    // 羊が消えていなければ、その位置を爆発位置とする
                    if (sheep && sheep.isValid()) {
                        explosionLoc = sheep.location;

                        // 羊がブロックに埋まっている可能性があるため、少し上にずらす
                        explosionLoc.y += 0.5;

                        // 羊を削除
                        sheep.remove();
                    } else {
                        // 羊が消えていた場合、発射時の位置を爆発位置とする（不正確な可能性あり）
                        explosionLoc = player.getHeadLocation();
                    }

                    // 爆発を発生させる (半径を大きくする)
                    createExplosion(
                        player.dimension,
                        explosionLoc,
                        ORANGE_SHEEP.explosionRadius,
                        player,
                        ORANGE_SHEEP.explosionRadius * 1.2,
                        ORANGE_SHEEP.knockbackMultiplier,
                        ORANGE_SHEEP.maxDamage,
                    );

                    // インターバルをクリア
                    system.clearRun(intervalId);
                }
            } catch (error) {
                console.error("Error in orange sheep interval:", error);
                system.clearRun(intervalId);
            }
        }, 1);
    } catch (error) {
        console.error("Error in launchOrangeSheep:", error);
    }
}



// ----- カスタムアイテム ----- //

const explosiveRedWool = new CustomItem({
    ...CUSTOM_ITEM_SETTINGS,
    name: "§c爆弾羊",
    lore: ["§7投げた場所に羊をスポーンさせ、", "§7着地、または何かに当たると爆発する", `§7爆発範囲: §a${EXPLOSIVE_SHEEP.explosionRadius}`],
    item: "minecraft:red_wool",
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    launchExplosiveSheep(player);

});

const rideableWhiteWool = new CustomItem({
    ...CUSTOM_ITEM_SETTINGS,
    name: "§f移動羊",
    lore: ["§7投げた場所に羊をスポーンさせ、", "§7羊の上に乗って移動することができる", `§7最大飛距離: §a${RIDEABLE_SHEEP.maxRideDistance}`],
    item: "minecraft:white_wool",
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    launchRideableSheep(player);
});

const blackHoleWool = new CustomItem({
    ...CUSTOM_ITEM_SETTINGS,
    name: "§8ブラックホール羊",
    lore: ["§7投げた場所に羊をスポーンさせ、", "§7着地すると周囲のプレイヤーを引き寄せる", `§7効果範囲: §a${BLACK_HOLE_SHEEP.range}`, `§7効果時間: §a${BLACK_HOLE_SHEEP.duration}秒`, `§7誘引間隔: §a${BLACK_HOLE_SHEEP.pullInterval / 20}秒`, "§7(敵チームにのみ効果あり)"],
    item: "minecraft:black_wool",
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    launchBlackHoleSheep(player);
});

const earthquakeBrownWool = new CustomItem({
    ...CUSTOM_ITEM_SETTINGS,
    name: "§6地震羊",
    lore: [
        "§7投げた場所に羊をスポーンさせ、",
        "§7羊が着地すると地震が発生する",
        `§7効果範囲: §a${EARTHQUAKE_SHEEP.effectRadius}`,
        `§7効果: §c低速V§7、5秒間`,
        `§7地震発生までの時間: §a${EARTHQUAKE_SHEEP.explosionDelay}秒`,
        `§7爆発間隔: §a${EARTHQUAKE_SHEEP.effectInterval}秒`,
        "§7(敵チームにのみ効果あり)"
    ],
    item: "minecraft:brown_wool",
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    launchEarthquakeSheep(player);
});

// ヒール羊のカスタムアイテム
const healLimeWool = new CustomItem({
    ...CUSTOM_ITEM_SETTINGS,
    name: "§aヒール羊",
    lore: [
        "§7使用した場所に羊をスポーンさせ",
        `§7範囲内にいるプレイヤーを回復する`,
        `§7回復効果: §a再生能力`,
        `§7効果時間:4秒`,
        `§7範囲: §a${HEAL_SHEEP.effectRadius}`,
        `§7持続時間: §a${HEAL_SHEEP.lifeTime}秒`,
    ],
    item: "minecraft:lime_wool",
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    launchHealSheep(player);
});

// オレンジ羊のカスタムアイテム
const explosiveOrangeWool = new CustomItem({
    ...CUSTOM_ITEM_SETTINGS,
    name: "§6超爆発羊",
    lore: ["§7投げた場所に羊をスポーンさせ、", "§7着地、または何かに当たると大爆発する", "§c爆弾羊の上位互換", `§7爆発範囲: §a${ORANGE_SHEEP.explosionRadius}`],
    item: "minecraft:orange_wool",
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    launchOrangeSheep(player);

});

// 木の剣のカスタムアイテム (y座標が-64以下でのみ有効)
const upBlowWoodenSword = new CustomItem({
    name: "§bアッパーソード",
    lore: ["§7使用すると上方向に吹き飛ばされる"],
    item: "minecraft:wooden_sword",
}).then((player: Player) => {
    system.run(() => {
        // プレイヤーの座標を取得
        const playerLocation = player.location;

        if (playerLocation.y <= -40) {
            player.applyKnockback(0, 0, 0, 3);

            // サウンドを再生 (複数のサウンドを組み合わせ、ディレイで立体感を出す)
            const mainSoundOptions: PlayerSoundOptions = {
                volume: 1.0,
                pitch: 1.0,
            };

            const subSoundOptions: PlayerSoundOptions = {
                volume: 0.6,
                pitch: 1.2, // 少し高めにして変化をつける
            };

            // メインのサウンド (例: 突風のような音)
            player.playSound("strong_wind", mainSoundOptions);

            system.runTimeout(() => {
                player.playSound("ambient.cave", subSoundOptions);
                //3ティック目に
            }, 3);
            upBlowWoodenSword.removeItem(player, upBlowWoodenSword.get())
        } else {
            // y座標が-64より高い場合は、メッセージを表示 (オプション)
            player.sendMessage("§cこの高さではアッパーソードは使用できません！");
        }
    });
});


const boostFeather = new CustomItem({
    name: "§bHiveの羽",
    lore: ["§7使用すると前方向にダッシュし", "§7一時的に移動速度が上昇する"],
    item: "minecraft:feather",
    amount: 1,
    remove: true,
}).then((player: Player) => {

    system.run(() => {
        const direction = player.getViewDirection();

        // 前方向への力を適用 (水平方向の力を強化)
        player.applyKnockback(direction.x, direction.z, 7, 0.6); // 水平方向4、垂直方向0.6

        // 移動速度上昇のエフェクトを付与 (3秒間)
        player.addEffect(EffectTypes.get("speed")!, 60, {
            amplifier: 2,
            showParticles: false
        });

        // サウンドを再生 (複数のサウンドを組み合わせ、ディレイで臨場感を出す)
        const mainSoundOptions: PlayerSoundOptions = {
            volume: 1.0,
            pitch: 1.0,
        };

        const subSoundOptions: PlayerSoundOptions = {
            volume: 0.7,
            pitch: 1.2, // 少し高めにして変化をつける
        };
        const subSoundOptions2: PlayerSoundOptions = {
            volume: 0.4,
            pitch: 0.9, // 少し低めにして変化をつける
        };

        // メインのサウンド (例: 馬のジャンプ音)
        player.playSound("mob.horse.jump", mainSoundOptions);

        system.runTimeout(() => {
            player.playSound("mob.blaze.shoot", subSoundOptions); // 例: ブレイズの発射音
        }, 3); // 3 tick 後 (0.15秒) に再生

        system.runTimeout(() => {
            player.playSound("elytra.loop", subSoundOptions2);
        }, 5);

        system.runTimeout(() => {
            player.playSound("mob.blaze.breathe", subSoundOptions2);
        }, 7);

    })
});




const barrierItem = new CustomItem({
    name: "§bバリア展開",
    lore: ["§7使用するとバリアを展開し", "§7周囲のエンティティを吹き飛ばす"],
    item: "minecraft:barrier", // バリアブロックのアイテムを使用
    amount: 1,
    placeableOn: ["minecraft:allow"],
    remove: true,
}).then((player: Player) => {
    system.run(() => {
        const location = player.location;
        const dimension = player.dimension;
        const radius = 4;

        // 世界の境界
        const minX = -30000000;
        const maxX = 30000000;
        const minY = -64; // Bedrock Edition の場合。Java Edition は -2048
        const maxY = 320;
        const minZ = -30000000;
        const maxZ = 30000000;

        // プレイヤーが境界の外にいるか確認
        if (
            location.x < minX ||
            location.x > maxX ||
            location.y < minY ||
            location.y > maxY ||
            location.z < minZ ||
            location.z > maxZ
        ) {
            // 境界外の場合は使用できないメッセージを表示して処理を終了
            player.sendMessage("§c[警告] 境界の外では使用できません！");
            return;
        }

        // 使用者のタグを確認
        const userTags = player.getTags();
        const isRedTeam = userTags.includes("red");
        const isBlueTeam = userTags.includes("blue");

        // バリア展開のエフェクト (パーティクル)
        dimension.spawnParticle("minecraft:breeze_wind_explosion_emitter", {
            x: player.location.x,
            y: player.location.y + 1,
            z: player.location.z,
        });

        // サウンドを再生
        player.playSound("random.explode", { volume: 0.5, pitch: 1.2 });
        player.playSound("mob.guardian.curse", { volume: 1, pitch: 0.8 });
        system.runTimeout(() => {
            player.playSound("mob.warden.sonic_boom", { volume: 1, pitch: 1 });
        }, 1);

        // 周囲のエンティティを検索
        const options: EntityQueryOptions = {
            location: location,
            maxDistance: radius,
            excludeNames: [player.name],
        };

        const nearbyEntities = Array.from(dimension.getEntities(options));

        // 近くのプレイヤーやエンティティを吹き飛ばす
        for (const entity of nearbyEntities) {
            // エンティティがプレイヤーかどうか確認
            if (entity.typeId === "minecraft:player") {
                const targetPlayer = entity as Player;
                const targetTags = targetPlayer.getTags();

                // 同じチームのプレイヤーには効果を適用しない
                if (
                    (isRedTeam && targetTags.includes("red")) ||
                    (isBlueTeam && targetTags.includes("blue"))
                ) {
                    continue; // 次のエンティティへ
                }

                // 継続ダメージを与える (4秒間、2秒ごとにダメージ)
                let damageTicks = 0;
                const damageInterval = system.runInterval(() => {
                    if (damageTicks < 10) {
                        targetPlayer.applyDamage(2, { // 2のダメージ (ハート1個分)
                            cause: EntityDamageCause.contact,
                            damagingEntity: player,
                        });
                        damageTicks += 1;
                    } else {
                        system.clearRun(damageInterval);
                    }
                }, 20);

            }

            const direction = {
                x: entity.location.x - location.x,
                y: entity.location.y - location.y,
                z: entity.location.z - location.z,
            };

            // ベクトルを正規化
            const length = Math.sqrt(
                direction.x ** 2 + direction.y ** 2 + direction.z ** 2
            );
            const normalizedDirection = {
                x: direction.x / length,
                y: direction.y / length,
                z: direction.z / length,
            };

            if (entity.typeId === "minecraft:player") {
                // プレイヤーにはノックバックを適用
                const player = entity as Player;
                player.applyKnockback(
                    normalizedDirection.x,
                    normalizedDirection.z,
                    10, // 水平方向の強さ
                    0.5 // 垂直方向の強さ
                );

                // 鈍化のステータスを付与
                player.addEffect(EffectTypes.get("slowness")!, 60, {
                    amplifier: 6, // レベル III
                    showParticles: false,
                });

                // 吹き飛ばされたプレイヤーにメッセージとサウンドを送信
                player.sendMessage("§cバリアによって吹き飛ばされました！");
                player.sendMessage("§6現在継続ダメージを食らっています！！");
                player.playSound("mob.warden.sonic_boom", { volume: 1, pitch: 1 });
            } else {
                // プレイヤー以外のエンティティにはインパルスを適用
                const impulseVector: Vector3 = {
                    x: normalizedDirection.x * 2, // 水平方向の強さを調整
                    y: 0.5, // 垂直方向の強さを調整 (浮かせたい場合は適宜変更)
                    z: normalizedDirection.z * 2, // 水平方向の強さを調整
                };
                entity.applyImpulse(impulseVector);
            }
        }
    });
});




// ----- イベント ----- //



system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "team:init") {
        const player = event.sourceEntity;
        if (!player || !(player instanceof Player)) return;
        try {
            // team1 または team2 タグを持つプレイヤーにのみアイテムを付与
            if (player.hasTag(TAGS.team1) || player.hasTag(TAGS.team2)) {
                explosiveRedWool.give(player);
                rideableWhiteWool.give(player);
                blackHoleWool.give(player);
                earthquakeBrownWool.give(player);
                healLimeWool.give(player);
                explosiveOrangeWool.give(player);
            }
        } catch (error) {
            console.error("Error in scriptEventReceive:", error);
        }
    } else if (event.id === "ch:wool") {
        const player = event.sourceEntity;
        if (!player || !(player instanceof Player)) return;

        const message = event.message;
        const args = message.split(/\s+/);

        if (args.length >= 2 && args[0].toLowerCase() === "give") {
            const itemName = args[1].toLowerCase();
            let amount = 1; // デフォルトの個数は1

            // 個数が指定されている場合、それを取得
            if (args.length >= 3) {
                amount = parseInt(args[2]);
                if (isNaN(amount) || amount <= 0) {
                    player.sendMessage("§c個数は正の整数で指定してください");
                    return;
                }
            }

            try {
                switch (itemName) {
                    //ここにアイテムのやつ
                    case "explosive":
                        explosiveRedWool.give(player, amount);
                        player.sendMessage(`§a${explosiveRedWool.name} §7を ${amount} 個入手しました`);
                        break;
                    case "rideable":
                        rideableWhiteWool.give(player, amount);
                        player.sendMessage(`§a${rideableWhiteWool.name} §7を ${amount} 個入手しました`);
                        break;
                    case "blackhole":
                        blackHoleWool.give(player, amount);
                        player.sendMessage(`§a${blackHoleWool.name} §7を ${amount} 個入手しました`);
                        break;
                    case "earthquake":
                        earthquakeBrownWool.give(player, amount);
                        player.sendMessage(`§a${earthquakeBrownWool.name} §7を ${amount} 個入手しました`);
                        break;
                    case "heal":
                        healLimeWool.give(player, amount);
                        player.sendMessage(`§a${healLimeWool.name} §7を ${amount} 個入手しました`);
                        break;
                    case "orange":
                        explosiveOrangeWool.give(player, amount);
                        player.sendMessage(`§a${explosiveOrangeWool.name} §7を ${amount} 個入手しました`);
                        break;

                    case "upblow":
                        upBlowWoodenSword.give(player, amount);
                        player.sendMessage(`§a${upBlowWoodenSword.name} §7を ${amount} 個入手しました`);
                        break;
                    case "boost":
                        //boostFeatherはHiveの羽
                        boostFeather.give(player, amount);
                        player.sendMessage(`§a${boostFeather.name} §7を ${amount} 個入手しました`);
                        break;
                    case "barrier":
                        barrierItem.give(player, amount);
                        player.sendMessage(`§a${barrierItem.name} §7を ${amount} 個入手しました`);
                        break;
                    default:
                        player.sendMessage(`§c不明なアイテム名: ${itemName}`);
                        break;
                }
            } catch (error) {
                console.error("Error in giving wool item:", error);
                player.sendMessage(`§cアイテムの付与中にエラーが発生しました`);
            }
        } else {
            player.sendMessage("§c無効なコマンドです。使用法: ch:wool give <アイテム名> [個数]");
        }
    }

    if (event.id === "ch:custom") {
        const player = event.sourceEntity;
        if (!player || !(player instanceof Player)) return;

        const message = event.message;
        const args = message.split(";"); // ; 区切りに変更

        if (args.length < 5) {
            player.sendMessage("§c使用法: ch:custom <アイテム名>;<説明文>;<アイテムタイプ>;<個数>;<実行するコード>");
            player.sendMessage("§c例: ch:custom §bTestSword;§7This is a test,§7and another line;diamond_sword;1;console.warn('Sword used!');");
            return;
        }

        try {
            const name = args[0];
            const lore = args[1].split(",").map((line: string) => line.trim()); // 各行の先頭と末尾のスペースを削除
            const item = args[2];
            const amount = parseInt(args[3]);
            const code = args[4];

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage("§c個数は正の整数で指定してください");
                return;
            }

            const customItem = new CustomItem({ name, lore, item, amount }).then((p: Player) => {
                try {
                    eval(code);
                } catch (error) {
                    console.error("Error in executing custom item code:", error);
                    p.sendMessage("§cアイテム使用時のコード実行中にエラーが発生しました");
                }
            });

            customItem.give(player);
            player.sendMessage(`§a${name} §7を ${amount} 個入手しました`);
        } catch (error) {
            console.error("Error in ch:custom command:", error);
            player.sendMessage("§cカスタムアイテムの作成中にエラーが発生しました");
        }
    }
});