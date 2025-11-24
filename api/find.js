import { MongoClient } from "mongodb";

let cachedClient = null;

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

    const { name } = req.body;

    if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Missing name" });
    }

    const parts = name.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) {
        return res.status(400).json({
            error: "Please enter both first and last name."
        });
    }

    const first = parts[0];
    const last = parts.slice(1).join(" ");
    const search = `${first} ${last}`;

    try {
        const db = await getDb();

        const households = db.collection("Households");
        const rsvp = db.collection("rsvp");

        const match = await households.findOne({
            lookup: { $in: [search] }
        });

        if (!match) {
            return res.status(404).json({
                error: "No matching invitation found for that full name."
            });
        }

        const rsvpRecord = await rsvp.findOne({ householdId: match.id });

        return res.json({
            id: match.id,
            guests: match.guests,
            existingResponses: rsvpRecord ? rsvpRecord.responses : null,
            existingEmail: rsvpRecord ? rsvpRecord.email : null,
            existingComments: rsvpRecord ? rsvpRecord.comments : null
        });

    } catch (err) {
        console.log("FIND ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
}
