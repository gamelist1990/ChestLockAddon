export const translations = {
    //main
    "PlayerNotFound": {
        msgid: "PlayerNotFound!! Make sure you're really there",
        msgstr: "Игрок не найден!! Убедитесь, что вы действительно там."
    },
    "Developer commands": {
        msgid: "Developer commands!!",
        msgstr: "Разработчик командует!!!"
    },
    //help Command 
    "available_commands": {
        msgid: "Current available commands",
        msgstr: "Текущие доступные команды"
    },
    "help_command_description": {
        msgid: "help command",
        msgstr: "Команда help"
    },
    //lang command
    "lang_removeData": {
        msgid: "Language data deletion complete",
        msgstr: "Удаление языковых данных завершено"
    },
    "lang_docs": {
        msgid: "lang Command",
        msgstr: "Команда lang"
    },
    "lang_list": {
        msgid: "§aAvailable Languages:\n",
        msgstr: "§aДоступные языки:\n"
    },
    "lang_change": {
        msgid: "§aLanguage changed to",
        msgstr: "§aЯзык изменен на"
    },
    "lang_failed": {
        msgid: "§cFailed to change language to",
        msgstr: "§cНе удалось изменить язык на"
    },
    "lang_invalid": {
        msgid: "§cInvalid command usage. Use lang list or lang change <language_code>",
        msgstr: "§cНеверное использование команды. Используйте lang list или lang change <language_code>"
    },
    //Chest Command 
    "chest_command": {
        msgid: "Chest Command",
        msgstr: "Команда сундука"
    },
    "unavailable": {
        msgid: "§cLack of authority",
        msgstr: "§cНедостаточно прав"
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
        msgstr: `§cНеверная команда.
  §aИспользование команды защиты сундука:
  §bchest lock - блокирует сундук
  §bchest info - отображает информацию о ближайшем сундуке
  §bchest unlock - разблокирует сундук
  §bchest protect <lock/unlock> - переключает защиту сундука
  §bchest add <playername> - добавляет участника к сундуку
  §bchest remove <playername> - удаляет участника из сундука
  §bchest all - отображает список участников сундука
  §b_______________________________________
  §bАвтор: Koukun - Лицензия AGPL-3.0 
  §bYoutubeURL - https://www.youtube.com/@PEXkoukunn
  `
    },
    "nearby_chest_info": {
        msgid: "§a---- Nearby Chest Info ----",
        msgstr: "§a---- Информация о ближайшем сундуке ----"
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
        msgstr: "§aЗащищено"
    },
    "owner": {
        msgid: "§bOwner: §e",
        msgstr: "§bВладелец: §e"
    },
    "members": {
        msgid: "§bMembers: §e",
        msgstr: "§bУчастники: §e"
    },
    "large_chest": {
        msgid: "§bLarge Chest: §e",
        msgstr: "§bБольшой сундук: §e"
    },
    "yes": {
        msgid: "Yes",
        msgstr: "Да"
    },
    "no": {
        msgid: "No",
        msgstr: "Нет"
    },
    "not_protected": {
        msgid: "§cNot Protected",
        msgstr: "§cНе защищено"
    },
    "notFound_chest": {
        msgid: "§cCan't find chest",
        msgstr: "§cНе удалось найти сундук"
    },
    "chestProtectRemove": {
        msgid: "§a Chest protection removed",
        msgstr: "§aЗащита сундука снята"
    },
    "AlreadyProChest": {
        msgid: "§a This chest is already protected",
        msgstr: "§aЭтот сундук уже защищен"
    },
    "NotAllowed": {
        msgid: "§c Not allowed",
        msgstr: "§cНе разрешено"
    },
    "chest_lookstate": {
        msgid: `§a chest protected`,
        msgstr: `§aСундук защищен`
    },
    "chest_removeData": {
        msgid: `§aAll chest protection data has been reset.`,
        msgstr: `§aВсе данные защиты сундука были сброшены.`
    },
    "isLookChest": {
        msgid: `§cThis chest is locked`,
        msgstr: `§cЭтот сундук заблокирован`
    },
    "isProChest": {
        msgid: `§c This chest is protected!`,
        msgstr: `§cЭтот сундук защищен!`
    },
    "ProChestBreak": {
        msgid: `§a Protected chest has been destroyed. Protected data also deleted.`,
        msgstr: `§aЗащищенный сундук был уничтожен. Защищенные данные также удалены.`
    },
    "lockChange": {
        //@ts-ignore
        msgid: `§a Protection state of chest is changed to`,
        //@ts-ignore
        msgstr: `§aСостояние защиты сундука изменено на`
    },
    "NotChest": {
        msgid: `§cYou are not authorized to operate this chest.`,
        msgstr: `§cУ вас нет прав на управление этим сундуком.`
    },
    "AddM": {
        msgid: `§a Added  as a member.`,
        msgstr: `§aДобавлен в качестве участника.`
    },
    "addYouM": {
        msgid: `§aThis{playerName}has added you to the following chests{chestLocation}`,
        msgstr: `§aЭтот {playerName} добавил вас в следующие сундуки: {chestLocation}`
    },
    "RemoveYouM": {
        msgid: `§aThis{playerName}has removed you from members in the following chests{chestLocation}`,
        msgstr: `§aЭтот {playerName} удалил вас из участников следующих сундуков: {chestLocation}`
    },
    "MAlreday": {
        //@ts-ignore
        msgid: `§cis already a member. `,
        //@ts-ignore
        msgstr: `§cуже является участником.`
    },
    "RemoveM": {
        //@ts-ignore
        msgid: `§aRemoved from members`,
        //@ts-ignore
        msgstr: `§aУдален из участников`
    },
    "NotM": {
        //@ts-ignore
        msgid: `§cis not a member`,
        //@ts-ignore
        msgstr: `§cне является участником`
    },
    "allM": {
        //@ts-ignore
        msgid: `§a member: `,
        //@ts-ignore
        msgstr: `§aУчастник: `
    },
    "NotFoundM": {
        msgid: `§c No members`,
        msgstr: `§cНет участников`
    },
    "ExplosionWarning": {
        msgid: `§c Can you please not blow that up?`,
        msgstr: `§cПожалуйста, не взрывайте это!`
    },
    "cannotPlaceItem": {
        msgid: `§c It is forbidden to place pistons in this area`,
        msgstr: `§cЗапрещено размещать поршни в этой области`
    },
};
