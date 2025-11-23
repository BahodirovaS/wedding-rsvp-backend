const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");

router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Missing name" });

  try {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db("wedding");

    const households = db.collection("households");

    const lower = name.toLowerCase().trim();

    const match = await households.findOne({
      lookup: { $in: [lower] }
    });

    if (!match) {
      return res.status(404).json({ error: "No matching invitation found" });
    }

    res.json({ household: match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
