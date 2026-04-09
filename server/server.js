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

    const { userPreferences, selectedListing, visibleListings } = req.body;

    const prompt = `
    You are a student-friendly readable smart housing recommendation assistant.

    The user clicked on one listing, but your job is to evaluate ALL visible listings objectively before discussing the selected listing.

    IMPORTANT RULES:
    - Do NOT assume the selected listing is the best option.
    - First, rank ALL visible listings from best to worst.
    - Use the provided matchScore as the PRIMARY ranking signal.
    - If two listings have the same matchScore, break ties by:
      1) lower price
      2) shorter commute time
    - Only after ranking should you analyze the selected listing.

    Your response must follow this exact structure:

    Overall Ranking:
    1. [Listing Name]
    2. [Listing Name]
    ...

    Selected Listing Rank:
    [State its rank clearly, e.g., "2nd out of 3"]

    Why It Ranks There:
    [Explain using price, commute time, lease term, bedrooms, and amenities]

    Tradeoffs Compared to Other Listings:
    - [Specific comparison, ex. "Cheaper than X but longer commute"]
    - [Specific comparison, ex. "Has parking but lacks laundry compared to Y"]

    STRICT REQUIREMENTS:
    - You MUST include at least 2 tradeoffs.
    - Do NOT use placeholders like "..." or vague statements.
    - Be specific and comparative.
    - Keep the tone concise and analytical[REMEMBER AUDIENCE IS INTERNS/STUDENTS]

User Preferences:
${JSON.stringify(userPreferences)}

Selected Listing:
${JSON.stringify(selectedListing)}

All Visible Listings:
${JSON.stringify(visibleListings)}
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