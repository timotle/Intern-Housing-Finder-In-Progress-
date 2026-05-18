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

function getOpenAIKey() {
  const rawKey = process.env.OPENAI_API_KEY ?? "";
  return rawKey
    .trim()
    .replace(/^OPENAI_API_KEY\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

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

async function resolveCommuteTargetWithOpenAI(query) {
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

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    throw new Error(data.error?.message || "OpenAI location matching failed.");
  }

  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

async function handleResolveCommuteTarget(body) {
  const query = String(body?.query || "").trim();
  const fallbackTarget = findFallbackCommuteTarget(query, body?.fallbackTargetId);

  if (query === "") {
    return {
      status: 200,
      body: {
        source: "preset",
        message: `Using ${fallbackTarget.label}.`,
        target: {
          ...fallbackTarget,
          source: "preset",
          confidence: "high",
        },
      },
    };
  }

  if (!getOpenAIKey()) {
    return {
      status: 200,
      body: fallbackCommuteTargetResult(
        query,
        fallbackTarget,
        `I used ${fallbackTarget.label} because the AI location matcher is not set up yet.`
      ),
    };
  }

  try {
    const resolved = await resolveCommuteTargetWithOpenAI(query);
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
      return {
        status: 200,
        body: fallbackCommuteTargetResult(
          query,
          matchedFallbackTarget,
          "That location is outside the supported Puget Sound search right now. Choose a quick area or type a nearby internship address.",
          { unsupported: true }
        ),
      };
    }

    return {
      status: 200,
      body: {
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
      },
    };
  } catch (error) {
    return {
      status: 200,
      body: fallbackCommuteTargetResult(
        query,
        fallbackTarget,
        `I could not match that exactly, so I used ${fallbackTarget.label}.`
      ),
    };
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const result = await handleResolveCommuteTarget(request.body ?? {});
  return response.status(result.status).json(result.body);
}

export async function POST(request) {
  const result = await handleResolveCommuteTarget(await request.json());
  return Response.json(result.body, { status: result.status });
}
