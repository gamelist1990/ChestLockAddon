import { badWords } from "./plugin/AntiCheat/detections/BadList";

const ruleScores = {
    exactMatch: 2,
    fuzzyMatch: 1.5,
    similarMatch: 1,
};

//const badWords: string[] = ["fuck", "bad", "crap", "ばか", "アホ", "くそ"];

const levenshteinDistance = (s1: string, s2: string): number => {
    if (s1.length < s2.length) {
        return levenshteinDistance(s2, s1);
    }

    if (s2.length === 0) {
        return s1.length;
    }

    let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);

    for (let i = 0; i < s1.length; i++) {
        const c1 = s1[i];
        const currentRow = [i + 1];
        for (let j = 0; j < s2.length; j++) {
            const c2 = s2[j];
            const insertions = previousRow[j + 1] + 1;
            const deletions = currentRow[j] + 1;
            const substitutions = previousRow[j] + (c1 !== c2 ? 1 : 0);
            currentRow.push(Math.min(insertions, deletions, substitutions));
        }
        previousRow = currentRow;
    }
    return previousRow[previousRow.length - 1];
};

const normalize = (message: string): string => {
    return message.toLowerCase().replace(/[\s\-\_\.\@\!\?\/\(\)\[\]\{\}\<\>\,\:\;\+\=\`\~\$\%\^\&\*\|\#\№]+/g, '');
};

const calculateBadWordScore = (message: string): number => {
    let score = 0;
    const normalizedMessage = normalize(message);

    for (const badWord of badWords) {
        const normalizedBadWord = normalize(badWord);

        // Exact Match
        const exactMatchRegex = new RegExp(`\\b${normalizedBadWord}\\b`, 'gi');
        if (exactMatchRegex.test(normalizedMessage)) {
            score += ruleScores.exactMatch;
            continue; // If found exact match, skip other match types
        }

        // Fuzzy Match
        let fuzzyMatchScore = 0;
        for (let i = 0; i <= normalizedMessage.length - normalizedBadWord.length; i++) {
            const subString = normalizedMessage.substring(i, i + normalizedBadWord.length);
            const distance = levenshteinDistance(normalizedBadWord, subString);
            if (distance <= 2) {
                fuzzyMatchScore += ruleScores.fuzzyMatch * (1 - (distance / 2));
            }
        }
        score += fuzzyMatchScore;

        // Similar Match
        let similarMatchScore = 0;
        for (let i = 0; i <= normalizedMessage.length - normalizedBadWord.length; i++) {
            const subString = normalizedMessage.substring(i, i + normalizedBadWord.length);
            const distance = levenshteinDistance(normalizedBadWord, subString);
            const similarityScore = (normalizedBadWord.length - distance) / normalizedBadWord.length;

            if (distance <= 4 && similarityScore > 0.4) {
                similarMatchScore += ruleScores.similarMatch * similarityScore;
            }
        }
        score += similarMatchScore;
    }

    return score;
};

// テストケース
const testCases: { input: string; expectedScore: number; description: string; }[] = [
    { input: "fuck", expectedScore: 2, description: "基本的なテスト (英語)" },
    { input: "f u c k", expectedScore: 2, description: "スペースあり (英語)" },
    { input: "fｕｃk", expectedScore: 1.5, description: "全角文字あり (英語)" },
    { input: "f@ck", expectedScore: 2, description: "記号あり (英語)" },
    { input: "Ｆｕｃｋ", expectedScore: 2, description: "全角大文字あり (英語)" },
    { input: "good", expectedScore: 0, description: "不適切語なし (英語)" },
    { input: "f*ck", expectedScore: 1.5, description: "類似単語、アスタリスクあり (英語)" },
    { input: "fu", expectedScore: 1.5 * 0.5, description: "あいまい一致のみ (英語)" },
    { input: "ばか", expectedScore: 2, description: "基本的なテスト (日本語)" },
    { input: "ば か", expectedScore: 2, description: "スペースあり (日本語)" },
    { input: "バカ", expectedScore: 1.5, description: "カタカナ (日本語)" },
    { input: "b a d", expectedScore: 2, description: "スペースあり (英語)" },
    { input: "b@d b a d", expectedScore: 4, description: "複数の不適切語、記号とスペースあり (英語)" },
    { input: "くそ", expectedScore: 2, description: "新しい単語のテスト (日本語)" },
    { input: "く*そ", expectedScore: 1.5, description: "類似単語、アスタリスクあり (日本語)" },
    { input: "badword", expectedScore: 1.5, description: "bad のあいまいマッチ (英語)" },
    { input: "kuso", expectedScore: 1.5, description: "くそのあいまいマッチ (日本語)" },
    { input: "fuckfuck", expectedScore: 4, description: "連続した不適切語 (英語)" },
    { input: "ばかばか", expectedScore: 4, description: "連続した不適切語 (日本語)" },
    { input: "f-u_c.k", expectedScore: 2, description: "ハイフン、アンダーバー、ドットあり (英語)" },
    { input: "ば-か", expectedScore: 2, description: "ハイフンあり (日本語)" },
    { input: "ｆｕｃｋ", expectedScore: 1.5, description: "全角小文字 (英語)" },
    { input: "ばか", expectedScore: 2, description: "全角小文字 (日本語)" },
];

// テストを実行する関数
function runTests(tests: { input: string; expectedScore: number; description: string; }[]): void {
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        const actualScore = calculateBadWordScore(test.input);

        if (actualScore.toFixed(3) === test.expectedScore.toFixed(3)) {
            console.log(`✅ ${test.description}`);
            passed++;
        } else {
            console.error(`❌ ${test.description}: 期待値 ${test.expectedScore}, 実際の結果 ${actualScore}  入力: ${test.input}`);
            failed++;
        }
    }
    console.log(`\nテスト完了: ${passed} 件成功, ${failed} 件失敗`);
}

runTests(testCases);