import listingService from "../lib/rentcastListings.cjs";

const { getHousingListings } = listingService;

export default async function handler(request, response) {
  try {
    const listings = await getHousingListings({
      query: request.query?.query,
      maxPlaces: request.query?.maxPlaces,
    });
    return response.status(200).json(listings);
  } catch (error) {
    console.error("Could not load housing listings:", error);
    return response.status(500).json({
      error: "Could not load housing listings right now.",
    });
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const listings = await getHousingListings({
      query: url.searchParams.get("query") || undefined,
      maxPlaces: url.searchParams.get("maxPlaces") || undefined,
    });
    return Response.json(listings);
  } catch (error) {
    console.error("Could not load housing listings:", error);
    return Response.json(
      { error: "Could not load housing listings right now." },
      { status: 500 }
    );
  }
}
