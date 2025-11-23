const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/", async (req, res) => {
  const { householdId, responses, email } = req.body;

  if (!householdId || !responses)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db("wedding");

    const rsvp = db.collection("rsvp");

    // Save RSVP
    await rsvp.updateOne(
      { householdId },
      { $set: { responses, submittedAt: new Date(), email } },
      { upsert: true }
    );

    // Build email body
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

    // Send confirmation
    await resend.emails.send({
      from: "wedding@sabina-michael.com",
      to: email,
      subject: "Your RSVP is confirmed!",
      html
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
