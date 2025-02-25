// src/utils/timeUtils.ts
import { system } from '@minecraft/server';

let serverStartTime: number | null = null;

export function formatTimestamp(
    timestamp: string | number | Date,
    timezoneOffsetHours: number,
): string {
    if (timestamp == null) {
        return '';
    }

    let date: Date;

    try {
        if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string') {
            const parsedDate = new Date(Date.parse(timestamp));
            if (isNaN(parsedDate.getTime())) {
                console.error('Invalid timestamp string:', timestamp);
                return 'Invalid Timestamp';
            }
            date = parsedDate;
        } else {
            console.error('Invalid timestamp type:', timestamp, typeof timestamp);
            return 'Invalid Timestamp';
        }

        if (isNaN(date.getTime())) {
            console.error('Invalid timestamp:', timestamp);
            return 'Invalid Timestamp';
        }

        const timezoneOffsetMilliseconds = timezoneOffsetHours * 60 * 60 * 1000;
        const adjustedDate = new Date(date.getTime() + timezoneOffsetMilliseconds);
        const year = adjustedDate.getFullYear();
        const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getDate()).padStart(2, '0');
        const hours = String(adjustedDate.getHours()).padStart(2, '0');
        const minutes = String(adjustedDate.getMinutes()).padStart(2, '0');
        const seconds = String(adjustedDate.getSeconds()).padStart(2, '0');

        const formattedTimestamp = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        return formattedTimestamp;
    } catch (error) {
        console.error('An unexpected error occurred:', error);
        return 'Unexpected Error';
    }
}

export function getServerUptime(): string {
    if (serverStartTime === null) {
        serverStartTime = Date.now();
        return '0d 0h 0m 0s'; // 初回呼び出し時は秒も表示
    }

    const elapsedMilliseconds = Date.now() - serverStartTime;
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const elapsedDays = Math.floor(elapsedHours / 24);

    const hours = elapsedHours % 24;
    const minutes = elapsedMinutes % 60;
    const seconds = elapsedSeconds % 60;

    return `${elapsedDays}d ${hours}h ${minutes}m ${seconds}s`;
}

// system.run を使って定期的に実行することで、serverStartTime が null でないことを保証
system.runInterval(() => {
    if (serverStartTime === null) {
        serverStartTime = Date.now();
    }
}, 20);

// 日時をフォーマットする関数 (JST)
export function formatTimestampJST(date: Date): string {
    const jstOffset = 9 * 60; // JSTはUTC+9時間なので、分単位でオフセット
    const localDate = new Date(date.getTime() + jstOffset * 60 * 1000);

    const hours = localDate.getUTCHours().toString().padStart(2, '0');
    const minutes = localDate.getUTCMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
}