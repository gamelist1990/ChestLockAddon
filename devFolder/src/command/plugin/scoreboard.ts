import { system, world, ScoreboardIdentity } from "@minecraft/server";

function processPlaceholder(participant: ScoreboardIdentity, placeholder: string): string {
    try {
        const json = JSON.parse(placeholder);

        if (json.text === "PlayerName") {
            const result = participant.displayName;
            console.log(`Replaced {PlayerName} with: ${result}`);
            return result;
        } else if (json.text === "locate") {
            const player = world.getPlayers().find(p => p.name === participant.displayName);
            if (player) {
                const location = player.location;
                const result = `${Math.floor(location.x)}.${Math.floor(location.y)}.${Math.floor(location.z)}`;
                console.log(`Replaced {"text":"locate"} with: ${result}`);
                return result;
            } else {
                console.warn(`Player "${participant.displayName}" not found, cannot get location.`);
                return placeholder;
            }
        } else if (json.tag) {
            const tag = json.tag;
            const playersWithTag = world.getPlayers({ tags: [tag] });

            if (typeof json.number === "boolean" && json.number) {
                const result = playersWithTag.length.toString();
                console.log(`Replaced {"tag":"${tag}", "number":true} with: ${result}`);
                return result;
            } else {
                const result = playersWithTag.map(p => p.name).join(", ");
                console.log(`Replaced {"tag":"${tag}"} with: ${result}`);
                return result;
            }
        } else {
            console.warn(`Unknown placeholder: ${JSON.stringify(json)}`);
            return placeholder;
        }
    } catch (error) {
        console.warn(`Invalid JSON placeholder: ${placeholder}`, error);
        return placeholder;
    }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { message, id } = event;

    if (id === "ch:score") {
        try {
            const scoreboardName = message.split("=")[1];
            const scoreboard = world.scoreboard.getObjective(scoreboardName);

            if (!scoreboard) {
                console.warn(`Scoreboard "${scoreboardName}" not found.`);
                return;
            }

            const newScoreboardName = `ch_${scoreboardName}`;
            let newScoreboard = world.scoreboard.getObjective(newScoreboardName);
            if (!newScoreboard) {
                newScoreboard = world.scoreboard.addObjective(newScoreboardName, newScoreboardName);
            }

            console.log(`Copying scoreboard "${scoreboardName}" to "${newScoreboardName}"...`);

            for (const participant of scoreboard.getParticipants()) {
                let score = scoreboard.getScore(participant);

                if (score === undefined) {
                    score = 0;
                    console.warn(`Player ${participant.displayName} has no score in scoreboard ${scoreboardName}, setting score to 0.`);
                }

                let display_name = participant.displayName;

                display_name = display_name.replace(/\{(.*?)\}/g, (_match, placeholder) => processPlaceholder(participant, placeholder));

                const player = world.getPlayers().find(p => p.name === participant.displayName);

                if (player) {
                    newScoreboard.setScore(world.getPlayers().find(p => p.name === display_name) || participant, score);
                } else {
                    newScoreboard.setScore(participant, score);
                    console.warn(`Player "${participant.displayName}" not found, using ScoreboardIdentity.`);
                }


                console.log(`Set score for ${display_name} to ${score} in scoreboard ${newScoreboardName}`);
            }

            console.log(`Scoreboard "${scoreboardName}" copied to "${newScoreboardName}".`);

        } catch (error) {
            console.error(`Error processing score update: ${error}`);
        }
    }
});