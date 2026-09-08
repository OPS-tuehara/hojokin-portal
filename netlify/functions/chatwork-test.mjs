// Chatwork 連携の疎通確認用エンドポイント（手動実行）
//
//   /.netlify/functions/chatwork-test?key=<ADMIN_KEY>            … テストメッセージを投稿
//   /.netlify/functions/chatwork-test?key=<ADMIN_KEY>&mode=latest … news.json の最新3件を投稿
//
// ADMIN_KEY 環境変数が未設定の場合は常に 403（誤爆防止）。
// 通知済み状態（Blobs）には一切触れないため、通常の日次通知には影響しない。

import { postChatworkMessage, buildNewsMessage, isChatworkConfigured } from "../lib/chatwork.mjs";

export default async (req) => {
  const adminKey = process.env.ADMIN_KEY;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!adminKey) {
    return new Response("ADMIN_KEY is not configured", { status: 403 });
  }
  if (key !== adminKey) {
    return new Response("forbidden", { status: 403 });
  }
  if (!isChatworkConfigured()) {
    return new Response("CHATWORK_TOKEN / CHATWORK_ROOM_ID が未設定です", { status: 500 });
  }

  const siteUrl = process.env.URL;
  const mode = url.searchParams.get("mode") || "test";

  let body;
  if (mode === "latest") {
    const res = await fetch(`${siteUrl}/news.json?t=${Date.now()}`);
    if (!res.ok) return new Response("news.json not found", { status: 500 });
    const news = await res.json();
    const items = (news.items || []).slice(0, 3);
    if (!items.length) return new Response("news.json に項目がありません", { status: 200 });
    body = buildNewsMessage(items, siteUrl);
  } else {
    body = `[info][title]OPS GSS｜Chatwork連携テスト[/title]`
      + `この投稿が見えていれば、Chatwork への自動投稿設定は正常です。\n`
      + `以後、関連補助金・助成金の新着があった日の朝8:45にこのルームへ投稿されます。\n`
      + `──────────\n${siteUrl}[/info]`;
  }

  const results = await postChatworkMessage(body);
  const status = results.every(r => r.ok) ? 200 : 500;
  return new Response(JSON.stringify({ mode, results }, null, 1), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
};
