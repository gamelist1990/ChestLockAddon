import { world, system, Player } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";

interface Settings {
    revealRoleOnEject: boolean;
}

const defaultSettings: Settings = {
    revealRoleOnEject: false,
};

let settings: Settings = defaultSettings;

const mainScoreboard: any = world.scoreboard.getObjective("main") || world.scoreboard.addObjective("main", "Roles");
const settingScoreboard: any = world.scoreboard.getObjective("setting") || world.scoreboard.addObjective("setting", "Settings");

const mainScore: Record<string, number> = {
    "§cインポスター": 0,
    "§cクリーナー": 0,
    "§cダブルキラー": 0,
    "§3シェリフ": 0,
    "§3シーア": 0,
    "§5妖狐": 0,
    "§5てるてる": 0,
    "§3クルー": 0,
    "参加人数": 0,
};

const settingScore: Record<string, number> = {
    "meetingSetting": 120,
    "voteSetting": 30,
    "killSetting": 20,
    "revealSetting": 0,
    "sheriffkillcount": 2,
    "cleanertime": 30,
    "skeletoncount": 40,
};

function initializeScores(): void {
    const scoreData: { scoreboard: any; scores: Record<string, number> }[] = [
        { scoreboard: mainScoreboard, scores: mainScore },
        { scoreboard: settingScoreboard, scores: settingScore },
    ];

    scoreData.forEach(({ scoreboard, scores }) => {
        for (const [key, value] of Object.entries(scores)) {
            if (!scoreboard.hasParticipant(key)) {
                scoreboard.setScore(key, value);
            }
        }
    });
}

function updatePlayerCounts(): void {
    for (const player of world.getPlayers()) {
        player.runCommand("scoreboard players set @a 参加人数 main 0");
        player.runCommand("scoreboard players add @a[tag=!n] 参加人数 main 1");
        player.runCommand("scoreboard players operation §3クルー main = 参加人数 main");
        for (const role of Object.keys(mainScore).filter(key => key !== "§3クルー" && key !== "参加人数")) {
            player.runCommand(`scoreboard players operation §3クルー main -= ${role} main`);
        }
    }
}

