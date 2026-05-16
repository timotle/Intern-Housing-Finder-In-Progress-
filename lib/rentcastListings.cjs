const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", "data", "listings.json");
const ENRICHMENT_OVERRIDES_PATH = path.join(
  __dirname,
  "..",
  "data",
  "listing-enrichment-overrides.json"
);
const UW_DESTINATION = {
  label: "University of Washington",
  city: "Seattle",
  latitude: 47.6553,
  longitude: -122.3035,
};

const CITY_DESTINATIONS = {
  Seattle: { label: "Seattle", city: "Seattle", latitude: 47.6062, longitude: -122.3321 },
  Bellevue: { label: "Bellevue", city: "Bellevue", latitude: 47.6101, longitude: -122.2015 },
  Redmond: { label: "Redmond", city: "Redmond", latitude: 47.674, longitude: -122.1215 },
  Kirkland: { label: "Kirkland", city: "Kirkland", latitude: 47.6769, longitude: -122.206 },
  Renton: { label: "Renton", city: "Renton", latitude: 47.4829, longitude: -122.2171 },
  Bothell: { label: "Bothell", city: "Bothell", latitude: 47.7601, longitude: -122.2054 },
  Everett: { label: "Everett", city: "Everett", latitude: 47.9789, longitude: -122.2021 },
  Tacoma: { label: "Tacoma", city: "Tacoma", latitude: 47.2529, longitude: -122.4443 },
  Lynnwood: { label: "Lynnwood", city: "Lynnwood", latitude: 47.8279, longitude: -122.3054 },
  Woodinville: { label: "Woodinville", city: "Woodinville", latitude: 47.7543, longitude: -122.1635 },
  Sammamish: { label: "Sammamish", city: "Sammamish", latitude: 47.6163, longitude: -122.0356 },
  "Mercer Island": {
    label: "Mercer Island",
    city: "Mercer Island",
    latitude: 47.5707,
    longitude: -122.2221,
  },
  Newcastle: { label: "Newcastle", city: "Newcastle", latitude: 47.5387, longitude: -122.1557 },
  Tukwila: { label: "Tukwila", city: "Tukwila", latitude: 47.474, longitude: -122.2609 },
  Kent: { label: "Kent", city: "Kent", latitude: 47.3809, longitude: -122.2348 },
  Auburn: { label: "Auburn", city: "Auburn", latitude: 47.3073, longitude: -122.2285 },
  "Federal Way": {
    label: "Federal Way",
    city: "Federal Way",
    latitude: 47.3223,
    longitude: -122.3126,
  },
  Mukilteo: { label: "Mukilteo", city: "Mukilteo", latitude: 47.9445, longitude: -122.3046 },
};

const CITY_GROUPS = {
  Seattle: ["Seattle", "Bellevue", "Kirkland", "Renton"],
  Bellevue: ["Bellevue", "Redmond", "Kirkland", "Mercer Island", "Newcastle", "Seattle"],
  Redmond: ["Redmond", "Bellevue", "Kirkland", "Sammamish", "Woodinville", "Bothell"],
  Kirkland: ["Kirkland", "Bellevue", "Redmond", "Bothell", "Woodinville"],
  Renton: ["Renton", "Bellevue", "Newcastle", "Tukwila", "Kent", "Seattle"],
  Bothell: ["Bothell", "Kirkland", "Redmond", "Woodinville", "Lynnwood"],
  Everett: ["Everett", "Mukilteo", "Lynnwood", "Bothell"],
  Tacoma: ["Tacoma", "Federal Way", "Kent", "Auburn"],
  Lynnwood: ["Lynnwood", "Bothell", "Mukilteo", "Everett"],
  Woodinville: ["Woodinville", "Bothell", "Kirkland", "Redmond"],
  Sammamish: ["Sammamish", "Redmond", "Bellevue", "Issaquah"],
  "Mercer Island": ["Mercer Island", "Bellevue", "Seattle"],
  Newcastle: ["Newcastle", "Bellevue", "Renton"],
  Tukwila: ["Tukwila", "Renton", "Seattle", "Kent"],
  Kent: ["Kent", "Renton", "Auburn", "Federal Way"],
  Auburn: ["Auburn", "Kent", "Federal Way", "Tacoma"],
  "Federal Way": ["Federal Way", "Tacoma", "Kent", "Auburn"],
  Mukilteo: ["Mukilteo", "Everett", "Lynnwood"],
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
    bathrooms: 1,
    squareFootage: 520,
    furnished: false,
    parking: false,
    laundry: true,
    dataSource: "sample",
    priceNote: "Demo rent estimate",
  },
];

