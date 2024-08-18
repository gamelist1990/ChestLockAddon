import { Player, world } from "@minecraft/server";
import { translations as ja_JP } from "./ja_JP";
import { translations as en_US } from "./en_US";
import { translations as zh_CN } from "./zh_CN";
import { translations as ru_RU } from "./ru_RU";
import { translations as ko_KR } from "./ko_KR";
import { translations as fi_FI } from "./fi_FI";

const availableLanguages = ["en_US", "ja_JP", "zh_CN", "ru_RU", "ko_KR", "fi_FI"];
const languageData: { [key: string]: { [key: string]: { msgid: string; msgstr: string } } } = {
  "ja_JP": ja_JP,
  "en_US": en_US,
  "zh_CN": zh_CN,
  "ru_RU": ru_RU,
  "ko_KR": ko_KR,
  "fi_FI": fi_FI
};

const defaultLang = "ja_JP"; // デフォルトの言語を固定

// プレイヤーの言語設定を保存するためのオブジェクト
let playerLangList: Record<string, string> = {};

// 言語設定を保存する関数
export function savePlayerLanguage(player: Player, language: string) {
  playerLangList[player.id] = language;
  const langListJson = JSON.stringify(playerLangList); // JSON 文字列に変換
  world.setDynamicProperty("playerLangList", langListJson); // ダイナミックプロパティに保存
}

// 言語設定をロードする関数
export function loadPlayerLanguages() {
  const storedLangList = world.getDynamicProperty("playerLangList");
  if (storedLangList) {
    playerLangList = JSON.parse(storedLangList as string); // JSON 文字列をパース
  }
}

export function getAvailableLanguages() {
  return availableLanguages;
}

export function showPlayerLanguage(player: Player) {
  player.sendMessage(`§aPlayer Language List: ${JSON.stringify(playerLangList)}`);
  console.warn(`Player Language List: ${JSON.stringify(playerLangList)}`);
  return playerLangList; // playerLangList を返す
}

export function savePlayerLanguages() {
  const data = JSON.stringify(playerLangList);
  world.setDynamicProperty("playerLangList", data);
}

export function resetPlayerLanguages(player: Player) {
  playerLangList = {};
  savePlayerLanguages();
  player.sendMessage(translate(player, "lang_removeData"));
  console.warn("Player languages data has been reset.");
}

export function changeLanguage(player: Player, language: string) {
  if (availableLanguages.includes(language)) {
    savePlayerLanguage(player, language);
    console.warn(`Language changed to ${language} for player ${player.id}`);
    return true;
  }
  console.warn(`Failed to change language for player ${player.id}`);
  return false;
}

export function getPlayerLanguage(player: Player) {
  return playerLangList[player.id] || defaultLang;
}

export function translate(player: Player | null, key: string, params?: Record<string, any>, targetPlayer?: Player): string {
  const language = player ? getPlayerLanguage(player) : defaultLang;
  const langData = languageData[language];

  let translatedText = key; // デフォルトではキーを返す

  if (langData && langData[key]) {
    translatedText = langData[key].msgstr || langData[key].msgid;

    // パラメータを置換
    if (params) {
      for (const paramKey in params) {
        const paramValue = params[paramKey];
        translatedText = translatedText.replace(`{${paramKey}}`, paramValue);
      }
    }
  }

  // プレイヤー名を置換
  if (player) {
    translatedText = translatedText.replace("{playerName}", player.name);
  }

  // ターゲットプレイヤーが存在する場合は通知を送信
  if (targetPlayer) {
    targetPlayer.sendMessage(translatedText);
  }

  return translatedText;
}
