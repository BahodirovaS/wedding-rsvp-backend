import { MongoClient } from "mongodb";
import { Resend } from "resend";

let cachedClient = null;
const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

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

  const { householdId, responses, email, comments } = req.body;

  if (!householdId || !responses)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const db = await getDb();
    const rsvp = db.collection("rsvp");

    await rsvp.updateOne(
      { householdId },
      { $set: { responses, submittedAt: new Date(), email, comments } },
      { upsert: true }
    );

    if (email) {
      await resend.emails.send({
        from: "wedding@sabina-michael.com",
        to: email,
        subject: "Your RSVP has been received!",
        html: `
      <div style="font-family: 'Georgia', serif; background:#f9f6ef; padding:30px; color:#4a4032; line-height:1.6;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border:1px solid #893941;">
          <h2 style="font-family:'Pinyon Script', cursive; font-size:36px; margin:0; text-align:center; color:#4a4032;">
            Sabina & Michael
          </h2>

          <p style="text-align:center; font-size:20px; margin:10px 0 25px; font-family:'Boska', serif;">
            Your RSVP has been received
          </p>

          <p>Thank you for taking the time to RSVP. We are so excited to celebrate with you!</p>

          <p style="margin-top:20px;">
            If you have any questions or need to update your RSVP at any time, feel free to reply directly to this email.
          </p>

          <p style="margin-top:30px; font-size:18px;">
            Warmly,<br>
            Sabina & Michael
          </p>
        </div>
      </div>
    `
      });
    }

    if (ADMIN_EMAIL) {
      await resend.emails.send({
        from: "wedding@sabina-michael.com",
        to: ADMIN_EMAIL,
        subject: `New RSVP submitted – Household ${householdId}`,
        html: `
          <h2>New RSVP</h2>
          <p><strong>Household ID:</strong> ${householdId}</p>
          <p><strong>Guest email:</strong> ${email || "N/A"}</p>
          <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
          <pre>${JSON.stringify(responses, null, 2)}</pre>
        `,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.log("SUBMIT ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
}
