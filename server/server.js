require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
app.get("/", (req, res) => {
  res.send("Backend is running");
});
app.post("/api/explain-match", async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("API key loaded:", !!process.env.OPENAI_API_KEY);

    const { userPreferences, listing, matchScore } = req.body;

    const prompt = `
    You are a smart housing recommendation assistant.

    Analyze the following apartment listings based on the user's preferences.

    For EACH listing:
    - Give 2-3 clear pros
    - Give 2-3 clear cons
    - Be specific (price vs budget, commute vs preference, lease term, amenities)

    Then:
    - Compare the listings
    - Identify which listing is the BEST overall fit
    - Explain WHY it is the best choice
    - Mention tradeoffs between options

    Keep the tone analytical, concise, and helpful. Avoid generic statements.

User Preferences:
${JSON.stringify(userPreferences)}

Listings:
${JSON.stringify(listing)}

Match Scores:
${JSON.stringify(matchScore)}
`;
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "user", content: prompt }
      ],
    });
    const explanation = response.choices[0].message.content;
    console.log("OpenAI worked:", explanation);
    res.json({ explanation });
  } catch (error) {
    console.error("FULL BACKEND ERROR:");
    console.error(error);
    res.status(500).json({
      error: error.message || "Unknown server error",
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});