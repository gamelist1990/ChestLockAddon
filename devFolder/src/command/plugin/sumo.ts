import { Player, system, Vector3, world } from "@minecraft/server";

// Sumo タグのプレフィックス
const sumoTagPrefix = "sumo";
const trueSumoTag = "trueSumo"; // Sumo システム起動用のフラグ
const maxSumoMatches = 5; // 最大同時試合数

let sumoSystemEnabled = false; // Sumo システムの有効/無効状態
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
                    player.sendMessage(`§c対戦相手から15ブロック以上離れました！`);
                    opponent.sendMessage(`§c対戦相手から15ブロック以上離れました！`);
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

        if (!attackerTag || !hitPlayerTag || attackerTag !== hitPlayerTag) {
            event.damagingEntity.addEffect("weakness", 255, {
                amplifier: 2,
            });
            attackingPlayer.sendMessage("§c異なるチームのプレイヤーを攻撃することは禁止されています");
            return;
        }

        if (getSumoTag(attackingPlayer) || getSumoTag(hitPlayer)) {
            return; 
        }


        const sumoTag = generateUniqueSumoTag();
        if (!sumoTag) {
            attackingPlayer.sendMessage("§c現在、すべての 枠 が使用中です。");
            hitPlayer.sendMessage("§c現在、すべての 枠 が使用中です。");
            return;
        }


        attackingPlayer.addTag(sumoTag);
        hitPlayer.addTag(sumoTag);
        sumoTagsInUse.push(sumoTag);


        attackingPlayer.sendMessage(`§a${hitPlayer.name} と 対戦開始！`);
        hitPlayer.sendMessage(`§a${attackingPlayer.name} と 対戦開始！`);

        console.warn(`[SUMO START] ${attackingPlayer.name} vs ${hitPlayer.name} (Tag: ${sumoTag})`);
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

        player.addTag("sumoWin"); // 勝利タグを追加
        console.warn(`[SUMO WIN] ${player.name}`);
        checkSystemStatus(); // システム状態をチェック
    }
}


// システムの有効/無効状態をチェックする関数
function checkSystemStatus() {
    sumoSystemEnabled = world.getPlayers().some(player => player.hasTag(trueSumoTag));
}

// 定期的に Sumo プレイヤーのタグをチェック
system.runInterval(() => {
    checkSystemStatus();
    if (!sumoSystemEnabled) return;

    checkSumoDistance();

    for (const sumoTag of sumoTagsInUse) {  
        const playersWithTag = world.getPlayers().filter(player => player.hasTag(sumoTag));
        if (playersWithTag.length === 1) {
            determineWinner(playersWithTag[0]);
        }
    }
}, 20);