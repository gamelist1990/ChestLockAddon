import { Player, system, Vector3, world } from "@minecraft/server";

// Sumo タグのプレフィックス
const sumoTagPrefix = "sumo";
const trueSumoTag = "trueSumo"; // Sumo システム起動用のフラグ(これが無いと処理が開始しないように)

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
                    // 15 ブロック離れたらお知らせ
                    player.sendMessage(`§c対戦相手から15ブロック以上離れました！`);
                    opponent.sendMessage(`§c対戦相手から15ブロック以上離れました！`);
                    player.removeTag(sumoTag);
                    opponent.removeTag(sumoTag);
                }
            }
        }
    });
}


// Sumo タグを取得する関数
function getSumoTag(player: Player): string | null {
    for (let i = 1; i <= 5; i++) {
        const tag = `${sumoTagPrefix}${i}`;
        if (player.hasTag(tag)) {
            return tag;
        }
    }
    return null;
}

// Sumo 開始処理
world.afterEvents.entityHitEntity.subscribe((event) => {
    const { damagingEntity, hitEntity } = event;
    world.getPlayers().forEach((player) => {
        if (player.hasTag(trueSumoTag)) {
            return
        } else if (player.hasTag("sumo")) {
            if (
                damagingEntity &&
                damagingEntity.typeId === "minecraft:player" &&
                hitEntity &&
                hitEntity.typeId === "minecraft:player"
            ) {
                const attackingPlayer = damagingEntity as Player;
                const hitPlayer = hitEntity as Player;


                // 既に Sumo タグを持っている場合は何もしない
                if (getSumoTag(attackingPlayer) || getSumoTag(hitPlayer)) {
                    return;
                }

                // Sumo タグを付与 (1 から 5 までのランダムな番号)
                const sumoNumber = Math.floor(Math.random() * 5) + 1;
                const sumoTag = `${sumoTagPrefix}${sumoNumber}`;

                attackingPlayer.addTag(sumoTag);
                hitPlayer.addTag(sumoTag);


                attackingPlayer.sendMessage(`§a${hitPlayer.name} と 対戦開始！`);
                hitPlayer.sendMessage(`§a${attackingPlayer.name} と 対戦開始！`);

                console.warn(`[SUMO START] ${attackingPlayer.name} vs ${hitPlayer.name} (Tag: ${sumoTag})`);
            }
        }
    })

});


// 勝敗判定と結果の処理
function determineWinner(player: Player) {
    player.addTag("sumoWin");
    console.warn(`[SUMO WIN] ${player.name}`);
}


// 定期的に Sumo プレイヤーのタグをチェック
system.runInterval(() => {
    world.getPlayers().forEach((player) => {
        if (player.hasTag(trueSumoTag)) {
            return
        }

        checkSumoDistance(); // 距離監視

        for (let i = 1; i <= 5; i++) {
            const sumoTag = `${sumoTagPrefix}${i}`;
            const playersWithTag = world.getPlayers().filter(player => player.hasTag(sumoTag));
            if (playersWithTag.length === 1) {
                determineWinner(playersWithTag[0]);
            }
        }
    })

}, 20);