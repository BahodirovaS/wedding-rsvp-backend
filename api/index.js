import express from "express";
import { MongoClient } from "mongodb";
import { Resend } from "resend";

const app = express();
app.use(express.json());

// ===== Shared Mongo & Resend =====
let cachedClient = null;
const resend = new Resend(process.env.RESEND_API_KEY);

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db("wedding");
}

// ===== /api/find =====
app.post("/api/find", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Missing name" });
    }

    const db = await getDb();
    const households = db.collection("households");

    const match = await households.findOne({
      lookup: { $in: [name.toLowerCase().trim()] }
    });

    if (!match) {
      return res.status(404).json({ error: "No matching invitation found" });
    }

    return res.json({
      householdId: match.id,
      guests: match.guests
    });
  } catch (err) {
    console.error("FIND ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ===== /api/submit =====
app.post("/api/submit", async (req, res) => {
  try {
    const { householdId, responses, email } = req.body;

    if (!householdId || !responses) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const db = await getDb();
    const rsvp = db.collection("rsvp");

    await rsvp.updateOne(
      { householdId },
      { $set: { responses, submittedAt: new Date(), email } },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ==== REQUIRED EXPORT FOR VERCEL SERVERLESS EXPRESS ====
export default function handler(req, res) {
  return app(req, res);
}
