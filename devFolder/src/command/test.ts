// 全角を半角にする関数
function toHalfWidth(str) {
    return str.replace(/[！-～]/g, function (match) {
        return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
    })
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (match) {
            return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
        });
}

// 正規化関数
function normalize(message) {
    return toHalfWidth(message)
        .toLowerCase()
        .replace(/[ \-\~\@\!\?\/\(\)\[\]\{\}\<\>\,\:\;\+\=\`\~\$\%\^\&\*\|\#._]+/g, '');
}

// 不適切語リスト
const badWords = [
    "3p",
    "av女優",
    "gスポット",
    "ntr",
    "fuck",
    "fck",
    "badd",
    "bad",
    "くそ",
    "ばか"
];

// スコアリングシステムの設定
const ruleScores = {
    exactMatch: 2,    // 完全一致のスコア
    partialMatch: 1.5, // 部分一致のスコア
    similarMatch: 1   // 類似一致のスコア
};

// Levenshtein距離の計算関数
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) {
        matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }

    return matrix[b.length][a.length];
}

// スコアリング関数
function calculateScore(normalizedText, badWords, ruleScores) {
    let totalScore = 0;
    const matchedWords = new Set();

    for (const badWord of badWords) {
        if (normalizedText.includes(badWord)) {
            totalScore += ruleScores.exactMatch;
            matchedWords.add(badWord);
        } else if (!matchedWords.has(badWord)) {
            for (const word of normalizedText.split(/\b/)) {
                if (word.includes(badWord)) {
                    totalScore += ruleScores.partialMatch;
                    matchedWords.add(badWord);
                    break;
                }
            }
        } else if (!matchedWords.has(badWord)) {
            for (const word of normalizedText.split(/\b/)) {
                const distance = levenshteinDistance(badWord, word);
                const similarity = 1 - distance / Math.max(badWord.length, word.length);

                if (similarity >= 0.7) {
                    totalScore += ruleScores.similarMatch * similarity;
                    matchedWords.add(badWord);
                    break;
                }
            }
        }
    }

    return totalScore;
}

// テストケース
const testCases = [
    { input: "fuck", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "FUCK", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "f*ck", expectedNormalized: "fck", expectedScore: 1.5 },
    { input: "ばか", expectedNormalized: "ばか", expectedScore: 2 },
    { input: "バカ", expectedNormalized: "バカ", expectedScore: 0 },
    { input: "くそ", expectedNormalized: "くそ", expectedScore: 2 },
    { input: "f-u-c-k", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "f_u_c_k", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "f.u.c.k", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "b a d", expectedNormalized: "bad", expectedScore: 2 },
    { input: "bad bad", expectedNormalized: "badbad", expectedScore: 1.5 },
    { input: "badd", expectedNormalized: "badd", expectedScore: 1.5 },
    { input: "bad,bad", expectedNormalized: "badbad", expectedScore: 1.5 },
    { input: "b@d b@d", expectedNormalized: "bdbd", expectedScore: 0 },
    { input: "ｆｕｃｋ", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "ＦＵＣＫ", expectedNormalized: "fuck", expectedScore: 2 },
    { input: "f*ck", expectedNormalized: "fck", expectedScore: 1.5 },
    { input: "fck", expectedNormalized: "fck", expectedScore: 2 },
    { input: "ば*か", expectedNormalized: "ばか", expectedScore: 1.5 },
    { input: "ばか", expectedNormalized: "ばか", expectedScore: 2 },
    { input: "abc123", expectedNormalized: "abc123", expectedScore: 0 },
    { input: " ", expectedNormalized: "", expectedScore: 0 },
    { input: "", expectedNormalized: "", expectedScore: 0 },
    { input: "a", expectedNormalized: "a", expectedScore: 0 },
    { input: "very_very_long_word_with_many_characters", expectedNormalized: "veryverylongwordwithmanycharacters", expectedScore: 0 },
    { input: "fuck you", expectedNormalized: "fuckyou", expectedScore: 1.5 },
    { input: "bad day", expectedNormalized: "badday", expectedScore: 1.5 },
    { input: "くそー", expectedNormalized: "くそー", expectedScore: 1.5 },
    { input: "ばかだな", expectedNormalized: "ばかだな", expectedScore: 1.5 },
    { input: "3p", expectedNormalized: "3p", expectedScore: 2 },
    { input: "AV女優", expectedNormalized: "av女優", expectedScore: 2 },
    { input: "Gスポット", expectedNormalized: "gスポット", expectedScore: 2 },
    { input: "NTR", expectedNormalized: "ntr", expectedScore: 2 },
    { input: "this is a fuck", expectedNormalized: "thisisafuck", expectedScore: 1.5 }
];

// テストを実行する関数
function runTests(tests) {
    let passed = 0; // 合格したテストの数
    let failed = 0; // 不合格になったテストの数

    // 各テストケースを実行
    tests.forEach(test => {
        const actualNormalized = normalize(test.input); // 実際の正規化結果
        const actualScore = calculateScore(actualNormalized, badWords, ruleScores); // 実際のスコア

        // 期待する結果と実際の結果が一致するか確認
        if (actualNormalized === test.expectedNormalized && actualScore === test.expectedScore) {
            console.log(`テスト合格: ${test.input} (正規化結果: ${actualNormalized}, スコア: ${actualScore})`);
            passed++; // 合格したテストの数をインクリメント
        } else {
            console.error(`テスト不合格: ${test.input} (期待する正規化結果: ${test.expectedNormalized}, 期待するスコア: ${test.expectedScore}, 実際の正規化結果: ${actualNormalized}, 実際のスコア: ${actualScore})`);
            failed++; // 不合格になったテストの数をインクリメント
        }
    });

    // テスト結果の概要を表示
    console.log(`総テスト数: ${tests.length}, 合格: ${passed}, 不合格: ${failed}`);
}
runTests(testCases);