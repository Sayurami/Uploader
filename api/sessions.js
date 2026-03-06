const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://sayuaradark_db_user:qK3BV8XVv2JJJD5a@cluster0.w8wb15r.mongodb.net/Sayura_DB?retryWrites=true&w=majority&appName=Cluster0";

// ================= MongoDB Schema =================
const credsSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  credsJson:  { type: Object, required: true },
  updatedAt:  { type: Date, default: Date.now }
});

let CredsModel;
try {
  CredsModel = mongoose.model("SayuraMDCreds");
} catch {
  CredsModel = mongoose.model("SayuraMDCreds", credsSchema);
}

// ================= MongoDB Connect =================
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(MONGO_URI);
  isConnected = true;

  // ── පරණ bad indexes drop කරනවා (number_1 වගේ) ──────────────
  try {
    const col = mongoose.connection.db.collection("sayuramdcreds");
    const indexes = await col.indexes();
    for (const idx of indexes) {
      // sessionId_1 සහ _id_ හැර අනිත් ඔක්කොම drop
      if (idx.name !== "_id_" && idx.name !== "sessionId_1") {
        await col.dropIndex(idx.name);
        console.log("Dropped old index:", idx.name);
      }
    }
  } catch (e) {
    console.warn("Index cleanup warning:", e.message);
  }
}

// ================= Session ID Generate =================
function generateSessionId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "SAYURA-";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ================= Main Handler =================
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await connectDB();

    // ─── GET: sessions list ───────────────────────────────────
    if (req.method === "GET" && !req.query.action) {
      const sessions = await CredsModel.find({}, "sessionId updatedAt");
      return res.json({ success: true, sessions });
    }

    // ─── POST: upload session ─────────────────────────────────
    if (req.method === "POST") {
      const { credsJson, sessionId: customId } = req.body;

      if (!credsJson) {
        return res.status(400).json({ success: false, error: "credsJson is required" });
      }

      let parsedCreds;
      try {
        parsedCreds = typeof credsJson === "string" ? JSON.parse(credsJson) : credsJson;
        if (!parsedCreds.noiseKey && !parsedCreds.me && !parsedCreds.signedIdentityKey) {
          return res.status(400).json({ success: false, error: "Invalid creds.json format" });
        }
      } catch (e) {
        return res.status(400).json({ success: false, error: "Invalid JSON format" });
      }

      const sessionId = customId || generateSessionId();

      await CredsModel.findOneAndUpdate(
        { sessionId },
        { sessionId, credsJson: parsedCreds, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      return res.json({ success: true, sessionId, message: "Session uploaded successfully!" });
    }

    // ─── DELETE: session delete ───────────────────────────────
    if (req.method === "DELETE") {
      const { sessionId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "sessionId required" });
      }
      const result = await CredsModel.deleteOne({ sessionId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, error: "Session not found" });
      }
      return res.json({ success: true, message: `Session ${sessionId} deleted` });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
