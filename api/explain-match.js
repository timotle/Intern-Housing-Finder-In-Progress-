function getOpenAIKey() {
  const rawKey = process.env.OPENAI_API_KEY ?? "";
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

async function handleExplainMatch(body) {
  const openAIKey = getOpenAIKey();

  if (!openAIKey) {
    return {
      status: 500,
      body: { error: "OpenAI API key is not set up yet." },
    };
  }

  const { userPreferences, selectedListing, visibleListings } = body;
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

Your response must follow this exact structure:

Selected Listing Rank:
[State its rank clearly, e.g., "2nd out of 14"]

Nearby Comparison:
- Above: [Listing directly above, if exists]
- Above: [Second listing above, if exists]
- Below: [Listing directly below, if exists]
- Below: [Second listing below, if exists]

Why It Ranks There:
[Explain using price, commute time, lease term, bedrooms, and amenities]

Tradeoffs Compared to Nearby Listings:
- [Specific comparison to a nearby listing]
- [Specific comparison to another nearby listing]

STRICT REQUIREMENTS:
- You MUST include at least 2 tradeoffs.
- Do NOT use placeholders like "..." or vague statements.
- Be specific and comparative.
- Keep the tone concise and analytical. Remember the audience is interns and students.
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

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    return {
      status: openaiResponse.status,
      body: {
        error:
          openaiResponse.status === 401
            ? "The AI explanation is not available right now because the API key needs to be updated."
            : "The AI explanation could not be generated right now. Please try again soon.",
      },
    };
  }

  return {
    status: 200,
    body: {
      explanation: data.choices?.[0]?.message?.content || "No explanation returned.",
    },
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const result = await handleExplainMatch(request.body ?? {});
    return response.status(result.status).json(result.body);
  } catch (error) {
    return response.status(500).json({
      error: error.message || "Unknown server error.",
    });
  }
}

export async function POST(request) {
  try {
    const result = await handleExplainMatch(await request.json());
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown server error." },
      { status: 500 }
    );
  }
}
