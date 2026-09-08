# hojokin-portal
補助金や助成金検索用ポータルサイト（OPS GSS）

## 通知のしくみ

Netlify のスケジュール関数 `netlify/functions/send-push.mjs` が毎日 UTC 23:45（日本時間 8:45）に起動し、
`news.json` を前回実行時と比較して新着項目があれば通知します。通知先は2系統です。

1. **Web プッシュ通知** … サイトで購読したブラウザへ配信
2. **Chatwork 投稿** … 指定ルームへ新着一覧を投稿

新着が0件の日は、どちらも送信しません。Chatwork 側でエラーが出ても Web プッシュは継続します。

## Chatwork 連携の設定

Netlify の管理画面 → Site configuration → Environment variables に以下を登録してください。
（トークンはリポジトリにコミットしないこと）

| 変数名 | 必須 | 内容 |
| --- | --- | --- |
| `CHATWORK_TOKEN` | 必須 | Chatwork の API トークン。Chatwork にログイン → 右上アイコン → サービス連携 → API トークン から取得 |
| `CHATWORK_ROOM_ID` | 必須 | 投稿先ルームID。Chatwork でルームを開いた時の URL 末尾 `#!rid●●●●●●●` の数字部分。カンマ区切りで複数ルーム指定可 |
| `CHATWORK_TO` | 任意 | 本文冒頭に付ける宛先タグ。全員宛なら `[toall]`、個人宛なら `[To:1234567]上原さん` |
| `CHATWORK_MAX_ITEMS` | 任意 | 本文に列挙する最大件数（既定 10）。超過分は「ほか N件」と表示 |
| `ADMIN_KEY` | 任意 | 疎通確認エンドポイントを使う場合の合言葉（任意の文字列） |

`CHATWORK_TOKEN` か `CHATWORK_ROOM_ID` が未設定の場合、Chatwork 投稿は自動的にスキップされ、
Web プッシュのみが従来どおり動作します。

### 疎通確認

`ADMIN_KEY` を設定したうえで、ブラウザから以下を開くと Chatwork へテスト投稿できます。
通知済み状態には影響しないため、何度実行しても日次通知は狂いません。

```
https://ops-gss.netlify.app/.netlify/functions/chatwork-test?key=<ADMIN_KEY>
https://ops-gss.netlify.app/.netlify/functions/chatwork-test?key=<ADMIN_KEY>&mode=latest
```

`mode=latest` は `news.json` の最新3件を実際の通知と同じ書式で投稿します。

## ファイル構成

| パス | 役割 |
| --- | --- |
| `index.html` | ポータル本体 |
| `news.json` | 関連新着情報（日次の自動収集タスクが更新） |
| `sources.json` | 巡回対象機関リスト |
| `netlify/functions/send-push.mjs` | 日次通知（Web プッシュ＋Chatwork） |
| `netlify/functions/subscribe.mjs` | Web プッシュ購読の登録 |
| `netlify/functions/chatwork-test.mjs` | Chatwork 疎通確認（手動） |
| `netlify/lib/chatwork.mjs` | Chatwork 投稿ユーティリティ |