const MIN_USEFUL_SQUARE_FEET = 250;
const MAX_METADATA_BYTES = 700000;

const DIRECT_LISTING_URL_FIELDS = [
  "websiteUri",
  "listingUrl",
  "listingURL",
  "url",
  "sourceUrl",
  "sourceURL",
  "detailUrl",
  "detailURL",
  "websiteUrl",
  "websiteURL",
  "propertyUrl",
  "propertyURL",
  "permalink",
];

const CONTACT_URL_FIELDS = [
  "listingAgent.website",
  "listingOffice.website",
  "agent.website",
  "office.website",
  "broker.website",
  "propertyManager.website",
];

const BLOCKED_DISCOVERY_HOSTS = [
  "rentcast.io",
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
];

const RENTAL_DISCOVERY_HOST_HINTS = [
  "apartments.com",
  "apartmentguide.com",
  "zillow.com",
  "trulia.com",
  "hotpads.com",
  "rent.com",
  "forrent.com",
  "apartmentfinder.com",
  "craigslist.org",
  "avail.co",
  "zumper.com",
  "padmapper.com",
  "rentler.com",
  "showmojo.com",
  "appfolio.com",
  "rentseattle.com",
];

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const pageMetadataCache = new Map();
const listingDiscoveryCache = new Map();

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

  if (normalizedValue.includes("seattle") || normalizedValue.includes("downtown")) {
    return "Seattle";
  }

  if (normalizedValue.includes("bellevue")) {
    return "Bellevue";
  }

  if (normalizedValue.includes("redmond")) {
    return "Redmond";
  }

  if (normalizedValue.includes("kirkland")) {
    return "Kirkland";
  }

  if (normalizedValue.includes("renton")) {
    return "Renton";
  }

  if (normalizedValue.includes("bothell")) {
    return "Bothell";
  }

  if (normalizedValue.includes("everett")) {
    return "Everett";
  }

  if (normalizedValue.includes("tacoma")) {
    return "Tacoma";
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
  const unitMatch = String(listing.formattedAddress || "").match(
    /,\s*((?:Apt|Apartment|Unit|#)\s*[^,]+)/i
  );
  const unitLabel = unitMatch ? unitMatch[1].replace(/^Apartment/i, "Apt").trim() : "";

  if (listing.addressLine1) {
    return [listing.addressLine1, unitLabel].filter(Boolean).join(" ");
  }

  return listing.formattedAddress || "Rental listing";
}

function getListingLocation(listing) {
  return [listing.city, listing.state, listing.zipCode].filter(Boolean).join(", ");
}

function getListingCity(listing) {
  return String(listing.city || "").trim();
}

function getNestedValue(source, pathName) {
  return pathName.split(".").reduce((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return current[key];
  }, source);
}

function normalizeUrl(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmedValue)) {
    return `https://${trimmedValue}`;
  }

  return undefined;
}

function getUrlHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isBlockedDiscoveryUrl(url) {
  const host = getUrlHost(url);
  return BLOCKED_DISCOVERY_HOSTS.some(
    (blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`)
  );
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value = "") {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function getFirstUrlFromFields(listing, fields) {
  for (const field of fields) {
    const url = normalizeUrl(getNestedValue(listing, field));
    if (url) {
      return url;
    }
  }

  return undefined;
}

function isEastsideTarget(destination = UW_DESTINATION) {
  return ["Bellevue", "Redmond", "Kirkland", "Renton", "Bothell"].includes(destination.city);
}

function isUsefulCityForTarget(listing, destination = UW_DESTINATION) {
  const allowedCities = CITY_GROUPS[destination.city];
  if (!allowedCities) {
    return true;
  }

  return allowedCities.includes(getListingCity(listing));
}

function getDirectListingWebsite(listing) {
  return getFirstUrlFromFields(listing, DIRECT_LISTING_URL_FIELDS);
}

function getContactWebsite(listing) {
  return getFirstUrlFromFields(listing, CONTACT_URL_FIELDS);
}

function isImageUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();
  return /^https?:\/\//i.test(trimmedValue);
}

function collectImageUrls(value, imageUrls = []) {
  if (!value) {
    return imageUrls;
  }

  if (typeof value === "string") {
    if (isImageUrl(value)) {
      imageUrls.push(value.trim());
    }
    return imageUrls;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, imageUrls));
    return imageUrls;
  }

  if (typeof value === "object") {
    [
      value.url,
      value.href,
      value.src,
      value.image,
      value.imageUrl,
      value.photo,
      value.photoUrl,
      value.thumbnail,
      value.thumbnailUrl,
      value.mediumUrl,
      value.largeUrl,
    ].forEach((item) => collectImageUrls(item, imageUrls));
  }

  return imageUrls;
}

function getListingImageUrls(listing) {
  const imageUrls = [];
  [
    listing.photos,
    listing.photoUrls,
    listing.images,
    listing.imageUrls,
    listing.media,
    listing.pictures,
    listing.thumbnail,
    listing.thumbnailUrl,
    listing.primaryPhoto,
    listing.primaryImage,
  ].forEach((field) => collectImageUrls(field, imageUrls));

  return [...new Set(imageUrls)].slice(0, 8);
}

function getListingOfficeName(listing) {
  return (
    getNestedValue(listing, "listingOffice.name") ||
    getNestedValue(listing, "office.name") ||
    getNestedValue(listing, "broker.name") ||
    getNestedValue(listing, "propertyManager.name") ||
    undefined
  );
}

function getListingAgentName(listing) {
  return (
    getNestedValue(listing, "listingAgent.name") ||
    getNestedValue(listing, "agent.name") ||
    getNestedValue(listing, "propertyManager.name") ||
    undefined
  );
}

function getListingLinkType(listing, websiteUri) {
  if (websiteUri) {
    if (listing.listingLinkType === "discovered") {
      return "discovered";
    }

    return "direct";
  }

  return "unavailable";
}

function hasCompleteRentCastHousingData(listing) {
  const price = Number(listing.price);
  const latitude = Number(listing.latitude);
  const longitude = Number(listing.longitude);
  const bedrooms = Number(listing.bedrooms);
  const bathrooms = Number(listing.bathrooms);
  const squareFootage = Number(listing.squareFootage);

  return (
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(bedrooms) &&
    bedrooms >= 0 &&
    Number.isFinite(bathrooms) &&
    bathrooms > 0 &&
    Number.isFinite(squareFootage) &&
    squareFootage >= MIN_USEFUL_SQUARE_FEET
  );
}

function hasCompleteMappedHousingData(listing) {
  const price = Number(listing.price);
  const latitude = Number(listing.latitude);
  const longitude = Number(listing.longitude);
  const bedrooms = Number(listing.numBedroom);
  const bathrooms = Number(listing.bathrooms);
  const squareFootage = Number(listing.squareFootage);

  return (
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(bedrooms) &&
    bedrooms >= 0 &&
    Number.isFinite(bathrooms) &&
    bathrooms > 0 &&
    Number.isFinite(squareFootage) &&
    squareFootage >= MIN_USEFUL_SQUARE_FEET
  );
}

function mapRentCastListing(listing, index, destination = UW_DESTINATION) {
  const bedrooms = Number(listing.bedrooms);
  const isStudio = bedrooms === 0;
  const websiteUri = getDirectListingWebsite(listing);
  const contactUri = websiteUri ? undefined : getContactWebsite(listing);
  const imageUrls = getListingImageUrls(listing);
  const listingOfficeName = getListingOfficeName(listing);
  const listingAgentName = getListingAgentName(listing);

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
    bathrooms: Number(listing.bathrooms),
    squareFootage: Number(listing.squareFootage),
    daysOnMarket: Number.isFinite(Number(listing.daysOnMarket))
      ? Number(listing.daysOnMarket)
      : undefined,
    listedDate: listing.listedDate,
    lastSeenDate: listing.lastSeenDate,
    websiteUri,
    websiteLabel: listing.websiteLabel || "View listing",
    contactUri,
    contactLabel: listingOfficeName
      ? `Contact ${listingOfficeName}`
      : "Contact listing office",
    listingOfficeName,
    listingAgentName,
    imageUrls,
    listingLinkType: getListingLinkType(listing, websiteUri),
    linkConfidence: listing.linkConfidence,
    discoveredListingTitle: listing.discoveredListingTitle,
    furnished: false,
    parking: false,
    laundry: false,
    amenitiesKnown: false,
    amenityNote: "Amenity details are not listed yet",
    latitude: listing.latitude,
    longitude: listing.longitude,
    dataSource: "rentcast",
  };
}

function getUsefulStudentListings(listings, maxListings, destination = UW_DESTINATION) {
  return listings
    .filter(hasCompleteRentCastHousingData)
    .filter((listing) => Number(listing.price) > 0)
    .filter((listing) => Number(listing.price) <= 5000)
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

function getSearchCities(destination = UW_DESTINATION) {
  const groupedCities = CITY_GROUPS[destination.city] || [destination.city];
  return [...new Set([destination.city, ...groupedCities])].filter(Boolean);
}

function getSearchPoints(destination = UW_DESTINATION) {
  const cityPoints = getSearchCities(destination)
    .map((city) => CITY_DESTINATIONS[city])
    .filter(Boolean);

  return [
    destination,
    ...cityPoints,
  ].filter((point, index, points) => {
    const key = `${Number(point.latitude).toFixed(4)}|${Number(point.longitude).toFixed(4)}`;
    return points.findIndex((candidate) => {
      const candidateKey = `${Number(candidate.latitude).toFixed(4)}|${Number(candidate.longitude).toFixed(4)}`;
      return candidateKey === key;
    }) === index;
  });
}

function getListingDedupeKey(listing) {
  if (listing.id) {
    return String(listing.id);
  }

  return [
    listing.formattedAddress,
    listing.addressLine1,
    listing.unitNumber,
    listing.city,
    listing.zipCode,
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function getOverrideKeys(listing) {
  return [
    listing.id,
    listing.rentcastId,
    listing.placeId,
    listing.formattedAddress,
    listing.address,
    [listing.addressLine1, listing.city, listing.state, listing.zipCode]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
}

function loadListingEnrichmentOverrides() {
  if (!fs.existsSync(ENRICHMENT_OVERRIDES_PATH)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(ENRICHMENT_OVERRIDES_PATH, "utf8"));
    return Array.isArray(data.overrides) ? data.overrides : [];
  } catch (error) {
    console.error("Could not read listing enrichment overrides:", error.message);
    return [];
  }
}

function applyListingOverride(listing, overrides) {
  const keys = new Set(getOverrideKeys(listing));
  const override = overrides.find((item) => {
    const itemKeys = [
      item.id,
      item.rentcastId,
      item.placeId,
      item.formattedAddress,
      item.address,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    return itemKeys.some((key) => keys.has(key));
  });

  if (!override) {
    return listing;
  }

  return {
    ...listing,
    ...override,
    imageUrls: [
      ...getListingImageUrls(listing),
      ...getListingImageUrls(override),
    ],
    listingUrl: normalizeUrl(override.listingUrl || override.websiteUri) || listing.listingUrl,
    websiteUri: normalizeUrl(override.websiteUri || override.listingUrl) || listing.websiteUri,
  };
}

function dedupeListings(listings) {
  const seen = new Set();
  return listings.filter((listing) => {
    const key = getListingDedupeKey(listing);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchRentCastListingDetails(listing, apiKey) {
  if (!listing.id) {
    return listing;
  }

  const response = await fetch(
    `https://api.rentcast.io/v1/listings/rental/long-term/${encodeURIComponent(listing.id)}`,
    {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    }
  );

  if (!response.ok) {
    return listing;
  }

  const details = await response.json();
  if (!details || typeof details !== "object") {
    return listing;
  }

  return {
    ...listing,
    ...details,
    imageUrls: [
      ...getListingImageUrls(listing),
      ...getListingImageUrls(details),
    ],
  };
}

function extractMetaContent(html, propertyNames) {
  for (const propertyName of propertyNames) {
    const escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["'][^>]*>`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1].replace(/&amp;/g, "&").trim();
      }
    }
  }

  return undefined;
}

