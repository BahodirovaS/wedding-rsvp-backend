import { MongoClient } from "mongodb";

let cachedClient = null;

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(process.env.MONGO_URL);
      await cachedClient.connect();
    }

    const db = cachedClient.db("wedding");
    const households = db.collection("households");

    const lower = name.toLowerCase().trim();

    const match = await households.findOne({
      lookup: { $in: [lower] }
    });

    if (!match) {
      return res.status(404).json({ error: "No matching invitation found" });
    }

    return res.status(200).json({
      householdId: match.id,
      guests: match.guests.map(g => g.name)
    });

  } catch (err) {
    console.error("Error in /api/find:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
