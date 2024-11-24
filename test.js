"use strict";
const defaultData = {
    flag: false,
    check: true,
};
let main = defaultData;
function startFlag() {
    main.flag = true;
    console.log(`flag変数が${main.flag}になりました`);
}
function endFlag() {
    main.flag = false;
    console.log(`flag変数が${main.flag}になりました`);
}
function check() {
    if (main.check === false)
        return;
    console.log(`現在のフラグは${main.flag}です`);
}
async function functionStart() {
    console.log("フラグをTrueにします");
    startFlag();
    await new Promise(a => setTimeout(a, 2000));
    console.log("フラグをFalseにします");
    endFlag();
    await new Promise(i => setTimeout(i, 1000));
    check();
    console.log("全ての処理が完了しました");
}
functionStart();