function resolveRelativeUrl(value, baseUrl) {
  const normalized = normalizeUrl(value);
  if (normalized) {
    return normalized;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function isUsefulCanonicalUrl(url) {
  const normalizedUrl = normalizeUrl(url);
  return Boolean(
    normalizedUrl &&
      !/\/undefined(?:[/?#]|$)/i.test(normalizedUrl) &&
      !/\/null(?:[/?#]|$)/i.test(normalizedUrl)
  );
}

function isUsefulScrapedImageUrl(url) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  const loweredUrl = normalizedUrl.toLowerCase();
  return (
    /\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/i.test(loweredUrl) &&
    !/(logo|favicon|sprite|icon|avatar|placeholder|blank|transparent|tracking)/i.test(
      loweredUrl
    )
  );
}

function extractPageImageUrls(html, baseUrl) {
  const urls = [];
  const attributePattern =
    /\b(?:src|data-src|data-original|data-lazy-src|content)=["']([^"']+)["']/gi;
  const srcSetPattern = /\b(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  let match;

  while ((match = attributePattern.exec(html))) {
    const url = resolveRelativeUrl(decodeHtmlEntities(match[1]), baseUrl);
    if (isUsefulScrapedImageUrl(url)) {
      urls.push(url);
    }
  }

  while ((match = srcSetPattern.exec(html))) {
    decodeHtmlEntities(match[1])
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .forEach((srcSetUrl) => {
        const url = resolveRelativeUrl(srcSetUrl, baseUrl);
        if (isUsefulScrapedImageUrl(url)) {
          urls.push(url);
        }
      });
  }

  return [...new Set(urls)].slice(0, 8);
}

async function fetchPageMetadata(url) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return {};
  }

  if (pageMetadataCache.has(normalizedUrl)) {
    return pageMetadataCache.get(normalizedUrl);
  }

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": BROWSER_USER_AGENT,
      },
      redirect: "follow",
    });

    if (!response.ok) {
      pageMetadataCache.set(normalizedUrl, {});
      return {};
    }

    const html = (await response.text()).slice(0, MAX_METADATA_BYTES);
    const imageUrl = resolveRelativeUrl(
      extractMetaContent(html, [
        "og:image:secure_url",
        "og:image",
        "twitter:image",
        "twitter:image:src",
      ]),
      normalizedUrl
    );
    const canonicalUrl = resolveRelativeUrl(
      extractMetaContent(html, ["og:url", "twitter:url"]),
      normalizedUrl
    );

    const metadata = {
      imageUrls: [
        ...(imageUrl ? [imageUrl] : []),
        ...extractPageImageUrls(html, normalizedUrl),
      ].filter((item, index, items) => items.indexOf(item) === index).slice(0, 8),
      canonicalUrl: isUsefulCanonicalUrl(canonicalUrl) ? canonicalUrl : undefined,
    };
    pageMetadataCache.set(normalizedUrl, metadata);
    return metadata;
  } catch {
    pageMetadataCache.set(normalizedUrl, {});
    return {};
  }
}

