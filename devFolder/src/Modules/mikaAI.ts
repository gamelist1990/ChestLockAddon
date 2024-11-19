import { minecraftData } from "./minecraftData.js";



function preprocessKeyword(text: string): string {
    // 正規表現で句読点、記号、空白などを除去
    const cleanedText = text.replace(/[\s,.!?;:()\[\]{}"'\-—\/\\|~`@#$%^&*+=_<>]/g, "");

    // ひらがなをカタカナに変換 & 長音を除去
    return cleanedText.toLowerCase().replace(/[ぁ-ゔ]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60)).replace(/ー/g, "");
}

function keywordMatching(prompt: string, keywords: string[]): boolean {
    const processedPrompt = preprocessKeyword(prompt);
    return keywords.some(keyword => {
        const processedKeyword = preprocessKeyword(keyword);
        return processedKeyword.includes(processedPrompt) || processedPrompt.includes(processedKeyword); // 部分一致を両方向でチェック
    });
}

function minecraftChatbot(prompt: string): string {
    let response = "";
    let foundMatch = false;

    for (const entry of minecraftData) {
        if (keywordMatching(prompt, entry.keywords)) {
            response += entry.description + "\n";

            if (entry.related.length > 0) {
                const randomRelated = entry.related[Math.floor(Math.random() * entry.related.length)];
                const relatedEntry = minecraftData.find(e => e.keywords.includes(randomRelated));
                if (relatedEntry) {
                    response += `関連情報: ${relatedEntry.description}\n`;
                }
            }
            foundMatch = true;
            break; // マッチしたらループを抜ける
        }
    }

    if (!foundMatch) {
        const greetings = [
            "こんにちは！Minecraftについて質問してください。",
            "やあ！Minecraftの世界へようこそ！",
            "はじめまして！Minecraftについて何か知りたいことはありますか？"
        ];
        response = greetings[Math.floor(Math.random() * greetings.length)];
    }

    return response;
}


console.log(minecraftChatbot("ゾンビって？"));
console.log(minecraftChatbot("サバイバルで重要なこと"));



export { minecraftChatbot };