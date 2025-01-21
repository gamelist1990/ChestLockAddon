/**
 * 起動時間から経過時間を計算する関数
 * @param startTime サーバーの起動時間
 * @returns 経過時間を表す文字列 (例: "0日 4時間 21分 11秒")
 */
export function calculateUptime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;
}