function getListingAddressText(listing) {
  return (
    listing.formattedAddress ||
    listing.address ||
    [listing.addressLine1, listing.city, listing.state, listing.zipCode]
      .filter(Boolean)
      .join(" ")
  );
}

function buildListingDiscoveryQueries(listing) {
  const address =
    getListingAddressText(listing);
  const streetAddress = listing.addressLine1 || listing.name || address;
  const cityZip = [listing.city, listing.state, listing.zipCode].filter(Boolean).join(" ");

  return [
    `"${address}" rent apartment listing`,
    `"${streetAddress}" "${cityZip}" apartment`,
    `"${streetAddress}" ${listing.city || ""} rental listing`,
  ].filter(Boolean);
}

function decodeDuckDuckGoUrl(rawHref) {
  const href = decodeHtmlEntities(rawHref);

  try {
    const url = new URL(href, "https://duckduckgo.com");
    const redirectedUrl = url.searchParams.get("uddg");
    if (redirectedUrl) {
      return normalizeUrl(decodeURIComponent(redirectedUrl));
    }

    return normalizeUrl(url.toString());
  } catch {
    return normalizeUrl(href);
  }
}

function decodeBingUrl(rawHref) {
  const href = decodeHtmlEntities(rawHref);

  try {
    const url = new URL(href);
    const encodedTarget = url.searchParams.get("u");
    if (encodedTarget?.startsWith("a1")) {
      const base64Value = encodedTarget
        .slice(2)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const decodedTarget = Buffer.from(base64Value, "base64").toString("utf8");
      return normalizeUrl(decodedTarget);
    }

    return normalizeUrl(url.toString());
  } catch {
    return normalizeUrl(href);
  }
}

