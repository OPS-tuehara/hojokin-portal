import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { postChatworkMessage, buildNewsMessage, isChatworkConfigured } from "../lib/chatwork.mjs";

// 日本時間 8:05 / 8:45 / 9:05 / 9:45 の4回（UTC 23:05, 23:45, 0:05, 0:45）。
// 収集タスクは 7:15 JST 開始で 20〜45分ほどかかる。通常は 8:45 の回で配信されるが、
// 収集が長引いて間に合わなかった日は後続の回が同じ日のうちに拾う
// （2026-09-28 に収集完了 8:47 で 8:45 の配信を2分差で取り逃がした）。
// 差分は Blobs の last_ids で管理しているため、何回動いても同じ項目が二重に通知されることはない。
export const config = { schedule: "5,45 23,0 * * *" };

export default async () => {
  const siteUrl = process.env.URL;
  const res = await fetch(`${siteUrl}/news.json?t=${Date.now()}`);
  if (!res.ok) return new Response("news.json not found", { status: 200 });
  const news = await res.json();
  const items = news.items || [];

  const state = getStore("push-state");
  const lastIds = new Set((await state.get("last_ids", { type: "json" })) || []);
  const fresh = items.filter(i => !lastIds.has(i.id));

  // 初回実行は通知せず現状を既知として記録
  const firstRun = lastIds.size === 0;
  await state.setJSON("last_ids", items.map(i => i.id));
  if (firstRun || fresh.length === 0) return new Response("no new items", { status: 200 });

  // --- Chatwork 投稿（Web プッシュとは独立。失敗してもプッシュは継続する） ---
  let chatworkResult = "skipped";
  if (isChatworkConfigured()) {
    try {
      const results = await postChatworkMessage(buildNewsMessage(fresh, siteUrl));
      const ok = results.filter(r => r.ok).length;
      const ng = results.filter(r => !r.ok);
      chatworkResult = `ok:${ok} ng:${ng.length}`;
      if (ng.length) console.error("chatwork post failed:", JSON.stringify(ng));
    } catch (e) {
      chatworkResult = "error";
      console.error("chatwork unexpected error:", e);
    }
  }

  // --- Web プッシュ ---
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:az.t.uehara@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const payload = JSON.stringify({
    title: `OPS GSS｜関連補助金の新着 ${fresh.length}件`,
    body: fresh.slice(0, 3).map(i => "・" + i.title).join("\n"),
    count: fresh.length,
    url: siteUrl
  });

  const subs = getStore("push-subs");
  const { blobs } = await subs.list();
  let sent = 0, removed = 0;
  for (const b of blobs) {
    const sub = await subs.get(b.key, { type: "json" });
    if (!sub) continue;
    try { await webpush.sendNotification(sub, payload); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await subs.delete(b.key); removed++; }
    }
  }
  return new Response(`sent:${sent} removed:${removed} new:${fresh.length} chatwork:${chatworkResult}`, { status: 200 });
};
