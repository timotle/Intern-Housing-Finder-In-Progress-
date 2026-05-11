import listingService from "../lib/rentcastListings.cjs";

const { getHousingListings } = listingService;

export default async function handler(request, response) {
  try {
    const listings = await getHousingListings({
      query: request.query?.query,
      latitude: request.query?.latitude,
      longitude: request.query?.longitude,
      targetLabel: request.query?.targetLabel,
      targetCity: request.query?.targetCity,
      maxPlaces: request.query?.maxPlaces,
      maxListings: request.query?.maxListings,
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
      latitude: url.searchParams.get("latitude") || undefined,
      longitude: url.searchParams.get("longitude") || undefined,
      targetLabel: url.searchParams.get("targetLabel") || undefined,
      targetCity: url.searchParams.get("targetCity") || undefined,
      maxPlaces: url.searchParams.get("maxPlaces") || undefined,
      maxListings: url.searchParams.get("maxListings") || undefined,
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
