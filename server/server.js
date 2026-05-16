const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { getHousingListings } = require("../lib/rentcastListings.cjs");
const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.json());

function getOpenAIKey() {
  const rawKey = process.env.OPENAI_API_KEY || "";
  return rawKey
    .trim()
    .replace(/^OPENAI_API_KEY\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function getRankedContext(selectedListing, visibleListings = []) {
  const rankedListings = [...visibleListings].sort((a, b) => {
    const scoreDifference = (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const priceDifference = (Number(a.price) || 0) - (Number(b.price) || 0);
    if (priceDifference !== 0) {
      return priceDifference;
    }

    return (Number(a.commuteTime) || 0) - (Number(b.commuteTime) || 0);
  });
  const selectedIndex = rankedListings.findIndex((listing) => listing.id === selectedListing?.id);
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  return {
    aboveListings: rankedListings.slice(Math.max(0, safeIndex - 2), safeIndex),
    belowListings: rankedListings.slice(safeIndex + 1, safeIndex + 3),
    rankedListings,
    selectedRank: rankedListings.length === 0 ? 0 : safeIndex + 1,
    totalListings: rankedListings.length,
  };
}

const COMMUTE_TARGETS = [
  {
    id: "uw",
    label: "University of Washington",
    area: "U District",
    latitude: 47.6553,
    longitude: -122.3035,
    keywords: ["uw", "university of washington", "u district", "udistrict", "campus"],
  },
  {
    id: "downtown",
    label: "Downtown Seattle",
    area: "Downtown",
    latitude: 47.6062,
    longitude: -122.3321,
    keywords: ["downtown", "pike", "pioneer square", "waterfront", "westlake"],
  },
  {
    id: "slu",
    label: "South Lake Union",
    area: "SLU",
    latitude: 47.6236,
    longitude: -122.336,
    keywords: ["slu", "south lake union", "amazon", "fred hutch", "seattle center"],
  },
  {
    id: "bellevue",
    label: "Bellevue",
    area: "Eastside",
    latitude: 47.6101,
    longitude: -122.2015,
    keywords: ["bellevue", "factoria", "overlake"],
  },
  {
    id: "redmond",
    label: "Redmond",
    area: "Eastside",
    latitude: 47.674,
    longitude: -122.1215,
    keywords: ["redmond", "microsoft", "meta", "tech campus"],
  },
  {
    id: "kirkland",
    label: "Kirkland",
    area: "Eastside",
    latitude: 47.6769,
    longitude: -122.206,
    keywords: ["kirkland", "google kirkland", "totem lake"],
  },
  {
    id: "renton",
    label: "Renton",
    area: "South Seattle",
    latitude: 47.4829,
    longitude: -122.2171,
    keywords: ["renton", "boeing renton", "tukwila"],
  },
  {
    id: "bothell",
    label: "Bothell",
    area: "North Eastside",
    latitude: 47.7601,
    longitude: -122.2054,
    keywords: ["bothell", "woodinville", "uw bothell"],
  },
  {
    id: "everett",
    label: "Everett",
    area: "North Sound",
    latitude: 47.9789,
    longitude: -122.2021,
    keywords: ["everett", "boeing everett", "mukilteo"],
  },
  {
    id: "tacoma",
    label: "Tacoma",
    area: "South Sound",
    latitude: 47.2529,
    longitude: -122.4443,
    keywords: ["tacoma", "federal way", "auburn"],
  },
];

function findFallbackCommuteTarget(query = "", fallbackTargetId = "uw") {
  const normalizedQuery = String(query).trim().toLowerCase();
  const matchedTarget = COMMUTE_TARGETS.find((target) =>
    target.keywords.some((keyword) => normalizedQuery.includes(keyword))
  );

  return (
    matchedTarget ||
    COMMUTE_TARGETS.find((target) => target.id === fallbackTargetId) ||
    COMMUTE_TARGETS[0]
  );
}

function isGreaterSeattleCoordinate(latitude, longitude) {
  return latitude >= 47.1 && latitude <= 48.15 && longitude >= -122.7 && longitude <= -121.65;
}

function fallbackCommuteTargetResult(query, fallbackTarget, message, options = {}) {
  return {
    source: "fallback",
    message,
    unsupported: Boolean(options.unsupported),
    target: {
      id: fallbackTarget.id,
      label: fallbackTarget.label,
      area: fallbackTarget.area,
      latitude: fallbackTarget.latitude,
      longitude: fallbackTarget.longitude,
      source: "fallback",
      confidence: "low",
      note: query?.trim()
        ? `${query.trim()} was not used as an exact commute point. ${message}`
        : message,
    },
  };
}

async function resolveCommuteTargetWithOpenAI(query, fallbackTarget) {
  const prompt = `
You help an intern housing app estimate commute targets in the Puget Sound internship area.

Given a user typed internship place, return a JSON object only:
{
  "label": "short cleaned place name",
  "area": "neighborhood or city",
  "latitude": 47.0000,
  "longitude": -122.0000,
  "confidence": "high" | "medium" | "low",
  "matchedPresetId": "uw" | "downtown" | "slu" | "bellevue" | "redmond" | "kirkland" | "renton" | "bothell" | "everett" | "tacoma" | null,
  "shouldUseFallback": false
}

Rules:
- If the user gives a complete office, school, or company address, estimate that address or nearest public block.
- If the user gives a well-known company, campus, neighborhood, or city, estimate that public area center.
- If the input is too vague or outside the Seattle, Bellevue, Redmond, Kirkland, Renton, Bothell, Everett, Tacoma, Lynnwood, Woodinville, Sammamish, Mercer Island, Newcastle, Tukwila, Kent, Auburn, Federal Way, or Mukilteo area, set shouldUseFallback to true.
- Do not return any text outside JSON.

Known fallback targets:
${JSON.stringify(COMMUTE_TARGETS.map(({ keywords, ...target }) => target))}

User input:
${query}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

app.get("/api/listings", async (req, res) => {
  try {
    const listings = await getHousingListings({
      query: req.query.query,
      latitude: req.query.latitude,
      longitude: req.query.longitude,
      targetLabel: req.query.targetLabel,
      targetCity: req.query.targetCity,
      maxPlaces: req.query.maxPlaces,
      maxListings: req.query.maxListings,
    });
    res.json(listings);
  } catch (error) {
    console.error("Could not load housing listings:");
    console.error(error);
    res.status(500).json({ error: "Could not load housing listings right now." });
  }
});

app.get("/api/sample-listings", (req, res) => {
  const listings = [
  {
    id: 1,
    name: "The Standard Seattle",
    price: 1500,
    location: "Seattle, WA",
    commuteTime: 8,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: true,
    parking: false,
    laundry: true,
  },
  {
    id: 2,
    name: "Olive Apartments",
    price: 1650,
    location: "Seattle, WA",
    commuteTime: 12,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 3,
    name: "HERE Seattle",
    price: 1400,
    location: "Seattle, WA",
    commuteTime: 6,
    leaseTerm: 12,
    numBedroom: 2,
    furnished: true,
    parking: false,
    laundry: true,
  },
  {
    id: 4,
    name: "Hub U District",
    price: 1550,
    location: "Seattle, WA",
    commuteTime: 5,
    leaseTerm: 12,
    numBedroom: 2,
    furnished: true,
    parking: false,
    laundry: true,
  },
  {
    id: 5,
    name: "Theory U District",
    price: 1450,
    location: "Seattle, WA",
    commuteTime: 7,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: true,
    parking: false,
    laundry: true,
  },
  {
    id: 6,
    name: "Twelve at U District",
    price: 1350,
    location: "Seattle, WA",
    commuteTime: 9,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: false,
    laundry: true,
  },
  {
    id: 7,
    name: "Identity Seattle",
    price: 1425,
    location: "Seattle, WA",
    commuteTime: 6,
    leaseTerm: 12,
    numBedroom: 2,
    furnished: true,
    parking: false,
    laundry: true,
  },
  {
    id: 8,
    name: "Nook Studios",
    price: 1200,
    location: "Seattle, WA",
    commuteTime: 15,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: false,
    laundry: true,
  },
  {
    id: 9,
    name: "AVA Ballard",
    price: 1750,
    location: "Seattle, WA",
    commuteTime: 20,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 10,
    name: "Via6 Apartments",
    price: 1900,
    location: "Seattle, WA",
    commuteTime: 18,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 11,
    name: "Arrivé Apartments",
    price: 2100,
    location: "Seattle, WA",
    commuteTime: 17,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 12,
    name: "Skye at Belltown",
    price: 1850,
    location: "Seattle, WA",
    commuteTime: 16,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 13,
    name: "Harbor Steps",
    price: 2200,
    location: "Seattle, WA",
    commuteTime: 19,
    leaseTerm: 12,
    numBedroom: 2,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 14,
    name: "Cirrus Apartments",
    price: 2000,
    location: "Seattle, WA",
    commuteTime: 18,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 15,
    name: "AMLI Mark24",
    price: 1950,
    location: "Seattle, WA",
    commuteTime: 14,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 16,
    name: "The Danforth",
    price: 1600,
    location: "Seattle, WA",
    commuteTime: 10,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: false,
    laundry: true,
  },
  {
    id: 17,
    name: "West Edge Apartments",
    price: 2050,
    location: "Seattle, WA",
    commuteTime: 15,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  },
  {
    id: 18,
    name: "The M Seattle",
    price: 1300,
    location: "Seattle, WA",
    commuteTime: 8,
    leaseTerm: 12,
    numBedroom: 2,
    furnished: true,
    parking: false,
    laundry: true,
  },
  {
    id: 19,
    name: "Bridges @ 11th",
    price: 1250,
    location: "Seattle, WA",
    commuteTime: 11,
    leaseTerm: 12,
    numBedroom: 2,
    furnished: false,
    parking: false,
    laundry: true,
  },
  {
    id: 20,
    name: "The Accolade Apartments",
    price: 1700,
    location: "Seattle, WA",
    commuteTime: 9,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: true,
    laundry: true,
  }
];

  res.json(listings);
});


const client = new OpenAI({
  apiKey: getOpenAIKey(),
});

app.post("/api/resolve-commute-target", async (req, res) => {
  const query = String(req.body?.query || "").trim();
  const fallbackTarget = findFallbackCommuteTarget(query, req.body?.fallbackTargetId);

  if (query === "") {
    return res.json({
      source: "preset",
      message: `Using ${fallbackTarget.label}.`,
      target: {
        ...fallbackTarget,
        source: "preset",
        confidence: "high",
      },
    });
  }

  if (!getOpenAIKey()) {
    return res.json(
      fallbackCommuteTargetResult(
        query,
        fallbackTarget,
        `I used ${fallbackTarget.label} because the AI location matcher is not set up locally.`
      )
    );
  }

  try {
    const resolved = await resolveCommuteTargetWithOpenAI(query, fallbackTarget);
    const latitude = Number(resolved.latitude);
    const longitude = Number(resolved.longitude);
    const matchedFallbackTarget = findFallbackCommuteTarget(
      query,
      resolved.matchedPresetId || fallbackTarget.id
    );

    if (
      resolved.shouldUseFallback ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !isGreaterSeattleCoordinate(latitude, longitude)
    ) {
      return res.json(
        fallbackCommuteTargetResult(
          query,
          matchedFallbackTarget,
          "That location is outside the supported Puget Sound search right now. Choose a quick area or type a nearby internship address.",
          { unsupported: true }
        )
      );
    }

    return res.json({
      source: "openai",
      message: `Matched ${query} to ${resolved.area || resolved.label || "your internship area"}.`,
      target: {
        id: `openai-${Date.now()}`,
        label: resolved.label || query,
        area: resolved.area || matchedFallbackTarget.area,
        latitude,
        longitude,
        source: "openai",
        confidence: resolved.confidence || "medium",
        note: "Approximate commute target from the AI location matcher.",
      },
    });
  } catch (error) {
    console.error("Could not resolve commute target:");
    console.error(error);
    return res.json(
      fallbackCommuteTargetResult(
        query,
        fallbackTarget,
        `I could not match that exactly, so I used ${fallbackTarget.label}.`
      )
    );
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});
app.post("/api/explain-match", async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("API key loaded:", !!getOpenAIKey());

    const { userPreferences, selectedListing, visibleListings } = req.body;
    const { aboveListings, belowListings, selectedRank, totalListings } = getRankedContext(
      selectedListing,
      visibleListings
    );

    const prompt = `
    You are a student-friendly readable smart housing recommendation assistant.

    The user clicked on one listing. The app already ranked the visible listings using structured match scores before sending this to you.

    IMPORTANT RULES:
    - Do NOT assume the selected listing is the best option.
    - Use the exact selected listing rank shown below.
    - Do NOT invent a different total number of listings.
    - Only compare against the above and below listings provided.
    - Commute time is estimated to the user's selected internship location when one is provided.

    Your response must follow this exact structure:

    Selected Listing Rank:
    [State its rank clearly, e.g., "2nd out of 14"]

    Nearby Comparison:
    - Above: [Listing directly above, if exists]
    - Above: [Second listing above, if exists]
    - Below: [Listing directly below, if exists]
    - Below: [Second listing below, if exists]

    Why It Ranks There:
    [Explain using price, commute time, lease term, bedrooms, square feet, bathrooms, and amenities]

    Tradeoffs Compared to Nearby Listings:
    - [Specific comparison to a nearby listing]
    - [Specific comparison to another nearby listing]

    STRICT REQUIREMENTS:
    - You MUST include at least 2 tradeoffs.
    - Do NOT use placeholders like "..." or vague statements.
    - Be specific and comparative.
    - Keep the tone concise and analytical [REMEMBER AUDIENCE IS INTERNS/STUDENTS]
    - Do NOT print the full ranking of all listings.
    - Only reference up to 2 listings above and 2 below the selected listing.
    - Use this exact rank: ${selectedRank} out of ${totalListings}.
    - If a provided Above or Below list is empty, write "None" for that line.
    - Never put a lower-ranked listing in the Above section.

User Preferences:
${JSON.stringify(userPreferences)}

Selected Listing:
${JSON.stringify(selectedListing)}

Listings Above Selected Listing:
${JSON.stringify(aboveListings)}

Listings Below Selected Listing:
${JSON.stringify(belowListings)}
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
    const statusCode = error.status || 500;
    const friendlyMessage =
      statusCode === 401
        ? "The AI explanation is not available right now because the API key needs to be updated."
        : "The AI explanation could not be generated right now. Please try again soon.";

    res.status(statusCode).json({
      error: friendlyMessage,
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