function extractSearchResults(html) {
  const results = [];
  const resultPattern = /<div[^>]+class=["'][^"']*result[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match;

  while ((match = resultPattern.exec(html))) {
    const block = match[1];
    const linkMatch = block.match(
      /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
    );
    if (!linkMatch) {
      continue;
    }

    const url = decodeDuckDuckGoUrl(linkMatch[1]);
    if (!url || isBlockedDiscoveryUrl(url)) {
      continue;
    }

    const snippetMatch = block.match(
      /<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>|<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );

    results.push({
      url,
      title: stripHtml(linkMatch[2]),
      snippet: stripHtml(snippetMatch?.[1] || snippetMatch?.[2] || ""),
    });
  }

  return results;
}

function extractBingSearchResults(html) {
  const results = [];
  const resultPattern = /<li[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = resultPattern.exec(html))) {
    const block = match[1];
    const linkMatch = block.match(
      /<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i
    );
    if (!linkMatch) {
      continue;
    }

    const url = decodeBingUrl(linkMatch[1]);
    if (!url || isBlockedDiscoveryUrl(url)) {
      continue;
    }

    const snippetMatch = block.match(
      /<div[^>]+class=["'][^"']*b_caption[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
    );

    results.push({
      url,
      title: stripHtml(linkMatch[2]),
      snippet: stripHtml(snippetMatch?.[1] || ""),
    });
  }

  return results;
}

function getAddressTokens(listing) {
  const address = getListingAddressText(listing);

  return String(address)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 || /^\d+$/.test(token))
    .slice(0, 10);
}

function hasLocationMatch(result, listing) {
  const haystack = `${result.title} ${result.snippet || ""} ${result.url}`.toLowerCase();
  const zipCode = String(listing.zipCode || "").trim();
  const city = String(listing.city || "").trim().toLowerCase();
  const state = String(listing.state || "WA").trim().toLowerCase();

  if (zipCode && haystack.includes(zipCode)) {
    return true;
  }

  return Boolean(
    city &&
      haystack.includes(city) &&
      (haystack.includes(` ${state} `) ||
        haystack.includes(`-${state}-`) ||
        haystack.includes("washington"))
  );
}

function hasStreetMatch(result, listing) {
  const haystack = `${result.title} ${result.snippet || ""} ${result.url}`.toLowerCase();
  const streetTokens = String(listing.addressLine1 || listing.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 || /^\d+$/.test(token));
  const streetNumber = streetTokens.find((token) => /^\d+$/.test(token));
  const meaningfulStreetToken = streetTokens.find(
    (token) => !/^\d+$/.test(token) && !["ave", "way", "unit", "apt", "ste"].includes(token)
  );

  return Boolean(
    (!streetNumber || haystack.includes(streetNumber)) &&
      (!meaningfulStreetToken || haystack.includes(meaningfulStreetToken))
  );
}

function getUnitToken(listing) {
  const address = [
    listing.formattedAddress,
    listing.address,
    listing.name,
    listing.addressLine1,
    listing.unitNumber,
  ]
    .filter(Boolean)
    .join(" ");
  const match = String(address).match(/\b(?:apt|apartment|unit|#)\s*([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase();
}

function hasUnitMatch(result, listing) {
  const unitToken = getUnitToken(listing);
  if (!unitToken) {
    return true;
  }

  const haystack = `${result.title} ${result.snippet || ""} ${result.url}`
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/[+_]/g, " ");
  const escapedUnit = unitToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const unitPattern = new RegExp(
    `(?:\\b(?:apt|apartment|unit|#)\\s*${escapedUnit}\\b|[-/\\s]${escapedUnit}(?:[-/\\s]|$))`,
    "i"
  );

  return unitPattern.test(haystack);
}

function isRentalDiscoveryHost(host) {
  return RENTAL_DISCOVERY_HOST_HINTS.some(
    (hostHint) => host === hostHint || host.endsWith(`.${hostHint}`)
  );
}

function hasRentalIntent(result) {
  const haystack = `${result.title} ${result.snippet || ""} ${result.url}`.toLowerCase();
  return /\b(rent|rental|apartment|apartments|lease|floorplan|floorplans|available|availability)\b/i.test(
    haystack
  );
}

function scoreDiscoveryResult(result, listing) {
  const haystack = `${result.title} ${result.snippet || ""} ${result.url}`.toLowerCase();
  const tokens = getAddressTokens(listing);
  const host = getUrlHost(result.url);
  let score = 0;

  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += /^\d+$/.test(token) ? 4 : 2;
    }
  });

  if (isRentalDiscoveryHost(host)) {
    score += 5;
  }

  if (hasRentalIntent(result)) {
    score += 4;
  }

  if (/\b(sold|sale|estimate|property-record|public-record|radio|listen|podcast|song)\b/i.test(haystack)) {
    score -= 6;
  }

  if (!hasLocationMatch(result, listing)) {
    score -= 20;
  }

  if (!hasStreetMatch(result, listing)) {
    score -= 12;
  }

  if (!hasUnitMatch(result, listing)) {
    score -= 18;
  }

  if (!hasRentalIntent(result) && !isRentalDiscoveryHost(host)) {
    score -= 14;
  }

  return score;
}

