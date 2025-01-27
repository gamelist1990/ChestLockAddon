import {
    registerCommand,
    MINECRAFT_COMMAND_PREFIX
} from '../index';
import fetch from 'node-fetch';

interface AreaData {
    name: string;
    enName: string;
    code: string;
}

const areas: AreaData[] = [];
let areaJson: any = {};

async function loadAreas() {
    try {
        areaJson = await fetch('https://www.jma.go.jp/bosai/common/const/area.json').then(res => res.json());

        for (const code in areaJson.offices) {
            areas.push({
                name: areaJson.offices[code].name,
                enName: areaJson.offices[code].enName,
                code: code
            });
        }

        //console.log("Loaded areas:", areas); 
    } catch (error) {
        console.error("Error loading areas:", error);
    }
}

loadAreas();

registerCommand('wh', `${MINECRAFT_COMMAND_PREFIX}wh [list/県名] (page/地域名)`, '指定した地域のお天気情報を取得します/見れる地域のリストを表示します', false, async (sender, world, args) => {
    const subCommand = args[0];

    if (subCommand === 'list') {
        // Subcommand: list
        const pageSize = 3;
        let page = parseInt(args[1]) || 1;

        if (page < 1) {
            page = 1;
        }

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageAreas = areas.slice(startIndex, endIndex);

        if (pageAreas.length === 0) {
            world.sendMessage("指定されたページには地域情報がありません。", sender);
            return;
        }

        let message = `地域リスト (Page ${page}):\n`;
        pageAreas.forEach(area => {
            message += `- ${area.name} (${area.enName})\n`;
        });

        const totalPages = Math.ceil(areas.length / pageSize);
        message += `\nPage ${page} of ${totalPages}`;

        world.sendMessage(message, sender);
    } else {
        // Subcommand: Weather information for a specific area
        let areaName = args.join(' ');

        if (!areaName) {
            areaName = "東京都";
        }

        try {
            let areaCode: string | null = null;

            function findAreaCode(areaName: string, data: any): string | null {
                for (const code in data) {
                    if (data[code].name === areaName || data[code].enName === areaName) {
                        return code;
                    }
                }
                return null;
            }

            // offices から areaCode を検索
            areaCode = findAreaCode(areaName, areaJson.offices) || findAreaCode(areaName, areaJson.centers);

            if (!areaCode) {
                if (areaName === "東京都") {
                    areaCode = "130000";
                } else {
                    for (const center in areaJson.centers) {
                        if (areaJson.centers[center].children.some((child: any) => areaJson.offices[child]?.name === areaName)) {
                            areaCode = areaJson.centers[center].children.find((child: any) => areaJson.offices[child]?.name === areaName)
                        }
                    }

                }
            }

            if (!areaCode) {
                world.sendMessage(`地域名 "${areaName}" が見つかりません。`, sender);
                return;
            }

            const weatherApiUrl = `https://www.jma.go.jp/bosai/forecast/data/forecast/${areaCode}.json`;
            const response = await fetch(weatherApiUrl);

            if (!response.ok) {
                world.sendMessage(`お天気情報の取得に失敗しました。(HTTPエラー: ${response.status})`, sender);
                return;
            }

            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                const weatherJson = await response.json();

                const reportDatetime = weatherJson[0].reportDatetime;
                const publishingOffice = weatherJson[0].publishingOffice;

                let message = `[${publishingOffice}] (${reportDatetime})\n`;
                let areaFilter = args.slice(1); // filter areas if specified

                for (const timeseries of weatherJson[0].timeSeries) {
                    let targetAreas = timeseries.areas;

                    if (areaFilter.length > 0) {
                        targetAreas = timeseries.areas.filter((areaData, index, self) => {
                            return self.findIndex(a => a.area?.name === areaData.area?.name) === index && areaFilter.includes(areaData.area?.name);
                        });
                    } else {
                        targetAreas = timeseries.areas.slice(0, 1);
                    }

                    targetAreas.forEach((areaData) => {
                        // areaData.weathers が存在し、空配列でないことを確認
                        if (areaData.weathers && areaData.weathers.length > 0) {
                            const area = areaData.area?.name || "地域不明";
                            const weather = areaData.weathers[0];
                            const timeDefine = timeseries.timeDefines[0];
                            const date = new Date(timeDefine).toLocaleDateString();

                            message += `\n[${area}] (${date}): ${weather}\n`;
                        }

                    });
                }

                world.sendMessage(message, sender);

            } else {

                const errorText = await response.text();
                world.sendMessage(`お天気情報の取得に失敗しました。気象庁のサーバーからエラーが返されました:\n${errorText.slice(0, 50)}...`, sender);

                console.error("気象庁APIエラー:", errorText);
            }

        } catch (error) {
            console.error("お天気情報取得エラー:", error);
            world.sendMessage("お天気情報の取得に失敗しました。", sender);
        }
    }
});