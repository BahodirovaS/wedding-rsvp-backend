const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/find", require("./api/find"));
app.use("/submit", require("./api/submit"));

app.listen(3000, () => console.log("RSVP backend running"));
