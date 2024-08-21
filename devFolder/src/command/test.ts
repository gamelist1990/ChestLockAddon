import { Player, world } from "@minecraft/server";
import { c } from "../Util";
import { registerCommand, verifier } from "../Handler";

// === 辞書データ ===
interface DictionaryEntry {
  surface: string;
  reading: string;
}

const dictionaryData: DictionaryEntry[] = [
  { surface: "こんにちは", reading: "konnichiwa" },
  { surface: "こんにちわ", reading: "konnichiwa" },
  { surface: "元気", reading: "genki" },
  { surface: "日本", reading: "nihon" },
];

const dictionary: { [key: string]: string[] } = {};
dictionaryData.forEach(({ surface, reading }) => {
  if (!dictionary[reading]) {
    dictionary[reading] = [];
  }
  dictionary[reading].push(surface);
});

// === ローマ字変換テーブル ===
const conversionTable: { [key: string]: string[] } = {
  "a": ["あ", "ア", "a"],
  "i": ["い", "イ", "i"],
  "u": ["う", "ウ", "u"],
  "e": ["え", "エ", "e"],
  "o": ["お", "オ", "o"],
  "ka": ["か", "カ", "ka"],
  "ki": ["き", "キ", "ki"],
  "ku": ["く", "ク", "ku"],
  "ke": ["け", "ケ", "ke"],
  "ko": ["こ", "コ", "ko"],
  "sa": ["さ", "サ", "sa"],
  "shi": ["し", "シ", "shi"],
  "su": ["す", "ス", "su"],
  "se": ["せ", "セ", "se"],
  "so": ["そ", "ソ", "so"],
  "ta": ["た", "タ", "ta"],
  "chi": ["ち", "チ", "chi"],
  "tsu": ["つ", "ツ", "tsu"],
  "te": ["て", "テ", "te"],
  "to": ["と", "ト", "to"],
  "na": ["な", "ナ", "na"],
  "ni": ["に", "ニ", "ni"],
  "nu": ["ぬ", "ヌ", "nu"],
  "ne": ["ね", "ネ", "ne"],
  "no": ["の", "ノ", "no"],
  "ha": ["は", "ハ", "ha"],
  "hi": ["ひ", "ヒ", "hi"],
  "fu": ["ふ", "フ", "fu"],
  "he": ["へ", "ヘ", "he"],
  "ho": ["ほ", "ホ", "ho"],
  "ma": ["ま", "マ", "ma"],
  "mi": ["み", "ミ", "mi"],
  "mu": ["む", "ム", "mu"],
  "me": ["め", "メ", "me"],
  "mo": ["も", "モ", "mo"],
  "ya": ["や", "ヤ", "ya"],
  "yu": ["ゆ", "ユ", "yu"],
  "yo": ["よ", "ヨ", "yo"],
  "ra": ["ら", "ラ", "ra"],
  "ri": ["り", "リ", "ri"],
  "ru": ["る", "ル", "ru"],
  "re": ["れ", "レ", "re"],
  "ro": ["ろ", "ロ", "ro"],
  "wa": ["わ", "ワ", "wa"],
  "wo": ["を", "ヲ", "wo"],
  "n": ["ん", "ン", "n"],
  "ga": ["が", "ガ", "ga"],
  "gi": ["ぎ", "ギ", "gi"],
  "gu": ["ぐ", "グ", "gu"],
  "ge": ["げ", "ゲ", "ge"],
  "go": ["ご", "ゴ", "go"],
  "za": ["ざ", "ザ", "za"],
  "ji": ["じ", "ジ", "ji"],
  "zu": ["ず", "ズ", "zu"],
  "ze": ["ぜ", "ゼ", "ze"],
  "zo": ["ぞ", "ゾ", "zo"],
  "da": ["だ", "ダ", "da"],
  "di": ["ぢ", "ヂ", "di"],
  "du": ["づ", "ヅ", "du"],
  "de": ["で", "デ", "de"],
  "do": ["ど", "ド", "do"],
  "ba": ["ば", "バ", "ba"],
  "bi": ["び", "ビ", "bi"],
  "bu": ["ぶ", "ブ", "bu"],
  "be": ["べ", "ベ", "be"],
  "bo": ["ぼ", "ボ", "bo"],
  "pa": ["ぱ", "パ", "pa"],
  "pi": ["ぴ", "ピ", "pi"],
  "pu": ["ぷ", "プ", "pu"],
  "pe": ["ぺ", "ペ", "pe"],
  "po": ["ぽ", "ポ", "po"],
  "kya": ["きゃ", "キャ", "kya"],
  "kyu": ["きゅ", "キュ", "kyu"],
  "kyo": ["きょ", "キョ", "kyo"],
  "sha": ["しゃ", "シャ", "sha"],
  "shu": ["しゅ", "シュ", "shu"],
  "sho": ["しょ", "ショ", "sho"],
  "cha": ["ちゃ", "チャ", "cha"],
  "chu": ["ちゅ", "チュ", "chu"],
  "cho": ["ちょ", "チョ", "cho"],
  "nya": ["にゃ", "ニャ", "nya"],
  "nyu": ["にゅ", "ニュ", "nyu"],
  "nyo": ["にょ", "ニョ", "nyo"],
  "hya": ["ひゃ", "ヒャ", "hya"],
  "hyu": ["ひゅ", "ヒュ", "hyu"],
  "hyo": ["ひょ", "ヒョ", "hyo"],
  "mya": ["みゃ", "ミャ", "mya"],
  "myu": ["みゅ", "ミュ", "myu"],
  "myo": ["みょ", "ミョ", "myo"],
  "rya": ["りゃ", "リャ", "rya"],
  "ryu": ["りゅ", "リュ", "ryu"],
  "ryo": ["りょ", "リョ", "ryo"],
  "gya": ["ぎゃ", "ギャ", "gya"],
  "gyu": ["ぎゅ", "ギュ", "gyu"],
  "gyo": ["ぎょ", "ギョ", "gyo"],
  "ja": ["じゃ", "ジャ", "ja"],
  "ju": ["じゅ", "ジュ", "ju"],
  "jo": ["じょ", "ジョ", "jo"],
  "bya": ["びゃ", "ビャ", "bya"],
  "byu": ["びゅ", "ビュ", "byu"],
  "byo": ["びょ", "ビョ", "byo"],
  "pya": ["ぴゃ", "ピャ", "pya"],
  "pyu": ["ぴゅ", "ピュ", "pyu"],
  "pyo": ["ぴょ", "ピョ", "pyo"],
  "kka": ["っか", "ッカ"],
  "kki": ["っき", "ッキ"],
  "kku": ["っく", "ック"],
  "kke": ["っけ", "ッケ"],
  "kko": ["っこ", "ッコ"],
  // ... (他の「っ」を含む音節) ...
  "si": ["し", "シ"],
  "ti": ["ち", "チ"],
  "tu": ["つ", "ツ"],
  "hu": ["ふ", "フ"],
  "ー": ["ー", "ー", "-"],
};


