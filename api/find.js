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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Missing name" });
  }

  try {
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
}
