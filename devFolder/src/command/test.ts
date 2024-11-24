import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

interface SettingData {
    revealRoleOnEject: boolean;
}

const defaultSettings: SettingData = {
    revealRoleOnEject: false,
};

let settings = defaultSettings;

const mainScoreboard = world.scoreboard.getObjective("main") || world.scoreboard.addObjective("main", "Roles");
const settingScoreboard = world.scoreboard.getObjective("setting") || world.scoreboard.addObjective("setting", "Settings");

const mainScore = {
    "§cインポスター": 0,
    "§cクリーナー": 0,
    "§cダブルキラー": 0,
};

const settingScore = {
    "meetingSetting": 120,
    "voteSetting": 30,
    "killSetting": 20,
    "revealSetting": 0, 
};

function initializeScores(): void {
    // Iterate through the score objects and their corresponding scoreboards
    const scoreData = [
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
        player.runCommand("scoreboard players set 参加人数 main 0");
        player.runCommand("execute as @a[tag=!n] at @s run scoreboard players add 参加人数 main 1");
        player.runCommand("scoreboard players operation §3Crew main = 参加人数 main");
        player.runCommand("scoreboard players operation §3Crew main -= §cインポスター main");
        player.runCommand("scoreboard players operation §3Crew main -= §cクリーナー main");
        player.runCommand("scoreboard players operation §3Crew main -= §cダブルキラー main");
    }
}

world.afterEvents.itemUse.subscribe(eventData => {
    const player = eventData.source;
    const item = eventData.itemStack;

    const getScoreList = (objective: any, keys: string[]): Record<string, number> => {
        return keys.reduce((obj, key) => {
            obj[key] = objective.getScore(key);
            return obj;
        }, {} as Record<string, number>);
    }

    if (item.typeId === "minecraft:diamond" && player.hasTag("host")) {
        const roleScores = getScoreList(mainScoreboard, ["§cインポスター", "§cクリーナー", "§cダブルキラー"]);

        new ModalFormData()
            .title("Role Settings")
            .slider("§cインポスター", 0, 6, 1, roleScores["§cインポスター"])
            .slider("§cクリーナー", 0, 2, 1, roleScores["§cクリーナー"])
            .slider("§cダブルキラー", 0, 2, 1, roleScores["§cダブルキラー"])

            //@ts-ignore
            .show(player)
            .then(response => {
                if (!response.canceled && Array.isArray(response.formValues)) {
                    mainScoreboard.setScore("§cインポスター", Number(response.formValues[0]));
                    mainScoreboard.setScore("§cクリーナー", Number(response.formValues[1]));
                    mainScoreboard.setScore("§cダブルキラー", Number(response.formValues[2]));
                }
            });
    } else if (item.typeId === "minecraft:iron_ingot" && player.hasTag("host")) {
        const settingScores = getScoreList(settingScoreboard, ["meetingSetting", "voteSetting", "killSetting"]);

        new ModalFormData()
            .title("Game Settings")
            .slider("§aMeeting Time", 10, 180, 1, settingScores["meetingSetting"])
            .slider("§bVoting Time", 10, 60, 1, settingScores["voteSetting"])
            .slider("§cKill Cooldown", 1, 60, 1, settingScores["killSetting"])
            .toggle("§6追放時の役職を確認", settings.revealRoleOnEject)
            //@ts-ignore
            .show(player)
            .then(response => {
                if (!response.canceled && Array.isArray(response.formValues)) {
                    settingScoreboard.setScore("meetingSetting", Number(response.formValues[0]));
                    settingScoreboard.setScore("voteSetting", Number(response.formValues[1]));
                    player.runCommand(`scriptevent ch:Vsetting {"duration":${response.formValues[1]}}`);
                    settingScoreboard.setScore("killSetting", Number(response.formValues[2]));


                    settings.revealRoleOnEject = Boolean(response.formValues[3]);
                    player.sendMessage(`§6追放時の役職を確認§r: ${settings.revealRoleOnEject ? 'Enabled' : 'Disabled'}`);
                    settingScoreboard.setScore("revealSetting", settings.revealRoleOnEject ? 1 : 0);


                }
            });
    }
});


system.runInterval(updatePlayerCounts, 20);

initializeScores();