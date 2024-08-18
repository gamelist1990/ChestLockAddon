export const translations = {
    //main
    "PlayerNotFound": {
        msgid: "PlayerNotFound!! Make sure you're really there",
        msgstr: "找不到玩家！请确认您真的在那里"
    },
    "Developer commands": {
        msgid: "Developer commands!!",
        msgstr: "开发人员命令"
    },
    //help Command 
    "available_commands": {
        msgid: "Current available commands",
        msgstr: "当前可用命令"
    },
    "help_command_description": {
        msgid: "help command",
        msgstr: "帮助命令"
    },
    //lang command
    "lang_removeData": {
        msgid: "Language data deletion complete",
        msgstr: "语言数据删除完毕"
    },
    "lang_docs": {
        msgid: "lang Command",
        msgstr: "语言命令"
    },
    "lang_list": {
        msgid: "§aAvailable Languages:\n",
        msgstr: "§a可用语言：\n"
    },
    "lang_change": {
        msgid: "§aLanguage changed to",
        msgstr: "§a语言已更改为"
    },
    "lang_failed": {
        msgid: "§cFailed to change language to",
        msgstr: "§c无法将语言更改为"
    },
    "lang_invalid": {
        msgid: "§cInvalid command usage. Use lang list or lang change <language_code>",
        msgstr: "§c无效的命令用法。请使用 lang list 或 lang change <language_code>"
    },
    //Chest Command 
    "chest_command": {
        msgid: "Chest Command",
        msgstr: "箱子命令"
    },
    "unavailable": {
        msgid: "§cLack of authority",
        msgstr: "§c权限不足"
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
        msgstr: `§c无效命令。
  §a箱子保护命令用法：
  §bchest lock - 锁定箱子
  §bchest info - 显示最近箱子的信息
  §bchest unlock - 解锁箱子
  §bchest protect <lock/unlock> - 切换箱子保护
  §bchest add <playername> - 添加成员到箱子
  §bchest remove <playername> - 从箱子中移除成员
  §bchest all - 显示箱子成员列表
  §b_______________________________________
  §b作者：Koukun - 许可证 AGPL-3.0 
  §bYoutubeURL - https://www.youtube.com/@PEXkoukunn
  `
    },
    "nearby_chest_info": {
        msgid: "§a---- Nearby Chest Info ----",
        msgstr: "§a---- 附近箱子信息 ----"
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
        msgstr: "§a已保护"
    },
    "owner": {
        msgid: "§bOwner: §e",
        msgstr: "§b所有者: §e"
    },
    "members": {
        msgid: "§bMembers: §e",
        msgstr: "§b成员: §e"
    },
    "large_chest": {
        msgid: "§bLarge Chest: §e",
        msgstr: "§b大箱子: §e"
    },
    "yes": {
        msgid: "Yes",
        msgstr: "是"
    },
    "no": {
        msgid: "No",
        msgstr: "否"
    },
    "not_protected": {
        msgid: "§cNot Protected",
        msgstr: "§c未保护"
    },
    "notFound_chest": {
        msgid: "§cCan't find chest",
        msgstr: "§c找不到箱子"
    },
    "chestProtectRemove": {
        msgid: "§a Chest protection removed",
        msgstr: "§a箱子保护已移除"
    },
    "AlreadyProChest": {
        msgid: "§a This chest is already protected",
        msgstr: "§a此箱子已受保护"
    },
    "NotAllowed": {
        msgid: "§c Not allowed",
        msgstr: "§c不允许"
    },
    "chest_lookstate": {
        msgid: `§a chest protected`,
        msgstr: `§a箱子已保护`
    },
    "chest_removeData": {
        msgid: `§aAll chest protection data has been reset.`,
        msgstr: `§a所有箱子保护数据已重置。`
    },
    "isLookChest": {
        msgid: `§cThis chest is locked`,
        msgstr: `§c此箱子已锁定`
    },
    "isProChest": {
        msgid: `§c This chest is protected!`,
        msgstr: `§c此箱子已受保护！`
    },
    "ProChestBreak": {
        msgid: `§a Protected chest has been destroyed. Protected data also deleted.`,
        msgstr: `§a受保护的箱子已被破坏。保护数据也已删除。`
    },
    "lockChange": {
        //@ts-ignore
        msgid: `§a Protection state of chest is changed to`,
        //@ts-ignore
        msgstr: `§a箱子的保护状态已更改为`
    },
    "NotChest": {
        msgid: `§cYou are not authorized to operate this chest.`,
        msgstr: `§c您无权操作此箱子。`
    },
    "AddM": {
        msgid: `§a Added  as a member.`,
        msgstr: `§a已添加为成员。`
    },
    "addYouM": {
        msgid: `§aThis{playerName}has added you to the following chests{chestLocation}`,
        msgstr: `§a此{playerName}已将您添加到以下箱子：{chestLocation}的箱子`
    },
    "RemoveYouM": {
        msgid: `§aThis{playerName}has removed you from members in the following chests{chestLocation}`,
        msgstr: `§a此{playerName}已将您从以下箱子的成员中移除：{chestLocation}的箱子`
    },
    "MAlreday": {
        //@ts-ignore
        msgid: `§cis already a member. `,
        //@ts-ignore
        msgstr: `§c已经是成员。`
    },
    "RemoveM": {
        //@ts-ignore
        msgid: `§aRemoved from members`,
        //@ts-ignore
        msgstr: `§a已从成员中移除。`
    },
    "NotM": {
        //@ts-ignore
        msgid: `§cis not a member`,
        //@ts-ignore
        msgstr: `§c不是成员。`
    },
    "allM": {
        //@ts-ignore
        msgid: `§a member: `,
        //@ts-ignore
        msgstr: `§a成员：`
    },
    "NotFoundM": {
        msgid: `§c No members`,
        msgstr: `§c没有成员`
    },
    "ExplosionWarning": {
        msgid: `§c Can you please not blow that up?`,
        msgstr: `§c请不要炸掉它！`
    },
    "cannotPlaceItem": {
        msgid: `§c It is forbidden to place pistons in this area`,
        msgstr: `§c禁止在此区域放置活塞`
    },
};
