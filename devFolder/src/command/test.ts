const ruleScores = {
    exactMatch: 2,
    fuzzyMatch: 1.5,
    similarMatch: 1,
};

const badWords = ["fuck", "bad", "crap", "ばか", "アホ", "くそ"];

const charPatterns: { [key: string]: string } = {
    'a': '[aàáâãäåæāăąɑAａ]',
    'i': '[iìíîïĩīĭįıihIｉ]',
    'o': '[oòóôõöøōŏőœOｏ]',
    'e': '[eèéêëēĕėęěɛɜɝǝəEｅ]',
    's': '[sßśŝşšſSｓ]',
    'c': '[cçćĉċčɔCｃ]',
    'u': '[uùúûüũūŭůűųцμυUｕ]',
    'l': '[lĺļľŀłLｌ]',
    'k': '[kķĸκKｋ]',
    'b': '[bßЬBｂ]',
    'd': '[dďđDｄ]',
    'r': '[rŕŗřRｒ]',
    'p': '[pPｐ]',
};

// 正規化関数（記号、空白、スペースなどを除去する）
const normalizeMessage = (message: string): string => {
    return message.toLowerCase().replace(/[\s　\-\_\.\@\!\?\/\(\)\[\]\{\}\<\>\,\:\;\+\=\`\~\$\%\^\&\*\|\#\№]+/g, '');
};

// 不適切語のスコアを計算する関数
const calculateBadWordScore = (message: string): number => {
    let score = 0;
    const normalizedMessage = normalizeMessage(message);
    const detectedWords = new Set<string>();

    for (const badWord of badWords) {
        const normalizedBadWord = normalizeMessage(badWord);

        // Exact Match
        const exactMatchRegex = new RegExp(`\\b${normalizedBadWord}\\b`, 'gi');
        if (exactMatchRegex.test(normalizedMessage)) {
            score += ruleScores.exactMatch;
            detectedWords.add(normalizedBadWord);
            continue; // Skip to the next bad word if an exact match is found
        }

        // Fuzzy Match (only if not already detected)
        if (!detectedWords.has(normalizedBadWord)) {
            let fuzzyPattern = "";
            for (const char of normalizedBadWord) {
                fuzzyPattern += charPatterns[char] || char;
            }
            const fuzzyMatchRegex = new RegExp(`\\b(?:${fuzzyPattern})\\b`, 'giu'); // Word boundaries added
            if (fuzzyMatchRegex.test(normalizedMessage)) {
                score += ruleScores.fuzzyMatch;
                detectedWords.add(normalizedBadWord);
                continue;  // Skip to the next bad word
            }
        }

        // Similar Match (only if not already detected)
        if (!detectedWords.has(normalizedBadWord)) {
            let similarPattern = "";
            for (const char of normalizedBadWord) {
                similarPattern += charPatterns[char] || char;
            }

            similarPattern = similarPattern.replace(/\*/g, '[\\s\\S]*?');
            const similarRegex = new RegExp(`\\b${similarPattern}\\b`, 'giu');

            if (similarRegex.test(normalizedMessage)) {
                score += ruleScores.similarMatch;
                detectedWords.add(normalizedBadWord);
            }
        }

    }
    return score;
};

// テストケース
const testCases = [
    { input: "fuck", expectedScore: 5.25, description: "基本的なテスト (英語)" },
    { input: "f u c k", expectedScore: 5.25, description: "スペースあり (英語)" },
    { input: "fｕｃk", expectedScore: 2.25, description: "全角文字あり (英語)" },
    { input: "f@ck", expectedScore: 5.25, description: "記号あり (英語)" },
    { input: "Ｆｕｃｋ", expectedScore: 2.25, description: "全角大文字あり (英語)" },
    { input: "good", expectedScore: 0, description: "不適切語なし (英語)" },
    { input: "f*ck", expectedScore: 3.5, description: "類似単語、アスタリスクあり (英語)" },
    { input: "fu", expectedScore: 1.5, description: "あいまい一致のみ (英語)" },
    { input: "ばか", expectedScore: 5.25, description: "基本的なテスト (日本語)" },
    { input: "ば か", expectedScore: 5.25, description: "スペースあり (日本語)" },
    { input: "バカ", expectedScore: 2.25, description: "カタカナ (日本語)" },
    { input: "b a d", expectedScore: 5.25, description: "スペースあり (英語)" },
    { input: "b@d b a d", expectedScore: 10.5, description: "複数の不適切語、記号とスペースあり (英語)" },
    { input: "くそ", expectedScore: 5.25, description: "新しい単語のテスト (日本語)" },
    { input: "く*そ", expectedScore: 3.5, description: "類似単語、アスタリスクあり (日本語)" },
    { input: "badword", expectedScore: 2.25, description: "bad のあいまいマッチ (英語)" },
    { input: "kuso", expectedScore: 2.25, description: "くそのあいまいマッチ (日本語)" },
    { input: "fuckfuck", expectedScore: 8.75, description: "連続した不適切語 (英語)" },
    { input: "ばかばか", expectedScore: 8.75, description: "連続した不適切語 (日本語)" },
    { input: "f-u_c.k", expectedScore: 5.25, description: "ハイフン、アンダーバー、ドットあり (英語)" },
    { input: "ば-か", expectedScore: 5.25, description: "ハイフンあり (日本語)" },
    { input: "ｆｕｃｋ", expectedScore: 2.25, description: "全角小文字 (英語)" },
    { input: "ばか", expectedScore: 5.25, description: "全角小文字 (日本語)" },
];


// テストを実行する関数
function runTests(tests: { input: string; expectedScore: number; description: string; }[]) {
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        const actualScore = calculateBadWordScore(test.input);
        if (actualScore.toFixed(2) === test.expectedScore.toFixed(2)) {
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