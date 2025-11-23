import { MongoClient } from "mongodb";
import { Resend } from "resend";

let cachedClient = null;
const resend = new Resend(process.env.RESEND_API_KEY);

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db("Wedding");
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { householdId, responses, email } = req.body;

  if (!householdId || !responses)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const db = await getDb();
    const rsvp = db.collection("rsvp");

    await rsvp.updateOne(
      { householdId },
      { $set: { responses, submittedAt: new Date(), email } },
      { upsert: true }
    );

    if (email) {
      await resend.emails.send({
        from: "wedding@sabina-michael.com",
        to: email,
        subject: "Your RSVP has been received!",
        html: "<p>Thank you!</p>"
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.log("SUBMIT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
}