async function discoverListingPage(listing) {
  const discoveryCacheKey = getListingAddressText(listing).toLowerCase();
  if (listingDiscoveryCache.has(discoveryCacheKey)) {
    return listingDiscoveryCache.get(discoveryCacheKey);
  }

  try {
    const discoveredResults = [];

    for (const query of buildListingDiscoveryQueries(listing)) {
      const searches = [
        {
          url: `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          extractor: extractSearchResults,
        },
        {
          url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
          extractor: extractBingSearchResults,
        },
      ];

      for (const search of searches) {
        const response = await fetch(search.url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": BROWSER_USER_AGENT,
          },
        });

        if (!response.ok) {
          continue;
        }

        discoveredResults.push(...search.extractor(await response.text()));
      }
    }

    const candidateResults = discoveredResults
      .map((result) => ({
        ...result,
        score: scoreDiscoveryResult(result, listing),
      }))
      .filter((result, index, results) => {
        const firstIndex = results.findIndex((candidate) => candidate.url === result.url);
        return firstIndex === index && result.score >= 7;
      })
      .sort((a, b) => b.score - a.score);
    const [bestResult] = candidateResults;

    if (!bestResult) {
      listingDiscoveryCache.set(discoveryCacheKey, {});
      return {};
    }

    let selectedResult = bestResult;
    let selectedMetadata = {};

    for (const candidate of candidateResults.slice(0, 4)) {
      const candidateHost = getUrlHost(candidate.url);
      if (!hasRentalIntent(candidate) && !isRentalDiscoveryHost(candidateHost)) {
        continue;
      }

      const metadata = await fetchPageMetadata(candidate.url);
      if ((metadata.imageUrls || []).length > 0) {
        selectedResult = candidate;
        selectedMetadata = metadata;
        break;
      }

      if (candidate === bestResult) {
        selectedMetadata = metadata;
      }
    }

    const discoveredListing = {
      websiteUri: selectedMetadata.canonicalUrl || selectedResult.url,
      websiteLabel: "View listing page",
      imageUrls: selectedMetadata.imageUrls || [],
      listingLinkType: selectedResult.score >= 14 ? "direct" : "discovered",
      linkConfidence: selectedResult.score >= 14 ? "high" : "medium",
      discoveredListingTitle: selectedResult.title,
    };
    listingDiscoveryCache.set(discoveryCacheKey, discoveredListing);
    return discoveredListing;
  } catch {
    listingDiscoveryCache.set(discoveryCacheKey, {});
    return {};
  }
}

async function enrichListingFromKnownWebPage(listing) {
  const websiteUri = getDirectListingWebsite(listing) || listing.websiteUri;
  if (!websiteUri) {
    return listing;
  }

  const metadata = await fetchPageMetadata(websiteUri);
  const imageUrls = [
    ...getListingImageUrls(listing),
    ...(metadata.imageUrls || []),
  ];

  return {
    ...listing,
    websiteUri: metadata.canonicalUrl || websiteUri,
    imageUrls,
  };
}

async function enrichListingFromDiscovery(listing) {
  if (getDirectListingWebsite(listing)) {
    return listing;
  }

  const discovered = await discoverListingPage(listing);
  if (!discovered.websiteUri) {
    return listing;
  }

  return {
    ...listing,
    ...discovered,
    imageUrls: [
      ...getListingImageUrls(listing),
      ...getListingImageUrls(discovered),
    ],
  };
}

async function enrichListings(listings, apiKey, maxListings) {
  const overrides = loadListingEnrichmentOverrides();
  const shouldFetchDetails = process.env.RENTCAST_ENRICH_DETAILS !== "false";
  const shouldFetchPageMetadata = process.env.LISTING_METADATA_SCRAPE !== "false";
  const shouldDiscoverListingLinks = process.env.LISTING_LINK_DISCOVERY !== "false";
  const requestedDetailLimit = Number(
    process.env.RENTCAST_DETAIL_ENRICHMENT_LIMIT || maxListings || 12
  );
  const safeDetailLimit =
    Number.isFinite(requestedDetailLimit) && requestedDetailLimit > 0
      ? requestedDetailLimit
      : 12;
  const detailLimit = Math.min(
    Math.floor(safeDetailLimit),
    Math.max(maxListings || 12, 12)
  );
  const requestedDiscoveryLimit = Number(
    process.env.LISTING_LINK_DISCOVERY_LIMIT || Math.min(maxListings || 8, 8)
  );
  const discoveryLimit =
    Number.isFinite(requestedDiscoveryLimit) && requestedDiscoveryLimit > 0
      ? Math.floor(requestedDiscoveryLimit)
      : 0;

  const detailListings = [];
  for (const [index, listing] of listings.slice(0, detailLimit).entries()) {
    const withDetails = shouldFetchDetails
      ? await fetchRentCastListingDetails(listing, apiKey)
      : listing;
    const withOverride = applyListingOverride(withDetails, overrides);
    const withMetadata = shouldFetchPageMetadata
      ? await enrichListingFromKnownWebPage(withOverride)
      : withOverride;
    const withDiscovery =
      shouldDiscoverListingLinks && index < discoveryLimit
        ? await enrichListingFromDiscovery(withMetadata)
        : withMetadata;

    detailListings.push(withDiscovery);
  }

  const remainingListings = [];
  for (const [index, listing] of listings.slice(detailLimit).entries()) {
    const withOverride = applyListingOverride(listing, overrides);
    const withDiscovery =
      shouldDiscoverListingLinks && detailLimit + index < discoveryLimit
        ? await enrichListingFromDiscovery(withOverride)
        : withOverride;

    remainingListings.push(withDiscovery);
  }

  return [...detailListings, ...remainingListings];
}

async function fetchRentCastListings(options = {}) {
  const apiKey = getRentCastKey();
  if (!apiKey) {
    throw new Error("RENTCAST_API_KEY is missing.");
  }

  const destination = getSearchTarget(options);
  const requestedMaxListings = Number(options.maxListings || process.env.RENTCAST_MAX_LISTINGS || 24);
  const maxListings =
    Number.isFinite(requestedMaxListings) && requestedMaxListings > 0
      ? Math.min(Math.floor(requestedMaxListings), 50)
      : 24;
  const limit = Math.min(Math.max(maxListings * 2, 20), 50);
  const requestedRadius = Number(options.radius || process.env.RENTCAST_RADIUS_MILES || 8);
  const startingRadius =
    Number.isFinite(requestedRadius) && requestedRadius > 0 ? requestedRadius : 8;
  const radiusOptions = [...new Set([startingRadius, 12, 18, 25, 35])]
    .filter((radius) => Number.isFinite(radius) && radius > 0)
    .sort((a, b) => a - b);
  const searches = [
    ...getSearchCities(destination).map((city) => ({
      city,
      state: "WA",
      status: "Active",
      limit: String(limit),
    })),
    ...getSearchPoints(destination).flatMap((point) =>
      radiusOptions.map((radius) => ({
        latitude: String(point.latitude),
        longitude: String(point.longitude),
        radius: String(radius),
        status: "Active",
        limit: String(limit),
      }))
    ),
  ];
  const collectedListings = [];

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

    if (Array.isArray(data)) {
      collectedListings.push(...data);
    }

    const usefulListings = getUsefulStudentListings(
      dedupeListings(collectedListings),
      Math.max(maxListings * 2, maxListings),
      destination
    );
    if (usefulListings.length >= Math.min(maxListings, 12)) {
      const enrichedListings = await enrichListings(
        usefulListings.slice(0, maxListings),
        apiKey,
        maxListings
      );
      return enrichedListings.map((listing, index) =>
        mapRentCastListing(listing, index, destination)
      );
    }
  }

  const usefulListings = getUsefulStudentListings(
    dedupeListings(collectedListings),
    maxListings,
    destination
  );
  const enrichedListings = await enrichListings(usefulListings, apiKey, maxListings);

  return enrichedListings.map((listing, index) => mapRentCastListing(listing, index, destination));
}

function readCachedListings() {
  if (!fs.existsSync(CACHE_PATH)) {
    return fallbackListings;
  }

  const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  const cachedListings = Array.isArray(data.listings)
    ? data.listings.filter(hasCompleteMappedHousingData)
    : [];

  return cachedListings.length > 0
    ? cachedListings
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

  return readCachedListings();
}

module.exports = {
  CACHE_PATH,
  ENRICHMENT_OVERRIDES_PATH,
  fallbackListings,
  fetchRentCastListings,
  getHousingListings,
  refreshCachedListings,
};