world.afterEvents.itemUse.subscribe((eventData: any) => {
    const player: any = eventData.source;
    const item: any = eventData.itemStack;

    const getScoreList = (objective: any, keys: string[]): Record<string, number> => {
        return keys.reduce((obj, key) => {
            obj[key] = objective.getScore(key);
            return obj;
        }, {} as Record<string, number>);
    };


    if (item.typeId === "js:crewmate" && player.hasTag("host")) {
        const roleScores = getScoreList(mainScoreboard, ["§cインポスター", "§cクリーナー", "§cダブルキラー", "§3シェリフ", "§3シーア", "§5妖狐", "§5てるてる"]);
        const form = new ModalFormData()
            .title("Role Settings")
            .slider("§cインポスター", 0, 6, 1, roleScores["§cインポスター"])
            .slider("§cクリーナー", 0, 2, 1, roleScores["§cクリーナー"])
            .slider("§cダブルキラー", 0, 2, 1, roleScores["§cダブルキラー"])
            .slider("§3シェリフ", 0, 2, 1, roleScores["§3シェリフ"])
            .slider("§3シーア", 0, 2, 1, roleScores["§3シーア"])
            .slider("§5妖狐", 0, 1, 1, roleScores["§5妖狐"])
            .slider("§5てるてる", 0, 1, 1, roleScores["§5てるてる"]);

        form.show(player).then((response: any) => {
            if (!response.canceled && Array.isArray(response.formValues)) {
                mainScoreboard.setScore("§cインポスター", Number(response.formValues[0]));
                mainScoreboard.setScore("§cクリーナー", Number(response.formValues[1]));
                mainScoreboard.setScore("§cダブルキラー", Number(response.formValues[2]));
                mainScoreboard.setScore("§3シェリフ", Number(response.formValues[3]));
                mainScoreboard.setScore("§3シーア", Number(response.formValues[4]));
                mainScoreboard.setScore("§5妖狐", Number(response.formValues[5]));
                mainScoreboard.setScore("§5てるてる", Number(response.formValues[6]));
            }
        });
    } else if (item.typeId === "js:crewmate_blue" && player.hasTag("host")) {
        const settingScores = getScoreList(settingScoreboard, ["meetingSetting", "voteSetting", "killSetting", "sheriffkillcount", "cleanertime", "skeletoncount"]);
        const form = new ModalFormData()
            .title("Game Settings")
            .slider("§a会議時間", 10, 180, 1, settingScores["meetingSetting"])
            .slider("§b投票時間", 10, 60, 1, settingScores["voteSetting"])
            .slider("§cキルクールタイム", 1, 60, 1, settingScores["killSetting"])
            .toggle("§6追放時の役職を確認", settings.revealRoleOnEject)
            .slider("シェリフの最大kill数", 1, 10, 1, settingScores["sheriffkillcount"])
            .slider("§cクリーナークールタイム", 1, 120, 1, settingScores["cleanertime"])
            .slider("最大スケルトンの数", 1, 100, 1, settingScores["skeletoncount"]);


        form.show(player).then((response: any) => {
            if (!response.canceled && Array.isArray(response.formValues)) {
                settingScoreboard.setScore("meetingSetting", Number(response.formValues[0]));
                settingScoreboard.setScore("voteSetting", Number(response.formValues[1]));
                player.runCommand(`scriptevent ch:Vsetting {"duration":${response.formValues[1]}}`);
                settingScoreboard.setScore("killSetting", Number(response.formValues[2]));
                settings.revealRoleOnEject = Boolean(response.formValues[3]);
                player.sendMessage(`§6追放時の役職を確認§r: ${settings.revealRoleOnEject ? 'Enabled' : 'Disabled'}`);
                settingScoreboard.setScore("revealSetting", settings.revealRoleOnEject ? 1 : 0);
                settingScoreboard.setScore("sheriffkillcount", Number(response.formValues[4]));
                settingScoreboard.setScore("cleanertime", Number(response.formValues[5]));
                settingScoreboard.setScore("skeletoncount", Number(response.formValues[6]));
            }
        });
    } else if (item.typeId === "minecraft:diamond" && player.hasTag("host")) {
        const sampleForm = new ActionFormData();
        sampleForm.title("ゲーム開始")
        sampleForm.button("開始")
        sampleForm.button("")
        sampleForm.button("")
        sampleForm.show(player).then(({ selection, canceled }: any) => {
            if (canceled) return;
            if (selection === 0) {
                player.runCommand("fill -66 -60 10 -65 -60 10 redstone_block");
            }
        }

        )
    } else if (item.typeId === "js:nais" && player.hasTag("uranai")) {

        const form = new ActionFormData();
        form.title("占い ※§4ゲーム中一度しか占うことはできません!!");


        const playerNames = getAllPlayerNames(player as any); // playerにany型アサーションを追加
        if (playerNames.length === 0) {
            form.button("戻る"); // 戻るボタンを追加
            form.show(player);
        } else {
            playerNames.forEach(p => form.button(p));
            form.show(player).then((response: any) => {

                if (response.canceled || response.selection === undefined) return;
                const selectedPlayer = playerNames[response.selection];
                const target = getPlayerByName(selectedPlayer)
                if (target) {
                    player.sendMessage(target.hasTag("oni") ? "やつは鬼だった" : "やつは鬼ではない");
                }
            });
        }
    }



    function getAllPlayerNames(currentPlayer: Player): string[] {
        const playerNames: string[] = [];
        for (const player of world.getPlayers()) {
            if (player.name !== currentPlayer.name) {
                playerNames.push(player.name);
            }
        }
        return playerNames;
    }

    function getPlayerByName(playerName: string): Player | null {
        for (const player of world.getPlayers()) {
            if (player.name === playerName) {
                return player;
            }
        }
        return null;
    }


});


system.runInterval(updatePlayerCounts, 20);
initializeScores();