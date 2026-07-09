import { getStore } from "@netlify/blobs";
import webpush from "web-push";

// 毎日 UTC 23:45 = 日本時間 8:45(8:05の新着収集とデプロイの後)
export const config = { schedule: "45 23 * * *" };

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
  return new Response(`sent:${sent} removed:${removed} new:${fresh.length}`, { status: 200 });
};
