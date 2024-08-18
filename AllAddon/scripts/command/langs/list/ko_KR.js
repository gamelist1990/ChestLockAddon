export const translations = {
    //main
    "PlayerNotFound": {
        msgid: "PlayerNotFound!! Make sure you're really there",
        msgstr: "플레이어를 찾을 수 없습니다!! 당신이 정말로 거기에 있는지 확인하세요."
    },
    "Developer commands": {
        msgid: "Developer commands!!",
        msgstr: "개발자 명령!!"
    },
    //help Command 
    "available_commands": {
        msgid: "Current available commands",
        msgstr: "현재 사용 가능한 명령어"
    },
    "help_command_description": {
        msgid: "help command",
        msgstr: "help 명령어"
    },
    //lang command
    "lang_removeData": {
        msgid: "Language data deletion complete",
        msgstr: "언어 데이터 삭제 완료"
    },
    "lang_docs": {
        msgid: "lang Command",
        msgstr: "언어 명령어"
    },
    "lang_list": {
        msgid: "§aAvailable Languages:\n",
        msgstr: "§a사용 가능한 언어:\n"
    },
    "lang_change": {
        msgid: "§aLanguage changed to",
        msgstr: "§a언어가 변경되었습니다."
    },
    "lang_failed": {
        msgid: "§cFailed to change language to",
        msgstr: "§c언어 변경에 실패했습니다."
    },
    "lang_invalid": {
        msgid: "§cInvalid command usage. Use lang list or lang change <language_code>",
        msgstr: "§c잘못된 명령어 사용법입니다. lang list 또는 lang change <language_code>를 사용하세요."
    },
    //Chest Command 
    "chest_command": {
        msgid: "Chest Command",
        msgstr: "상자 명령어"
    },
    "unavailable": {
        msgid: "§cLack of authority",
        msgstr: "§c권한이 부족합니다."
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
        msgstr: `§c잘못된 명령어입니다.
  §a상자 보호 명령어 사용법:
  §bchest lock - 상자를 잠급니다.
  §bchest info - 가장 가까운 상자에 대한 정보를 표시합니다.
  §bchest unlock - 상자를 잠금 해제합니다.
  §bchest protect <lock/unlock> - 상자 보호를 토글합니다.
  §bchest add <playername> - 상자에 멤버를 추가합니다.
  §bchest remove <playername> - 상자에서 멤버를 제거합니다.
  §bchest all - 상자 멤버 목록을 표시합니다.
  §b_______________________________________
  §b제작자: Koukun - 라이선스 AGPL-3.0 
  §bYoutubeURL - https://www.youtube.com/@PEXkoukunn
  `
    },
    "nearby_chest_info": {
        msgid: "§a---- Nearby Chest Info ----",
        msgstr: "§a---- 근처 상자 정보 ----"
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
        msgstr: "§a보호됨"
    },
    "owner": {
        msgid: "§bOwner: §e",
        msgstr: "§b소유자: §e"
    },
    "members": {
        msgid: "§bMembers: §e",
        msgstr: "§b멤버: §e"
    },
    "large_chest": {
        msgid: "§bLarge Chest: §e",
        msgstr: "§b큰 상자: §e"
    },
    "yes": {
        msgid: "Yes",
        msgstr: "예"
    },
    "no": {
        msgid: "No",
        msgstr: "아니요"
    },
    "not_protected": {
        msgid: "§cNot Protected",
        msgstr: "§c보호되지 않음"
    },
    "notFound_chest": {
        msgid: "§cCan't find chest",
        msgstr: "§c상자를 찾을 수 없습니다."
    },
    "chestProtectRemove": {
        msgid: "§a Chest protection removed",
        msgstr: "§a상자 보호가 제거되었습니다."
    },
    "AlreadyProChest": {
        msgid: "§a This chest is already protected",
        msgstr: "§a이 상자는 이미 보호되어 있습니다."
    },
    "NotAllowed": {
        msgid: "§c Not allowed",
        msgstr: "§c허용되지 않음"
    },
    "chest_lookstate": {
        msgid: `§a chest protected`,
        msgstr: `§a상자 보호됨`
    },
    "chest_removeData": {
        msgid: `§aAll chest protection data has been reset.`,
        msgstr: `§a모든 상자 보호 데이터가 초기화되었습니다.`
    },
    "isLookChest": {
        msgid: `§cThis chest is locked`,
        msgstr: `§c이 상자는 잠겨 있습니다.`
    },
    "isProChest": {
        msgid: `§c This chest is protected!`,
        msgstr: `§c이 상자는 보호되어 있습니다!`
    },
    "ProChestBreak": {
        msgid: `§a Protected chest has been destroyed. Protected data also deleted.`,
        msgstr: `§a보호된 상자가 파괴되었습니다. 보호된 데이터도 삭제되었습니다.`
    },
    "lockChange": {
        //@ts-ignore
        msgid: `§a Protection state of chest is changed to`,
        //@ts-ignore
        msgstr: `§a상자의 보호 상태가 변경되었습니다.`
    },
    "NotChest": {
        msgid: `§cYou are not authorized to operate this chest.`,
        msgstr: `§c이 상자를 조작할 권한이 없습니다.`
    },
    "AddM": {
        msgid: `§a Added  as a member.`,
        msgstr: `§a멤버로 추가되었습니다.`
    },
    "addYouM": {
        msgid: `§aThis{playerName}has added you to the following chests{chestLocation}`,
        msgstr: `§a이 {playerName}님이 다음 상자에 당신을 추가했습니다: {chestLocation}의 상자`
    },
    "RemoveYouM": {
        msgid: `§aThis{playerName}has removed you from members in the following chests{chestLocation}`,
        msgstr: `§a이 {playerName}님이 다음 상자의 멤버에서 당신을 제거했습니다: {chestLocation}의 상자`
    },
    "MAlreday": {
        //@ts-ignore
        msgid: `§cis already a member. `,
        //@ts-ignore
        msgstr: `§c이미 멤버입니다.`
    },
    "RemoveM": {
        //@ts-ignore
        msgid: `§aRemoved from members`,
        //@ts-ignore
        msgstr: `§a멤버에서 제거되었습니다.`
    },
    "NotM": {
        //@ts-ignore
        msgid: `§cis not a member`,
        //@ts-ignore
        msgstr: `§c멤버가 아닙니다.`
    },
    "allM": {
        //@ts-ignore
        msgid: `§a member: `,
        //@ts-ignore
        msgstr: `§a멤버: `
    },
    "NotFoundM": {
        msgid: `§c No members`,
        msgstr: `§c멤버가 없습니다.`
    },
    "ExplosionWarning": {
        msgid: `§c Can you please not blow that up?`,
        msgstr: `§c제발 폭파하지 말아주세요!`
    },
    "cannotPlaceItem": {
        msgid: `§c It is forbidden to place pistons in this area`,
        msgstr: `§c이 지역에 피스톤을 설치하는 것은 금지되어 있습니다.`
    },
};