// === ローマ字からひらがなへの変換 ===
function romajiToHiragana(romaji: string): string {
    let result = "";
    let i = 0;
    while (i < romaji.length) {
      // 3文字から始まる変換を探す
      if (i < romaji.length - 2 && conversionTable[romaji.substring(i, i + 3)]) {
        result += conversionTable[romaji.substring(i, i + 3)][0];
        i += 3;
      } else if (i < romaji.length - 1 && conversionTable[romaji.substring(i, i + 2)]) {
        // 2文字から始まる変換を探す
        result += conversionTable[romaji.substring(i, i + 2)][0];
        i += 2;
      } else if (conversionTable[romaji[i]]) {
        // 1文字の変換を探す
        result += conversionTable[romaji[i]][0];
        i++;
      } else {
        // 変換テーブルにない場合はそのまま追加
        result += romaji[i];
        i++;
      }
    }
    return result;
  }

// === 最長一致検索による単語分割 ===
function splitIntoWords(text: string): string[] {
  const words: string[] = [];
  let currentWord = "";
  for (let i = 0; i < text.length; i++) {
    currentWord += text[i];
    let longestMatch = "";
    for (const word in dictionary) {
      if (
        currentWord === word &&
        word.length > longestMatch.length
      ) {
        longestMatch = word;
      }
    }
    if (longestMatch) {
      words.push(longestMatch);
      currentWord = "";
    }
  }
  if (currentWord) {
    words.push(currentWord);
  }
  return words;
}

// === ローマ字変換関数 (再構築版) ===
function convertRomajiToJapanese(romaji: string): string {
  const hiraganaText = romajiToHiragana(romaji);
  const words = splitIntoWords(hiraganaText);
  let result = "";
  for (const word of words) {
    if (dictionary[word]) {
      result += dictionary[word][0]; // 最初の候補を採用
    } else {
      result += word; // 辞書にない場合はそのまま
    }
  }
  return result;
}

let romajiConversionEnabled = false;
const playerConversionStatus = new Map<Player, boolean>();

//@ts-ignore
world.beforeEvents.chatSend.subscribe((event: any) => {
  const player = event.sender;
  if (!(player instanceof Player)) return;

  const isEnabled = playerConversionStatus.get(player) ?? romajiConversionEnabled;

  if (isEnabled) {
    const originalMessage = event.message;
    const convertedMessage = convertRomajiToJapanese(originalMessage);

    event.cancel = true;
    world.sendMessage(`<${player.name}> ${originalMessage} §6(${convertedMessage})`);
  }
});

registerCommand({
  name: "test",
  description: "test_command_description",
  parent: false,
  maxArgs: 1,
  minArgs: 1,
  require: (player: Player) => verifier(player, c().commands["test"]),
  executor: (player: Player, args: string[]) => {
    const input = args[0];

    if (input === "-true") {
      playerConversionStatus.set(player, true);
      player.sendMessage("§aローマ字変換が有効になりました。");
    } else if (input === "-false") {
      playerConversionStatus.set(player, false);
      player.sendMessage("§cローマ字変換が無効になりました。");
    } else {
      player.sendMessage("§c無効な引数です。 '-true' または '-false' を指定してください。");
    }
  },
});             