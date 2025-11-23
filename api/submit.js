import { MongoClient } from "mongodb";
import { Resend } from "resend";

let cachedClient = null;
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { householdId, responses, email } = req.body;

  if (!householdId || !responses) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(process.env.MONGO_URL);
      await cachedClient.connect();
    }

    const db = cachedClient.db("wedding");
    const rsvp = db.collection("rsvp");

    await rsvp.updateOne(
      { householdId },
      { $set: { responses, submittedAt: new Date(), email } },
      { upsert: true }
    );

    const html = `
      <h2>Your RSVP has been received!</h2>
      <p>Here are your responses:</p>
      <ul>
        ${responses
          .map(
            r => `
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

    await resend.emails.send({
      from: "wedding@sabina-michael.com",
      to: email,
      subject: "Your RSVP is confirmed!",
      html
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
