const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://sayuaradark_db_user:qK3BV8XVv2JJJD5a@cluster0.w8wb15r.mongodb.net/Sayura_DB?retryWrites=true&w=majority&appName=Cluster0";

const ADMIN_USER = "sayura";
const ADMIN_PASS = "G@laXy2045!";

// Schema එක යාවත්කාලීන කරන ලදී - 'number' unique වීම ඉවත් කළා
const credsSchema = new mongoose.Schema({
  number: { type: String, default: null }, 
  sessionId: { type: String, required: true },
  credsJson:  { type: Object, required: true },
  updatedAt:  { type: Date, default: Date.now }
}, { strict: false }); 

let CredsModel;
try {
  CredsModel = mongoose.model("SayuraMDCreds");
} catch {
  CredsModel = mongoose.model("SayuraMDCreds", credsSchema);
}

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(MONGO_URI);
  isConnected = true;
}

function checkAuth(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString();
  const [user, pass] = decoded.split(":");
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!checkAuth(req)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    await connectDB();

    // GET: පවතින සෙෂන් ලැයිස්තුව ලබා ගැනීම
    if (req.method === "GET") {
      const sessions = await CredsModel.find({}, "sessionId updatedAt number");
      return res.json({ success: true, sessions });
    }

    // DELETE: සෙෂන් එකක් මැකීම
    if (req.method === "DELETE") {
      const { sessionId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "sessionId required" });
      }

      // findOneAndDelete මගින් නිවැරදිව දත්තය මකා දමයි
      const result = await CredsModel.findOneAndDelete({ sessionId: sessionId });

      if (!result) {
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
