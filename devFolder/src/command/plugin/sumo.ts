import { Player, system, Vector3, world } from "@minecraft/server";
import { config } from "../../Modules/Util";
import { translate } from "../langs/list/LanguageManager";

// Sumo タグのプレフィックスと Sumo システム起動用のタグ
const sumoTagPrefix = "sumo";
const pvpSumoTag = "pvpSumo";
const trueSumoTag = "trueSumo";
const maxSumoMatches = 5;

let sumoSystemEnabled = false;
let sumoTagsInUse: string[] = [];

function calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Sumo プレイヤーの距離を監視する関数
function checkSumoDistance() {
    world.getPlayers().forEach((player) => {
        const sumoTag = getSumoTag(player);
        if (sumoTag) {
            const opponent = world.getPlayers().find(p => p.hasTag(sumoTag) && p.name !== player.name);
            if (opponent) {
                const distance = calculateDistance(player.location, opponent.location);
                if (distance > 15) {
                    player.sendMessage(translate(player, "command.sumo.15block"));
                    opponent.sendMessage(translate(opponent, "command.sumo.15block"))
                    removeSumoTags(player, opponent, sumoTag);
                }
            }
        }
    });
}

// Sumo タグを取得する関数
function getSumoTag(player: Player): string | null {
    for (let i = 1; i <= maxSumoMatches; i++) {
        const tag = `${sumoTagPrefix}${i}`;
        if (player.hasTag(tag)) {
            return tag;
        }
    }
    return null;
}

function removeSumoTags(player1: Player, player2: Player, sumoTag: string) {
    player1.removeTag(sumoTag);
    player2.removeTag(sumoTag);
    const index = sumoTagsInUse.indexOf(sumoTag);
    if (index > -1) {
        sumoTagsInUse.splice(index, 1);
    }
    checkSystemStatus();
}


// Sumo 開始処理
world.afterEvents.entityHitEntity.subscribe((event) => {
    if (config().module.sumoSystem.enabled === false) return;
    if (!sumoSystemEnabled) return;

    const { damagingEntity, hitEntity } = event;

    if (
        damagingEntity &&
        damagingEntity.typeId === "minecraft:player" &&
        hitEntity &&
        hitEntity.typeId === "minecraft:player"
    ) {
        const attackingPlayer = damagingEntity as Player;
        const hitPlayer = hitEntity as Player;

        const attackerTag = getSumoTag(attackingPlayer);
        const hitPlayerTag = getSumoTag(hitPlayer);


        // 攻撃側が Sumo 中でなく、攻撃された側も Sumo 中でない場合は、Sumo 開始処理
        if (!attackerTag && !hitPlayerTag && attackingPlayer.hasTag(pvpSumoTag)) {
            const sumoTag = generateUniqueSumoTag();
            if (!sumoTag) {
                attackingPlayer.sendMessage(translate(attackingPlayer, "command.sumo.match"));
                hitPlayer.sendMessage(translate(attackingPlayer, "command.sumo.match"));
                return;
            }

            attackingPlayer.addTag(sumoTag);
            hitPlayer.addTag(sumoTag);
            sumoTagsInUse.push(sumoTag);

            attackingPlayer.sendMessage(translate(attackingPlayer, "command.sumo.play1", { hitPlayer: `${hitPlayer.name}` }));
            hitPlayer.sendMessage(translate(hitPlayer, "command.sumo.play2", { hitPlayer: `${attackingPlayer.name}` }));
            attackingPlayer.sendMessage(translate(attackingPlayer, "command.sumo.start",
                {
                    attackingPlayer: `${attackingPlayer.name}`,
                    hitPlayer: `${hitPlayer.name}`,
                    sumoTag: `${sumoTag}`
                }));
            hitPlayer.sendMessage(translate(attackingPlayer, "command.sumo.start",
                {
                    attackingPlayer: `${attackingPlayer.name}`,
                    hitPlayer: `${hitPlayer.name}`,
                    sumoTag: `${sumoTag}`
                }));
            //console.warn(`[SUMO START] ${attackingPlayer.name} vs ${hitPlayer.name} (Tag: ${sumoTag})`);
            return;
        }



        // Sumo 中のプレイヤーが、同じ Sumo タグを持つプレイヤー以外を攻撃した場合
        if (attackerTag && (hitPlayerTag !== attackerTag || !hitPlayerTag)) {
            attackingPlayer.sendMessage(translate(attackingPlayer,"command.sumo.attackUser"));
            return;
        }


        // Sumo 中でないプレイヤーが Sumo 中のプレイヤーを攻撃した場合
        if (!attackerTag && hitPlayerTag) {
            event.damagingEntity.addEffect("weakness", 20 * 3, {
                amplifier: 255,
                showParticles: false,
            });
            attackingPlayer.sendMessage(translate(attackingPlayer, "command.sumo.attackOther"));

            return;

        }

    }
});

function generateUniqueSumoTag(): string | null {
    for (let i = 1; i <= maxSumoMatches; i++) {
        const tag = `${sumoTagPrefix}${i}`;
        if (!sumoTagsInUse.includes(tag)) {
            return tag;
        }
    }
    return null;
}



// 勝敗判定と結果の処理
function determineWinner(player: Player) {
    const sumoTag = getSumoTag(player);
    if (sumoTag) {
        world.getPlayers().forEach(p => {
            if (p.hasTag(sumoTag)) {
                p.removeTag(sumoTag);
            }
        });

        const index = sumoTagsInUse.indexOf(sumoTag);
        if (index > -1) {
            sumoTagsInUse.splice(index, 1);
        }
        player.addTag("sumoWin");
        player.sendMessage(translate(player,"command.sumo.Win"));
        console.warn(`[SUMO WIN] ${player.name}`);
        checkSystemStatus();
    }
}


// システムの有効/無効状態をチェックする関数
function checkSystemStatus() {
    sumoSystemEnabled = world.getPlayers().some(player => player.hasTag(trueSumoTag));
}

// 定期的に Sumo プレイヤーのタグをチェック
system.runInterval(() => {
    if (config().module.sumoSystem.enabled === false) return;

    checkSystemStatus();
    if (!sumoSystemEnabled) return;

    world.getPlayers().forEach(player => {
        if (player.hasTag(pvpSumoTag) && !getSumoTag(player)) {
            player.addEffect("weakness", 20, {
                amplifier: 255,
                showParticles: false
            });
        }
    });

    for (const sumoTag of sumoTagsInUse) {
        const playersWithTag = world.getPlayers().filter(player => player.hasTag(sumoTag));
        if (playersWithTag.length === 1) {
            determineWinner(playersWithTag[0]);
        }
    }
    checkSumoDistance();

}, 20);