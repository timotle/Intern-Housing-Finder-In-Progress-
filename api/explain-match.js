export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not set up yet." },
        { status: 500 }
      );
    }

    const { userPreferences, selectedListing, visibleListings } = await request.json();

    const prompt = `
You are a student-friendly readable smart housing recommendation assistant.

The user clicked on one listing, but your job is to evaluate ALL visible listings objectively before discussing the selected listing.

IMPORTANT RULES:
- Do NOT assume the selected listing is the best option.
- First, internally rank ALL visible listings from best to worst (do NOT print the full list).
- Use the provided matchScore as the PRIMARY ranking signal.
- If two listings have the same matchScore, break ties by:
  1) lower price
  2) shorter commute time
- Only after ranking should you analyze the selected listing.

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

User Preferences:
${JSON.stringify(userPreferences)}

Selected Listing:
${JSON.stringify(selectedListing)}

All Visible Listings:
${JSON.stringify(visibleListings)}
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return Response.json(
        { error: data.error?.message || "OpenAI request failed." },
        { status: openaiResponse.status }
      );
    }

    return Response.json({
      explanation: data.choices?.[0]?.message?.content || "No explanation returned.",
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unknown server error." },
      { status: 500 }
    );
  }
}
