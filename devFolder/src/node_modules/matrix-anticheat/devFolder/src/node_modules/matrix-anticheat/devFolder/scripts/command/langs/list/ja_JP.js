export const translations = {
    //main
    "PlayerNotFound": {
        msgid: "PlayerNotFound!! Make sure you're really there",
        msgstr: "このプレイヤーが見つかりません！！"
    },
    "Developer commands": {
        msgid: "Developer commands!!",
        msgstr: "デベロッパー専用コマンド(tag OPが必要)"
    },
    //help Command 
    "available_commands": {
        msgid: "Current available commands",
        msgstr: "現在使用可能なコマンド"
    },
    "help_command_description": {
        msgid: "help command",
        msgstr: "helpコマンド こっちの都合により説明だけ英語に出来なくてごめん！"
    },
    //lang command
    "lang_removeData": {
        msgid: "Language data deletion complete",
        msgstr: "言語データをリセットしました"
    },
    "lang_docs": {
        msgid: "lang Command",
        msgstr: "Lang コマンド"
    },
    "lang_list": {
        msgid: "§aAvailable Languages:\n",
        msgstr: "§a使用可能な言語:\n"
    },
    "lang_change": {
        msgid: "§aLanguage changed to",
        msgstr: "§a言語が変更されました"
    },
    "lang_failed": {
        msgid: "§cFailed to change language to",
        msgstr: "§c言語を変更できませんでした "
    },
    "lang_invalid": {
        msgid: "§cInvalid command usage. Use lang list or lang change <language_code>",
        msgstr: "§c無効なコマンドの使用法です。 lang list または lang change <language_code> を使用してね"
    },
    //Chest Command 
    "chest_command": {
        msgid: "Chest Command",
        msgstr: "チェストを保護するコマンド"
    },
    "unavailable": {
        msgid: "§cLack of authority",
        msgstr: " §cこのコマンドを使用する権限がありません"
    },
    "chest_help": {
        msgid: `§cInvalid command.
§aChest protection command usage:.
  §bchest lock - locks the chest
  §bchest info - displays information about the nearest chest
  §bchest unlock - unlocks the chest
  §bchest protect <lock/unlock> - toggles chest protection
  §bchest add <playername> - add a member to the chest
  §bchest remove <playername> - remove a member of a chest
  §bchest all - displays a list of chest members
  §b_______________________________________
  §bAuthor: Koukun - License AGPL-3.0 
  §bYoutubeURL - https://www.youtube.com/@PEXkoukunn
  `,
        msgstr: `§c無効なコマンドです。
§aチェスト保護コマンドの使用方法:
  §bchest lock        - チェストをロックします
  §bchest info       - 近くのチェストの情報を表示します
  §bchest unlock      - チェストのロックを解除します
  §bchest protect <lock/unlock> - チェストの保護状態を切り替えます
  §bchest add <playername>   - チェストのメンバーを追加します
  §bchest remove <playername>  - チェストのメンバーを削除します
  §bchest all        - チェストのメンバー一覧を表示します
  §b_______________________________________
  §b作者: こう君        - License AGPL-3.0 
  §bYoutubeURL         - https://www.youtube.com/@PEXkoukunn
  `
    },
    "nearby_chest_info": {
        msgid: "§a---- Nearby Chest Info ----",
        msgstr: "§a---- 近くのチェスト情報 ----"
    },
    "coordinate_x": {
        msgid: "§bX: §e",
        msgstr: "§bX: §e"
    },
    "coordinate_y": {
        msgid: "§bY: §e",
        msgstr: "§bY: §e"
    },
    "coordinate_z": {
        msgid: "§bZ: §e",
        msgstr: "§bZ: §e"
    },
    "protected": {
        msgid: "§aProtected",
        msgstr: "§a保護されています"
    },
    "owner": {
        msgid: "§bOwner: §e",
        msgstr: "§b所有者: §e"
    },
    "members": {
        msgid: "§bMembers: §e",
        msgstr: "§bメンバー: §e"
    },
    "large_chest": {
        msgid: "§bLarge Chest: §e",
        msgstr: "§bラージチェスト: §e"
    },
    "yes": {
        msgid: "Yes",
        msgstr: "はい"
    },
    "no": {
        msgid: "No",
        msgstr: "いいえ"
    },
    "not_protected": {
        msgid: "§cNot Protected",
        msgstr: "§c保護されていません"
    },
    "notFound_chest": {
        msgid: "§cCan't find chest",
        msgstr: "§cチェストが見つかりませんでした。"
    },
    "chestProtectRemove": {
        msgid: "§a Chest protection removed",
        msgstr: "§aチェストの保護を解除しました"
    },
    "AlreadyProChest": {
        msgid: "§a This chest is already protected",
        msgstr: "§a このチェストは既に保護されています。"
    },
    "NotAllowed": {
        msgid: "§c Not allowed",
        msgstr: "§c 許可されていません"
    },
    "chest_lookstate": {
        msgid: `§a chest protected`,
        msgstr: `§aチェストを保護しました`
    },
    "chest_removeData": {
        msgid: `§aAll chest protection data has been reset.`,
        msgstr: `§a全てのチェスト保護データをリセットしました。`
    },
    "isLookChest": {
        msgid: `§cThis chest is locked`,
        msgstr: `§cこのチェストはロックされています`
    },
    "isProChest": {
        msgid: `§c This chest is protected!`,
        msgstr: `§cこのチェストは保護されています！！`
    },
    "ProChestBreak": {
        msgid: `§a Protected chest has been destroyed. Protected data also deleted.`,
        msgstr: `§a保護されたチェストを破壊しました。保護データも削除されました。`
    },
    "lockChange": {
        //@ts-ignore
        msgid: `§a Protection state of chest is changed to`,
        //@ts-ignore
        msgstr: `§aチェストの保護状態を変更しました`
    },
    "NotChest": {
        msgid: `§cYou are not authorized to operate this chest.`,
        msgstr: `§cこのチェストを操作する権限がありません。`
    },
    "AddM": {
        msgid: `§a Added  as a member.`,
        msgstr: `§aをメンバーに追加しました。`
    },
    "addYouM": {
        msgid: `§aThis{playerName}has added you to the following chests{chestLocation}`,
        msgstr: `§a{playerName}があなたを以下のチェストのメンバーに追加しました:\n{chestLocation}のチェスト`
    },
    "RemoveYouM": {
        msgid: `§aThis{playerName}has removed you from members in the following chests{chestLocation}`,
        msgstr: `§a{playerName}があなたを以下のチェストのメンバーから削除しました:\n{chestLocation}のチェスト`
    },
    "MAlreday": {
        //@ts-ignore
        msgid: `§cis already a member. `,
        //@ts-ignore
        msgstr: `§cは既にメンバーです。`
    },
    "RemoveM": {
        //@ts-ignore
        msgid: `§aRemoved from members`,
        //@ts-ignore
        msgstr: `§aをメンバーから削除しました。`
    },
    "NotM": {
        //@ts-ignore
        msgid: `§cis not a member`,
        //@ts-ignore
        msgstr: `§cはメンバーではありません。`
    },
    "allM": {
        //@ts-ignore
        msgid: `§a member: `,
        //@ts-ignore
        msgstr: `§aメンバー: `
    },
    "NotFoundM": {
        msgid: `§c No members`,
        msgstr: `§c メンバーがいません`
    },
    "ExplosionWarning": {
        msgid: `§c Can you please not blow that up?`,
        msgstr: `§c このチェストは無敵です`
    },
    "cannotPlaceItem": {
        msgid: `§c It is forbidden to place pistons in this area`,
        msgstr: `§c このエリアにこのアイテムを置く事は禁止されています`
    },
};
