// Chatwork 投稿ユーティリティ
// 必要な環境変数:
//   CHATWORK_TOKEN    ... Chatwork の API トークン（必須）
//   CHATWORK_ROOM_ID  ... 投稿先ルームID（必須。カンマ区切りで複数指定可）
//   CHATWORK_TO       ... 任意。冒頭に付ける宛先タグ（例: "[toall]" や "[To:1234567]名前さん"）
//   CHATWORK_MAX_ITEMS... 任意。本文に列挙する最大件数（既定 10）

const API_BASE = "https://api.chatwork.com/v2";
const BODY_LIMIT = 5000; // Chatwork の上限より十分小さく抑える
// 全ての自動投稿の末尾に付ける注記（[info]ブロックの外側＝投稿の最終行）
const FOOTER = "\n\nこちらは GSSアプリ の 自動投稿です";

/** 設定済みかどうか（未設定なら送信処理を丸ごとスキップする） */
export function isChatworkConfigured() {
  return Boolean(process.env.CHATWORK_TOKEN && process.env.CHATWORK_ROOM_ID);
}

/** カンマ区切りのルームIDを配列に */
function roomIds() {
  return (process.env.CHATWORK_ROOM_ID || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 単一ルームへ投稿する。
 * @returns {Promise<{roomId:string, ok:boolean, status:number, messageId?:string, error?:string}>}
 */
async function postToRoom(roomId, body) {
  const params = new URLSearchParams({ body, self_unread: "1" });
  try {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": process.env.CHATWORK_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const text = await res.text();
    if (!res.ok) {
      return { roomId, ok: false, status: res.status, error: text.slice(0, 300) };
    }
    let messageId;
    try { messageId = JSON.parse(text).message_id; } catch { /* noop */ }
    return { roomId, ok: true, status: res.status, messageId };
  } catch (e) {
    return { roomId, ok: false, status: 0, error: String(e).slice(0, 300) };
  }
}

/**
 * 設定された全ルームへ投稿する。例外は投げず、必ず結果配列を返す。
 * 本文の末尾には自動投稿である旨の注記（FOOTER）を必ず付ける。
 * 長文を切り詰める場合も注記が消えないよう、切り詰めたあとに付ける。
 * @param {string} body Chatwork 記法の本文
 */
export async function postChatworkMessage(body) {
  if (!isChatworkConfigured()) return [];
  const limit = BODY_LIMIT - FOOTER.length;
  const trimmed =
    (body.length > limit ? body.slice(0, limit - 20) + "\n…(以下省略)" : body) + FOOTER;
  const results = [];
  for (const id of roomIds()) {
    results.push(await postToRoom(id, trimmed));
  }
  return results;
}

/** 制度1件を1ブロックに整形 */
function formatItem(item) {
  const lines = [`▼ ${item.title}`];
  if (item.summary) lines.push(item.summary);
  if (item.url) lines.push(item.url);
  return lines.join("\n");
}

/**
 * 新着リストから Chatwork 本文を組み立てる。
 * @param {Array} freshItems 新着項目
 * @param {string} siteUrl   ポータルのURL
 */
export function buildNewsMessage(freshItems, siteUrl) {
  const max = Number(process.env.CHATWORK_MAX_ITEMS || 10);
  const to = (process.env.CHATWORK_TO || "").trim();
  const shown = freshItems.slice(0, max);
  const rest = freshItems.length - shown.length;

  const parts = [];
  if (to) parts.push(to);
  parts.push(`[info][title]OPS GSS｜関連補助金・助成金の新着 ${freshItems.length}件[/title]`);
  parts.push(shown.map(formatItem).join("\n\n"));
  if (rest > 0) parts.push(`\nほか ${rest}件`);
  parts.push(`\n──────────\n一覧はこちら\n${siteUrl}[/info]`);
  return parts.join("\n");
}
