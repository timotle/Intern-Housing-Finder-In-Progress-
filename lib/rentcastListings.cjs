const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", "data", "listings.json");
const UW_DESTINATION = {
  label: "University of Washington",
  latitude: 47.6553,
  longitude: -122.3035,
};

const fallbackListings = [
  {
    id: 1,
    name: "Sample listing near campus",
    price: 1450,
    location: "Seattle, WA",
    commuteTime: 10,
    leaseTerm: 12,
    numBedroom: 1,
    furnished: false,
    parking: false,
    laundry: true,
    dataSource: "sample",
    priceNote: "Demo rent estimate",
  },
];

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getDistanceMiles(origin, destination = UW_DESTINATION) {
  if (!Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLng = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function estimateCommuteMinutes(listing) {
  const miles = getDistanceMiles(listing);
  if (miles === null) {
    return 25;
  }

  return Math.max(5, Math.round(miles * 7 + 4));
}

function getRentCastKey() {
  return (process.env.RENTCAST_API_KEY || "")
    .trim()
    .replace(/^RENTCAST_API_KEY\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function getListingName(listing) {
  if (listing.addressLine1) {
    return listing.addressLine1;
  }

  return listing.formattedAddress || "Rental listing";
}

function getListingLocation(listing) {
  return [listing.city, listing.state, listing.zipCode].filter(Boolean).join(", ");
}

function mapRentCastListing(listing, index) {
  const bedrooms = Number.isFinite(Number(listing.bedrooms)) ? Number(listing.bedrooms) : 1;
  const isStudio = bedrooms === 0;

  return {
    id: index + 1,
    placeId: listing.id,
    rentcastId: listing.id,
    name: getListingName(listing),
    price: Number(listing.price) || 0,
    priceNote: "RentCast active rental listing",
    location: getListingLocation(listing) || listing.formattedAddress || "Seattle, WA",
    address: listing.formattedAddress,
    commuteTime: estimateCommuteMinutes(listing),
    commuteNote: `Distance-based estimate to ${UW_DESTINATION.label}`,
    leaseTerm: 12,
    leaseNote: "Lease length not listed by RentCast",
    numBedroom: bedrooms,
    bedroomNote: isStudio ? "Studio listing" : "From RentCast listing data",
    bathrooms: Number.isFinite(Number(listing.bathrooms)) ? Number(listing.bathrooms) : undefined,
    squareFootage: Number.isFinite(Number(listing.squareFootage))
      ? Number(listing.squareFootage)
      : undefined,
    daysOnMarket: Number.isFinite(Number(listing.daysOnMarket))
      ? Number(listing.daysOnMarket)
      : undefined,
    listedDate: listing.listedDate,
    lastSeenDate: listing.lastSeenDate,
    furnished: false,
    parking: false,
    laundry: true,
    amenityNote: "Amenities should be verified on the listing site",
    latitude: listing.latitude,
    longitude: listing.longitude,
    dataSource: "rentcast",
  };
}

function getUsefulStudentListings(listings, maxListings) {
  return listings
    .filter((listing) => Number(listing.price) > 0)
    .filter((listing) => Number(listing.price) <= 3500)
    .filter((listing) => Number.isFinite(Number(listing.latitude)))
    .filter((listing) => Number.isFinite(Number(listing.longitude)))
    .sort((a, b) => {
      const distanceA = getDistanceMiles(a) ?? Number.MAX_SAFE_INTEGER;
      const distanceB = getDistanceMiles(b) ?? Number.MAX_SAFE_INTEGER;
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      return Number(a.price) - Number(b.price);
    })
    .slice(0, maxListings);
}

async function fetchRentCastListings(options = {}) {
  const apiKey = getRentCastKey();
  if (!apiKey) {
    throw new Error("RENTCAST_API_KEY is missing.");
  }

  const maxListings = Number(options.maxListings || process.env.RENTCAST_MAX_LISTINGS || 24);
  const limit = Math.min(Math.max(maxListings * 2, 20), 50);
  const radius = Number(options.radius || process.env.RENTCAST_RADIUS_MILES || 6);
  const params = new URLSearchParams({
    latitude: String(UW_DESTINATION.latitude),
    longitude: String(UW_DESTINATION.longitude),
    radius: String(radius),
    propertyType: "Apartment",
    status: "Active",
    limit: String(limit),
  });

  const response = await fetch(
    `https://api.rentcast.io/v1/listings/rental/long-term?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    }
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "RentCast listings request failed.");
  }

  return getUsefulStudentListings(data, maxListings).map(mapRentCastListing);
}

function readCachedListings() {
  if (!fs.existsSync(CACHE_PATH)) {
    return fallbackListings;
  }

  const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  return Array.isArray(data.listings) && data.listings.length > 0
    ? data.listings
    : fallbackListings;
}

function writeCachedListings(listings) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(
    CACHE_PATH,
    `${JSON.stringify(
      {
        source: "rentcast",
        refreshedAt: new Date().toISOString(),
        destination: UW_DESTINATION,
        listings,
      },
      null,
      2
    )}\n`
  );
}

async function refreshCachedListings(options = {}) {
  const listings = await fetchRentCastListings(options);
  writeCachedListings(listings);
  return listings;
}

async function getHousingListings() {
  return readCachedListings();
}

module.exports = {
  CACHE_PATH,
  fallbackListings,
  fetchRentCastListings,
  getHousingListings,
  refreshCachedListings,
};
