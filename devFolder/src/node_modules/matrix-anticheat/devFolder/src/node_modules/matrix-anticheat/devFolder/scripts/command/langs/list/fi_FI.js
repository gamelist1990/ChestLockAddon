export const translations = {
    //main
    "PlayerNotFound": {
        msgid: "PlayerNotFound!! Make sure you're really there",
        msgstr: "Pelaajaa ei löydy!! Varmista, että olet todella paikalla."
    },
    "Developer commands": {
        msgid: "Developer commands!!",
        msgstr: "Kehittäjäkomennot!!"
    },
    //help Command 
    "available_commands": {
        msgid: "Current available commands",
        msgstr: "Tällä hetkellä käytettävissä olevat komennot"
    },
    "help_command_description": {
        msgid: "help command",
        msgstr: "help-komento"
    },
    "lang_removeData": {
        msgid: "Language data deletion complete",
        msgstr: "Kielitietojen poistaminen valmis"
    },
    //lang command
    "lang_docs": {
        msgid: "lang Command",
        msgstr: "Kielikomento"
    },
    "lang_list": {
        msgid: "§aAvailable Languages:\n",
        msgstr: "§aKäytettävissä olevat kielet:\n"
    },
    "lang_change": {
        msgid: "§aLanguage changed to",
        msgstr: "§aKieli vaihdettu"
    },
    "lang_failed": {
        msgid: "§cFailed to change language to",
        msgstr: "§cKielen vaihto epäonnistui"
    },
    "lang_invalid": {
        msgid: "§cInvalid command usage. Use lang list or lang change <language_code>",
        msgstr: "§cVirheellinen komennon käyttö. Käytä lang list tai lang change <language_code>"
    },
    //Chest Command 
    "chest_command": {
        msgid: "Chest Command",
        msgstr: "Arkku-komento"
    },
    "unavailable": {
        msgid: "§cLack of authority",
        msgstr: "§cEi valtuuksia"
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
        msgstr: `§cVirheellinen komento.
  §aArkun suojaus komennon käyttö:
  §bchest lock - lukitsee arkun
  §bchest info - näyttää tiedot lähimmästä arkusta
  §bchest unlock - avaa arkun lukituksen
  §bchest protect <lock/unlock> - vaihtaa arkun suojauksen tilaa
  §bchest add <playername> - lisää jäsenen arkkuun
  §bchest remove <playername> - poistaa jäsenen arkusta
  §bchest all - näyttää luettelon arkun jäsenistä
  §b_______________________________________
  §bTekijä: Koukun - Lisenssi AGPL-3.0 
  §bYoutubeURL - https://www.youtube.com/@PEXkoukunn
  `
    },
    "nearby_chest_info": {
        msgid: "§a---- Nearby Chest Info ----",
        msgstr: "§a---- Lähellä olevan arkun tiedot ----"
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
        msgstr: "§aSuojattu"
    },
    "owner": {
        msgid: "§bOwner: §e",
        msgstr: "§bOmistaja: §e"
    },
    "members": {
        msgid: "§bMembers: §e",
        msgstr: "§bJäsenet: §e"
    },
    "large_chest": {
        msgid: "§bLarge Chest: §e",
        msgstr: "§bIso arkku: §e"
    },
    "yes": {
        msgid: "Yes",
        msgstr: "Kyllä"
    },
    "no": {
        msgid: "No",
        msgstr: "Ei"
    },
    "not_protected": {
        msgid: "§cNot Protected",
        msgstr: "§cEi suojattu"
    },
    "notFound_chest": {
        msgid: "§cCan't find chest",
        msgstr: "§cArkkua ei löydy"
    },
    "chestProtectRemove": {
        msgid: "§a Chest protection removed",
        msgstr: "§aArkun suojaus poistettu"
    },
    "AlreadyProChest": {
        msgid: "§a This chest is already protected",
        msgstr: "§aTämä arkku on jo suojattu"
    },
    "NotAllowed": {
        msgid: "§c Not allowed",
        msgstr: "§cEi sallittu"
    },
    "chest_lookstate": {
        msgid: `§a chest protected`,
        msgstr: `§aArkku suojattu`
    },
    "chest_removeData": {
        msgid: `§aAll chest protection data has been reset.`,
        msgstr: `§aKaikki arkun suojaus tiedot on nollattu.`
    },
    "isLookChest": {
        msgid: `§cThis chest is locked`,
        msgstr: `§cTämä arkku on lukittu`
    },
    "isProChest": {
        msgid: `§c This chest is protected!`,
        msgstr: `§cTämä arkku on suojattu!`
    },
    "ProChestBreak": {
        msgid: `§a Protected chest has been destroyed. Protected data also deleted.`,
        msgstr: `§aSuojattu arkku on tuhottu. Suojatut tiedot on myös poistettu.`
    },
    "lockChange": {
        //@ts-ignore
        msgid: `§a Protection state of chest is changed to`,
        //@ts-ignore
        msgstr: `§aArkun suojauksen tila on vaihdettu`
    },
    "NotChest": {
        msgid: `§cYou are not authorized to operate this chest.`,
        msgstr: `§cSinulla ei ole oikeutta käyttää tätä arkkua.`
    },
    "AddM": {
        msgid: `§a Added  as a member.`,
        msgstr: `§aLisätty jäseneksi.`
    },
    "addYouM": {
        msgid: `§aThis{playerName}has added you to the following chests{chestLocation}`,
        msgstr: `§aTämä {playerName} on lisännyt sinut seuraaviin arkuihin: {chestLocation}`
    },
    "RemoveYouM": {
        msgid: `§aThis{playerName}has removed you from members in the following chests{chestLocation}`,
        msgstr: `§aTämä {playerName} on poistanut sinut seuraavien arkkujen jäsenistä: {chestLocation}`
    },
    "MAlreday": {
        //@ts-ignore
        msgid: `§cis already a member. `,
        //@ts-ignore
        msgstr: `§con jo jäsen.`
    },
    "RemoveM": {
        //@ts-ignore
        msgid: `§aRemoved from members`,
        //@ts-ignore
        msgstr: `§aPoistettu jäsenistä`
    },
    "NotM": {
        //@ts-ignore
        msgid: `§cis not a member`,
        //@ts-ignore
        msgstr: `§cei ole jäsen`
    },
    "allM": {
        //@ts-ignore
        msgid: `§a member: `,
        //@ts-ignore
        msgstr: `§aJäsen: `
    },
    "NotFoundM": {
        msgid: `§c No members`,
        msgstr: `§cEi jäseniä`
    },
    "ExplosionWarning": {
        msgid: `§c Can you please not blow that up?`,
        msgstr: `§cVoisitko olla räjäyttämättä sitä?`
    },
    "cannotPlaceItem": {
        msgid: `§c It is forbidden to place pistons in this area`,
        msgstr: `§cMäntien sijoittaminen tälle alueelle on kielletty`
    },
};
