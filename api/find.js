import { MongoClient } from "mongodb";

let cachedClient = null;

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

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { name } = body;

    if (!name || typeof name !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing name" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      const db = await getDb();
      const households = db.collection("households");

      const search = name.toLowerCase().trim();

      const match = await households.findOne({
        lookup: { $in: [search] }
      });

      if (!match) {
        return new Response(
          JSON.stringify({ error: "No matching invitation found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return Response.json({
        householdId: match.id,
        guests: match.guests
      });
    } catch (err) {
      console.error("FIND ERROR:", err);
      return new Response(
        JSON.stringify({ error: "Server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
};
