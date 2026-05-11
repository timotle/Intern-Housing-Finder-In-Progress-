const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", "data", "listings.json");
const UW_DESTINATION = {
  label: "University of Washington",
  city: "Seattle",
  latitude: 47.6553,
  longitude: -122.3035,
};

const EASTSIDE_CITY_GROUPS = {
  Bellevue: ["Bellevue", "Redmond", "Kirkland", "Mercer Island", "Newcastle"],
  Redmond: ["Redmond", "Bellevue", "Kirkland", "Sammamish", "Woodinville"],
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

function getSearchTarget(options = {}) {
  const latitude = Number(options.latitude);
  const longitude = Number(options.longitude);
  const label = String(options.targetLabel || options.label || "your internship area");
  const city = getTargetCity(options.targetCity || label);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      label,
      city,
      latitude,
      longitude,
    };
  }

  return UW_DESTINATION;
}

function getTargetCity(value = "") {
  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue.includes("bellevue")) {
    return "Bellevue";
  }

  if (normalizedValue.includes("redmond")) {
    return "Redmond";
  }

  if (normalizedValue.includes("kirkland")) {
    return "Kirkland";
  }

  return "Seattle";
}

function estimateCommuteMinutes(listing, destination = UW_DESTINATION) {
  const miles = getDistanceMiles(listing, destination);
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

function getListingCity(listing) {
  return String(listing.city || "").trim();
}

function isEastsideTarget(destination = UW_DESTINATION) {
  return destination.city === "Bellevue" || destination.city === "Redmond";
}

function isUsefulCityForTarget(listing, destination = UW_DESTINATION) {
  if (!isEastsideTarget(destination)) {
    return true;
  }

  const allowedCities = EASTSIDE_CITY_GROUPS[destination.city] || [destination.city];
  return allowedCities.includes(getListingCity(listing));
}

function getListingWebsite(listing) {
  return (
    listing.listingUrl ||
    listing.url ||
    listing.sourceUrl ||
    listing.detailUrl ||
    listing.websiteUri ||
    listing.listingAgent?.website ||
    listing.listingOffice?.website ||
    undefined
  );
}

function hasDirectListingWebsite(listing) {
  if (listing.listingUrl || listing.url || listing.sourceUrl || listing.detailUrl) {
    return true;
  }

  return false;
}

function getListingLinkType(listing, websiteUri) {
  if (hasDirectListingWebsite(listing)) {
    return "direct";
  }

  if (websiteUri) {
    return "source";
  }

  return "search";
}

function getListingSearchUri(listing) {
  const query = [
    listing.formattedAddress || listing.addressLine1,
    listing.city,
    listing.state,
    "rental listing",
  ]
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function mapRentCastListing(listing, index, destination = UW_DESTINATION) {
  const bedrooms = Number.isFinite(Number(listing.bedrooms)) ? Number(listing.bedrooms) : 1;
  const isStudio = bedrooms === 0;
  const websiteUri = getListingWebsite(listing);

  return {
    id: index + 1,
    placeId: listing.id,
    rentcastId: listing.id,
    name: getListingName(listing),
    price: Number(listing.price) || 0,
    priceNote: "RentCast active rental listing",
    location: getListingLocation(listing) || listing.formattedAddress || "Seattle, WA",
    address: listing.formattedAddress,
    commuteTime: estimateCommuteMinutes(listing, destination),
    commuteNote: `Distance-based estimate to ${destination.label}`,
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
    websiteUri,
    websiteLabel: "Check availability",
    listingSearchUri: getListingSearchUri(listing),
    listingLinkType: getListingLinkType(listing, websiteUri),
    furnished: false,
    parking: false,
    laundry: true,
    amenityNote: "Amenities should be verified on the listing site",
    latitude: listing.latitude,
    longitude: listing.longitude,
    dataSource: "rentcast",
  };
}

function getUsefulStudentListings(listings, maxListings, destination = UW_DESTINATION) {
  return listings
    .filter((listing) => Number(listing.price) > 0)
    .filter((listing) => Number(listing.price) <= 3500)
    .filter((listing) => Number.isFinite(Number(listing.latitude)))
    .filter((listing) => Number.isFinite(Number(listing.longitude)))
    .filter((listing) => isUsefulCityForTarget(listing, destination))
    .sort((a, b) => {
      const distanceA = getDistanceMiles(a, destination) ?? Number.MAX_SAFE_INTEGER;
      const distanceB = getDistanceMiles(b, destination) ?? Number.MAX_SAFE_INTEGER;
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

  const destination = getSearchTarget(options);
  const maxListings = Number(options.maxListings || process.env.RENTCAST_MAX_LISTINGS || 24);
  const limit = Math.min(Math.max(maxListings * 2, 20), 50);
  const startingRadius = Number(options.radius || process.env.RENTCAST_RADIUS_MILES || 8);
  const radiusOptions = [...new Set([startingRadius, 12, 18])]
    .filter((radius) => Number.isFinite(radius) && radius > 0)
    .sort((a, b) => a - b);
  const searches = [
    {
      city: destination.city,
      state: "WA",
      status: "Active",
      limit: String(limit),
    },
    ...radiusOptions.map((radius) => ({
      latitude: String(destination.latitude),
      longitude: String(destination.longitude),
      radius: String(radius),
      status: "Active",
      limit: String(limit),
    })),
  ];

  for (const search of searches) {
    const params = new URLSearchParams(search);

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

    const usefulListings = getUsefulStudentListings(data, maxListings, destination);
    if (usefulListings.length > 0) {
      return usefulListings.map((listing, index) =>
        mapRentCastListing(listing, index, destination)
      );
    }
  }

  return [];
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

async function getHousingListings(options = {}) {
  const hasLocationSearch =
    Number.isFinite(Number(options.latitude)) && Number.isFinite(Number(options.longitude));
  const destination = getSearchTarget(options);

  if (hasLocationSearch && getRentCastKey()) {
    try {
      const liveListings = await fetchRentCastListings(options);
      if (liveListings.length > 0) {
        return liveListings;
      }
    } catch (error) {
      console.error("Could not load location-based RentCast listings:", error.message);
    }
  }

  if (hasLocationSearch && isEastsideTarget(destination)) {
    return [];
  }

  return readCachedListings();
}

module.exports = {
  CACHE_PATH,
  fallbackListings,
  fetchRentCastListings,
  getHousingListings,
  refreshCachedListings,
};
