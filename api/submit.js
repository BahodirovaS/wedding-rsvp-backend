import { MongoClient } from "mongodb";
import { Resend } from "resend";

let cachedClient = null;
const resend = new Resend(process.env.RESEND_API_KEY);

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db("wedding");
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // ----- PARSE JSON -----
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const { householdId, responses, email } = body;

    if (!householdId || !responses) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    try {
      const db = await getDb();
      const rsvp = db.collection("rsvp");

      await rsvp.updateOne(
        { householdId },
        { $set: { responses, submittedAt: new Date(), email } },
        { upsert: true }
      );

      // OPTIONAL: send email
      if (email) {
        await resend.emails.send({
          from: "wedding@sabina-michael.com",
          to: email,
          subject: "Your RSVP has been received",
          html: "<p>Thank you for your RSVP!</p>"
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (err) {
      console.error("SUBMIT ERROR:", err);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};
