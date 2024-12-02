
## PlayerMessage Event

### Body
```typescript
interface PlayerMessage {
  message: string;         // メッセージ内容
  receiver: string;        // 受信者
  sender: string;          // 送信者
  type: 'chat' | 'tell' | 'me' | 'say' | 'title';  // メッセージのタイプ
}
```

### Header
```typescript
interface EventHeader {
  eventName: string;       // イベント名
  messagePurpose: string;  // メッセージの目的
  version: number;         // バージョン
}

const header: EventHeader = {
  eventName: "PlayerMessage",
  messagePurpose: "event",
  version: 17039360
};
```
