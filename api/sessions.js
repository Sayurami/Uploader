const mongoose = require("mongoose");

// මේක API එකේ (Uploader කේතයේ) වෙනස් කරන්න
const MONGO_URI = "mongodb+srv://sayuaradark_db_user:qK3BV8XVv2JJJD5a@cluster0.w8wb15r.mongodb.net/Sayura_DB?retryWrites=true&w=majority&appName=Cluster0";
// ================= MongoDB Schema =================
const credsSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  credsJson: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

let CredsModel;
try {
  CredsModel = mongoose.model("SayuraMDCreds");
} catch {
  CredsModel = mongoose.model("SayuraMDCreds", credsSchema);
}

// MongoDB connect
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(MONGO_URI);
  isConnected = true;
}

// Session ID generate
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
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await connectDB();

    // ─── GET: සියලු sessions list ───
    if (req.method === "GET" && !req.query.action) {
      const sessions = await CredsModel.find({}, "sessionId updatedAt");
      return res.json({ success: true, sessions });
    }

    // ─── POST: නව session upload ───
    if (req.method === "POST") {
      const { credsJson, sessionId: customId } = req.body;

      if (!credsJson) {
        return res.status(400).json({ success: false, error: "credsJson is required" });
      }

      // creds.json valid දැයි check
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

    // ─── DELETE: session delete ───
    if (req.method === "DELETE") {
      const { sessionId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "sessionId required" });
      }
      await CredsModel.deleteOne({ sessionId });
      return res.json({ success: true, message: `Session ${sessionId} deleted` });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
