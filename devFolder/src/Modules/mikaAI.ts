import { minecraftData } from "./minecraftData.js";

interface MarkovChain {
    [key: string]: string[];
}

// n-gramの次数 (2以上)
const N_GRAM = 10;

function preprocessKeyword(text: string): string {
    const cleanedText = text.replace(/[\s,.!?;:()\[\]{}"'\-—\/\\|~`@#$%^&*+=_<>]/g, "");
    return cleanedText.toLowerCase().replace(/[ぁ-ゔ]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60)).replace(/ー/g, "");
}

function keywordMatching(prompt: string, keywords: string[]): boolean {
    const processedPrompt = preprocessKeyword(prompt);
    return keywords.some(keyword => {
        const processedKeyword = preprocessKeyword(keyword);
        return processedKeyword.includes(processedPrompt) || processedPrompt.includes(processedKeyword);
    });
}

function buildMarkovChain(data: { description: string }[], n: number): MarkovChain {
    const chain: MarkovChain = {};
    for (const entry of data) {
        const words = entry.description.split(/\s+/);
        for (let i = 0; i < words.length - n + 1; i++) {
            const currentNGram = words.slice(i, i + n).join(" ");
            const nextWord = words[i + n];

            if (!chain[currentNGram]) {
                chain[currentNGram] = [];
            }
            if (nextWord) {
                chain[currentNGram].push(nextWord);
            }
        }
    }
    return chain;
}

const markovChain = buildMarkovChain(minecraftData, N_GRAM);

function generateTextFromMarkov(startWords: string, chain: MarkovChain, maxLength: number = 50): string {
    let text = startWords;
    let currentNGram = startWords;

    for (let i = 0; i < maxLength; i++) {
        const possibleNextWords = chain[currentNGram];
        if (!possibleNextWords || possibleNextWords.length === 0) {
            break;
        }
        const nextWord = possibleNextWords[Math.floor(Math.random() * possibleNextWords.length)];
        text += " " + nextWord;
        const textWords = text.split(/\s+/);
        currentNGram = textWords.slice(-N_GRAM).join(" ");

        if (textWords.length > maxLength) {
            text = textWords.slice(0, maxLength).join(" ");
            break;
        }
    }

    return text;
}

function minecraftChatbot(prompt: string): string {
    let response = "";
    let foundMatch = false;

    for (const entry of minecraftData) {
        if (keywordMatching(prompt, entry.keywords)) {
            const words = entry.description.split(/\s+/);
            const startWords = words.slice(0, N_GRAM).join(" ");
            response = generateTextFromMarkov(startWords, markovChain);

            if (entry.related.length > 0) {
                const randomRelated = entry.related[Math.floor(Math.random() * entry.related.length)];
                const relatedEntry = minecraftData.find(e => e.keywords.includes(randomRelated));
                if (relatedEntry) {
                    const relatedWords = relatedEntry.description.split(/\s+/);
                    const relatedStartWords = relatedWords.slice(0, N_GRAM).join(" ");
                    response += "\n関連情報: " + generateTextFromMarkov(relatedStartWords, markovChain);
                }
            }
            foundMatch = true;
            break;
        }
    }

    if (!foundMatch) {
        const greetings = [
            "学習データが少ない為 (理解できませんでした)",
            "すみません理解できません",
            "他の質問をお願いできますか？"
        ];
        response = greetings[Math.floor(Math.random() * greetings.length)];
    }

    return response;
}


export { minecraftChatbot };

//const prompt = "何のゲームが好き？";
//const response = minecraftChatbot(prompt);
//console.log(response);