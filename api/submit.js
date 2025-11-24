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

    if (!householdId || !responses || !email)
        return res.status(400).json({ error: "Email is required" });


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
      <div style="font-family: 'Georgia', serif; background:#893941; padding:30px; color:#4a4032; line-height:1.6;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border:1px solid #610d08;">
          <h2 style="font-family:'Pinyon Script', cursive; font-size:36px; margin:0; text-align:center; color:#4a4032;">
            Sabina & Michael
          </h2>

          <p style="text-align:center; font-size:20px; margin:10px 0 25px; font-family:'Boska', serif;">
            Your RSVP has been received
          </p>

          <p>Thank you for taking the time to RSVP. We are so excited to celebrate with you!</p>

          <p style="margin-top:20px;">
            If you have any questions, feel free to reach out to either of us!
            Should you need to update your RSVP, you can simply submit a new one on the website.         
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
            // Helper to normalize yes/no-ish values
            const toYesNo = (value) => {
                if (value === true || value === "yes" || value === "Yes") return "yes";
                if (value === false || value === "no" || value === "No") return "no";
                return "no response";
            };

            const guestsHtml = Array.isArray(responses)
                ? responses
                    .map((guest) => {
                        const firstName = guest.firstName || guest.name || "Guest";
                        const lastName = guest.lastName || "";
                        const fullName = `${firstName} ${lastName}`.trim();

                        const welcomeAnswer = toYesNo(guest.welcomeDinner || guest.welcome || guest.attendingWelcome);
                        const weddingAnswer = toYesNo(guest.wedding || guest.ceremony || guest.attendingWedding);
                        const dinnerChoice = guest.dinner || guest.dinnerChoice || guest.entree || "no selection";
                        const allergiesText =
                            guest.allergies && guest.allergies.trim() !== ""
                                ? guest.allergies.trim()
                                : "none";

                        return `
            <li style="margin-bottom:12px; line-height:1.5;">
              <strong>${fullName}</strong> RSVPed
              <strong>${welcomeAnswer}</strong> to the welcome dinner,
              <strong>${weddingAnswer}</strong> to the wedding,
              chose <strong>${dinnerChoice}</strong> for dinner,
              and listed <strong>${allergiesText}</strong> for allergies.
            </li>
          `;
                    })
                    .join("")
                : "<li>No guest details found.</li>";

            const commentsText =
                comments && comments.trim() !== "" ? comments.trim() : "none";

            await resend.emails.send({
                from: "wedding@sabina-michael.com",
                to: ADMIN_EMAIL,
                subject: `New RSVP submitted – Household ${householdId}`,
                html: `
      <div style="font-family: Georgia, serif; background:#f9f6ef; padding:24px; color:#4a4032; line-height:1.6;">
        <div style="max-width:650px; margin:0 auto; background:#ffffff; padding:24px; border:1px solid #893941;">
          <h2 style="margin-top:0; margin-bottom:10px; font-family:'Boska', serif; letter-spacing:1px;">
            New RSVP Received
          </h2>

          <p style="margin:4px 0;"><strong>Household ID:</strong> ${householdId}</p>
          <p style="margin:4px 0;"><strong>Guest email:</strong> ${email || "N/A"}</p>
          <p style="margin:4px 0;"><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>

          <hr style="margin:18px 0; border:none; border-top:1px solid #ddd;" />

          <h3 style="margin:0 0 8px 0; font-family:'Boska', serif;">Guests</h3>
          <ul style="padding-left:18px; margin:8px 0 16px 0;">
            ${guestsHtml}
          </ul>

          <h3 style="margin:0 0 8px 0; font-family:'Boska', serif;">Household comments</h3>
          <p style="margin:0 0 4px 0;">
            ${commentsText}
          </p>
        </div>
      </div>
    `,
            });
        }


        res.json({ success: true });
    } catch (err) {
        console.log("SUBMIT ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
}
