// api/admin.js — Vercel Serverless Function
// Admin-only session management (delete) with password protection

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME   = process.env.DB_NAME   || "whatsapp_sessions";
const COLL_NAME = process.env.COLL_NAME || "sessions";

// ── Admin credentials (store in Vercel env vars for safety) ──────────────────
const ADMIN_USER = process.env.ADMIN_USER || "sayura";
const ADMIN_PASS = process.env.ADMIN_PASS || "G@laXy2045!";

let client;
async function getDB() {
  if (!client) {
    client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
    await client.connect();
  }
  return client.db(DB_NAME).collection(COLL_NAME);
}

function unauthorized(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
  res.status(401).json({ error: "Unauthorized" });
}

function checkAuth(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return false;
  const [user, pass] = Buffer.from(auth.slice(6), "base64").toString().split(":");
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!checkAuth(req)) return unauthorized(res);

  const col = await getDB();

  // GET /api/admin  →  list all sessions
  if (req.method === "GET") {
    const sessions = await col
      .find({}, { projection: { sessionId: 1, updatedAt: 1, _id: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();
    return res.status(200).json({ sessions });
  }

  // DELETE /api/admin?id=SESSION_ID  →  delete one session
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id query param required" });

    const result = await col.deleteOne({ sessionId: id });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Session not found" });

    return res.status(200).json({ success: true, deleted: id });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
