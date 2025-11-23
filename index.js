import express from "express";
import { MongoClient } from "mongodb";
import { Resend } from "resend";

const app = express();
app.use(express.json());

// ===== Shared Mongo + Resend setup =====
let cachedClient = null;
const resend = new Resend(process.env.RESEND_API_KEY);

async function getDb() {
  if (!cachedClient) {
    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL not set");
    }
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

    const search = name.toLowerCase().trim();

    const match = await households.findOne({
      lookup: { $in: [search] }
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

    // Build confirmation email HTML
    const html = `
      <h2>Your RSVP has been received!</h2>
      <p>Here are your responses:</p>
      <ul>
        ${responses
          .map(
            (r) => `
              <li><strong>${r.name}</strong><br/>
                  Wedding Day: ${r.wedding}<br/>
                  Welcome Dinner: ${r.dinner}
              </li>
            `
          )
          .join("")}
      </ul>
      <p>We can't wait to celebrate with you! ♥</p>
    `;

    if (email) {
      await resend.emails.send({
        from: "wedding@sabina-michael.com",
        to: email,
        subject: "Your RSVP is confirmed!",
        html
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Export the Express app for Vercel
export default app;
