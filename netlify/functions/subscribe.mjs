import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const key = ep => crypto.createHash("sha256").update(ep).digest("hex");

export default async (req) => {
  const store = getStore("push-subs");
  if (req.method === "POST") {
    const sub = await req.json();
    if (!sub || !sub.endpoint) return new Response("bad request", { status: 400 });
    await store.setJSON(key(sub.endpoint), sub);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (req.method === "DELETE") {
    const { endpoint } = await req.json();
    if (endpoint) await store.delete(key(endpoint));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  return new Response("method not allowed", { status: 405 });
};
