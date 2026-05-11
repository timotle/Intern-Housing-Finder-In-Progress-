import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "./types";
import ListingCard from "./components/ListingCard";
import {
  predictTasteProfile,
  type TasteProfileLabel,
} from "./data/tasteProfileModel";

type UserPreferences = {
  commuteTarget: string;
  commuteArea: string;
  commuteLatitude: number;
  commuteLongitude: number;
  maxPrice: string;
  maxCommuteTime: string;
  leaseTerm: string;
  minBedrooms: string;
  minSquareFeet: string;
  minBaths: string;
  furnishedOnly: boolean;
  laundryOnly: boolean;
  parkingOnly: boolean;
};

type ScoreBreakdownItem = {
  label: string;
  points: number;
  explanation: string;
};

type ExplainableListing = Listing & {
  matchScore?: number;
  scoreBreakdown?: ScoreBreakdownItem[];
};

type ScoredListing = ExplainableListing & {
  matchScore: number;
  scoreBreakdown: ScoreBreakdownItem[];
};

type ScoreCategoryKey =
  | "budget"
  | "commute"
  | "lease"
  | "bedrooms"
  | "squareFeet"
  | "baths"
  | "amenities";
type ChartMetric =
  | "matchScore"
  | "price"
  | "commuteTime"
  | "leaseTerm"
  | "numBedroom"
  | "squareFootage"
  | "bathrooms";
type ChartType = "bar" | "line";
type PageKey = "home" | "location" | "preferences" | "ranking" | "results";
type StepPageKey = Exclude<PageKey, "home">;
type RankingMode = "default" | "custom" | "skipped";
type InteractionSignals = {
  explanationClicks: number[];
  resultPageViews: number;
  chartMetricChanges: number;
  listingPageChanges: number;
};

type TasteProfile = {
  title: string;
  summary: string;
  fitTip: string;
  smartSuggestion: string;
};

type CommuteTarget = {
  id: string;
  label: string;
  area: string;
  latitude: number;
  longitude: number;
  keywords: string[];
  source?: "preset" | "openai" | "fallback";
  confidence?: "high" | "medium" | "low";
  note?: string;
};

type CommuteResolutionStatus = "idle" | "resolving" | "resolved" | "fallback";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const commuteTargets: CommuteTarget[] = [
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
];

async function getMatchExplanation(
  userPreferences: UserPreferences,
  selectedListing: ExplainableListing,
  visibleListings: ExplainableListing[]
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/explain-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userPreferences,
        selectedListing,
        visibleListings,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Sorry explanation could not be fetched");
    }

    return data.explanation;
  } catch (error) {
    console.error("The explanation error:", error);
    if (
      error instanceof Error &&
      /api key|incorrect api key|unauthorized/i.test(error.message)
    ) {
      return "Sorry, the AI explanation could not be generated right now because the API key needs to be updated.";
    }

    return error instanceof Error
      ? `Sorry, the AI explanation could not be generated right now. ${error.message}`
      : "Sorry, the AI explanation could not be generated right now.";
  }
}

async function resolveCommuteTarget(
  query: string,
  fallbackTarget: CommuteTarget
): Promise<{ target: CommuteTarget; status: CommuteResolutionStatus; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/resolve-commute-target`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      fallbackTargetId: fallbackTarget.id,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not match that location right now.");
  }

  const resolvedTarget = data.target;

  if (
    !resolvedTarget ||
    !Number.isFinite(Number(resolvedTarget.latitude)) ||
    !Number.isFinite(Number(resolvedTarget.longitude))
  ) {
    throw new Error("The location match came back incomplete.");
  }

  return {
    target: {
      id: resolvedTarget.id || `resolved-${Date.now()}`,
      label: resolvedTarget.label || query,
      area: resolvedTarget.area || fallbackTarget.area,
      latitude: Number(resolvedTarget.latitude),
      longitude: Number(resolvedTarget.longitude),
      keywords: [],
      source: resolvedTarget.source || data.source || "openai",
      confidence: resolvedTarget.confidence || data.confidence || "medium",
      note: resolvedTarget.note || data.message,
    },
    status: data.source === "openai" ? "resolved" : "fallback",
    message: data.message || "Matched your internship area.",
  };
}

const scoreCategories: Record<
  ScoreCategoryKey,
  { label: string; shortLabel: string; description: string; maxPoints: number }
> = {
  budget: {
    label: "Budget",
    shortLabel: "Cheaper rent",
    description: "Lower prices score higher.",
    maxPoints: 30,
  },
  commute: {
    label: "Commute",
    shortLabel: "Short commute",
    description: "Shorter commute times score higher.",
    maxPoints: 25,
  },
  lease: {
    label: "Lease fit",
    shortLabel: "Lease length",
    description: "Matches your lease target, or favors shorter flexible leases.",
    maxPoints: 20,
  },
  bedrooms: {
    label: "Bedrooms",
    shortLabel: "Bedrooms",
    description: "More bedrooms score higher.",
    maxPoints: 15,
  },
  squareFeet: {
    label: "Square feet",
    shortLabel: "More space",
    description: "Bigger layouts score higher.",
    maxPoints: 15,
  },
  baths: {
    label: "Baths",
    shortLabel: "More baths",
    description: "More bathrooms score higher.",
    maxPoints: 12,
  },
  amenities: {
    label: "Amenities",
    shortLabel: "Amenities",
    description: "Furnished, laundry, and parking add points.",
    maxPoints: 20,
  },
};

const priorityMultipliers = [1.45, 1.3, 1.15, 1, 0.9, 0.8, 0.7];

const profileTitles: Record<TasteProfileLabel, string> = {
  budget_commuter: "Lime scooter warrior",
  budget_first: "King Rent",
  convenience: "Got no Lime scooter?",
  lease_planner: "Lease locked in",
  comfort: "Mr. Snorlax",
  balanced: "Balanced bestie",
  space_hunter: "Viltrumite",
  bathroom_planner: "Royal Flush",
};

const profileScoreWeights: Record<TasteProfileLabel, Record<ScoreCategoryKey, number>> = {
  budget_commuter: {
    budget: 0.28,
    commute: 0.3,
    lease: 0.1,
    bedrooms: 0.08,
    squareFeet: 0.08,
    baths: 0.06,
    amenities: 0.1,
  },
  budget_first: {
    budget: 0.45,
    commute: 0.16,
    lease: 0.09,
    bedrooms: 0.07,
    squareFeet: 0.07,
    baths: 0.06,
    amenities: 0.1,
  },
  convenience: {
    budget: 0.14,
    commute: 0.42,
    lease: 0.08,
    bedrooms: 0.07,
    squareFeet: 0.08,
    baths: 0.07,
    amenities: 0.14,
  },
  lease_planner: {
    budget: 0.14,
    commute: 0.12,
    lease: 0.4,
    bedrooms: 0.09,
    squareFeet: 0.08,
    baths: 0.07,
    amenities: 0.1,
  },
  comfort: {
    budget: 0.1,
    commute: 0.12,
    lease: 0.08,
    bedrooms: 0.2,
    squareFeet: 0.18,
    baths: 0.14,
    amenities: 0.18,
  },
  balanced: {
    budget: 0.18,
    commute: 0.17,
    lease: 0.14,
    bedrooms: 0.13,
    squareFeet: 0.13,
    baths: 0.11,
    amenities: 0.14,
  },
  space_hunter: {
    budget: 0.09,
    commute: 0.1,
    lease: 0.08,
    bedrooms: 0.16,
    squareFeet: 0.4,
    baths: 0.09,
    amenities: 0.08,
  },
  bathroom_planner: {
    budget: 0.1,
    commute: 0.1,
    lease: 0.08,
    bedrooms: 0.14,
    squareFeet: 0.12,
    baths: 0.38,
    amenities: 0.08,
  },
};

const profilePickReasons: Record<TasteProfileLabel, string> = {
  budget_commuter: "it keeps rent and commute working together instead of only chasing one number",
  budget_first: "it gives you a strong cheaper-rent option to compare next",
  convenience: "it keeps the commute easier while still staying realistic",
  lease_planner: "it is a clean lease fit to compare before deciding",
  comfort: "it gives you more space and comfort signals to check next",
  balanced: "it gives you a steady option without leaning too hard in one direction",
  space_hunter: "it gives you more room to breathe without ignoring the rest of the tradeoffs",
  bathroom_planner: "it gives you a stronger bathroom setup to compare next",
};

function getListingNumber(
  listing: Listing,
  key: "price" | "commuteTime" | "leaseTerm" | "numBedroom" | "squareFootage" | "bathrooms"
) {
  return Number(listing[key]) || 0;
}

function getRange(
  listings: Listing[],
  key: "price" | "commuteTime" | "leaseTerm" | "numBedroom" | "squareFootage" | "bathrooms"
) {
  const values = listings.map((listing) => getListingNumber(listing, key));
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function scoreLowerIsBetter(value: number, min: number, max: number, maxPoints: number) {
  if (max === min) {
    return maxPoints;
  }
  return ((max - value) / (max - min)) * maxPoints;
}

function scoreHigherIsBetter(value: number, min: number, max: number, maxPoints: number) {
  if (max === min) {
    return maxPoints;
  }
  return ((value - min) / (max - min)) * maxPoints;
}

function getMedianValue(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  return sortedValues[Math.floor(sortedValues.length / 2)];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMiles(listing: Listing, target: CommuteTarget) {
  if (!Number.isFinite(listing.latitude) || !Number.isFinite(listing.longitude)) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(target.latitude - Number(listing.latitude));
  const dLng = toRadians(target.longitude - Number(listing.longitude));
  const lat1 = toRadians(Number(listing.latitude));
  const lat2 = toRadians(target.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

function estimateCommuteMinutesForTarget(listing: Listing, target: CommuteTarget) {
  const miles = getDistanceMiles(listing, target);

  if (miles === null) {
    return listing.commuteTime || 25;
  }

  return Math.max(5, Math.round(miles * 7 + 4));
}

function getTargetCity(target: CommuteTarget) {
  const targetText = `${target.label} ${target.area}`.toLowerCase();

  if (targetText.includes("bellevue")) {
    return "Bellevue";
  }

  if (targetText.includes("redmond")) {
    return "Redmond";
  }

  return "Seattle";
}

function findTargetFromInput(input: string) {
  const normalizedInput = input.trim().toLowerCase();

  if (normalizedInput === "") {
    return undefined;
  }

  return commuteTargets.find((target) =>
    target.keywords.some((keyword) => normalizedInput.includes(keyword))
  );
}

function isLikelyPartialAddress(input: string) {
  const normalizedInput = input.trim().toLowerCase();

  if (!/^\d/.test(normalizedInput)) {
    return false;
  }

  const hasStreetWord =
    /\b(st|street|ave|avenue|rd|road|blvd|boulevard|way|dr|drive|ln|lane|pl|place|ct|court)\b/.test(
      normalizedInput
    );
  const hasCityOrState =
    /\b(seattle|bellevue|redmond|kirkland|renton|wa|washington)\b/.test(normalizedInput);

  return normalizedInput.length < 12 || !hasStreetWord || !hasCityOrState;
}

function getPriorityStrength(
  category: ScoreCategoryKey,
  priorityOrder: ScoreCategoryKey[],
  rankingMode: RankingMode
) {
  if (rankingMode === "skipped") {
    return 0;
  }

  return (priorityOrder.length - priorityOrder.indexOf(category)) / priorityOrder.length;
}

function getAmenityStrength(listing: Listing) {
  return [listing.furnished, listing.laundry, listing.parking].filter(Boolean).length / 3;
}

function getListingSignals(listing: Listing, comparisonListings: Listing[]) {
  return {
    budget: scoreLowerIsBetter(
      listing.price,
      getRange(comparisonListings, "price").min,
      getRange(comparisonListings, "price").max,
      1
    ),
    commute: scoreLowerIsBetter(
      listing.commuteTime,
      getRange(comparisonListings, "commuteTime").min,
      getRange(comparisonListings, "commuteTime").max,
      1
    ),
    lease: scoreLowerIsBetter(
      listing.leaseTerm,
      getRange(comparisonListings, "leaseTerm").min,
      getRange(comparisonListings, "leaseTerm").max,
      1
    ),
    bedrooms: scoreHigherIsBetter(
      listing.numBedroom,
      getRange(comparisonListings, "numBedroom").min,
      getRange(comparisonListings, "numBedroom").max,
      1
    ),
    squareFeet: scoreHigherIsBetter(
      getListingNumber(listing, "squareFootage"),
      getRange(comparisonListings, "squareFootage").min,
      getRange(comparisonListings, "squareFootage").max,
      1
    ),
    baths: scoreHigherIsBetter(
      getListingNumber(listing, "bathrooms"),
      getRange(comparisonListings, "bathrooms").min,
      getRange(comparisonListings, "bathrooms").max,
      1
    ),
    amenities: getAmenityStrength(listing),
  };
}

function getSmartPick({
  modelProfile,
  sortedListings,
  viewedListingIds,
}: {
  modelProfile: TasteProfileLabel;
  sortedListings: ScoredListing[];
  viewedListingIds: number[];
}) {
  const candidateListings =
    sortedListings.filter((listing) => !viewedListingIds.includes(listing.id));
  const pickPool = candidateListings.length > 0 ? candidateListings : sortedListings;

  if (pickPool.length === 0) {
    return null;
  }

  const weights = profileScoreWeights[modelProfile];
  return pickPool
    .map((listing) => {
      const signals = getListingSignals(listing, sortedListings);
      const profileScore = (Object.entries(weights) as Array<[ScoreCategoryKey, number]>)
        .reduce((sum, [category, weight]) => sum + signals[category] * weight, 0);

      return { listing, profileScore };
    })
    .sort((a, b) => b.profileScore - a.profileScore)[0].listing;
}

function calculateScoreBreakdown(
  listing: Listing,
  preferences: UserPreferences,
  priorityOrder: ScoreCategoryKey[],
  comparisonListings: Listing[]
): ScoreBreakdownItem[] {
  const priceRange = getRange(comparisonListings, "price");
  const commuteRange = getRange(comparisonListings, "commuteTime");
  const leaseRange = getRange(comparisonListings, "leaseTerm");
  const bedroomRange = getRange(comparisonListings, "numBedroom");
  const squareFeetRange = getRange(comparisonListings, "squareFootage");
  const bathRange = getRange(comparisonListings, "bathrooms");

  return priorityOrder.map((category, index) => {
    const multiplier = priorityMultipliers[index] ?? 1;
    const categoryInfo = scoreCategories[category];
    let basePoints = 0;
    let explanation = "";

    if (category === "budget") {
      basePoints = scoreLowerIsBetter(
        listing.price,
        priceRange.min,
        priceRange.max,
        categoryInfo.maxPoints
      );
      explanation = `$${listing.price} rent compared with the current filtered listings`;
    }

    if (category === "commute") {
      basePoints = scoreLowerIsBetter(
        listing.commuteTime,
        commuteRange.min,
        commuteRange.max,
        categoryInfo.maxPoints
      );
      explanation = `${listing.commuteTime} minute commute compared with the current filtered listings`;
    }

    if (category === "lease") {
      if (preferences.leaseTerm !== "") {
        const leaseDifference = Math.abs(listing.leaseTerm - Number(preferences.leaseTerm));
        basePoints = Math.max(0, categoryInfo.maxPoints - leaseDifference * 4);
        explanation = `${listing.leaseTerm} month lease compared with your ${preferences.leaseTerm} month target`;
      } else {
        basePoints = scoreLowerIsBetter(
          listing.leaseTerm,
          leaseRange.min,
          leaseRange.max,
          categoryInfo.maxPoints
        );
        explanation = `${listing.leaseTerm} month lease; shorter leases score higher by default`;
      }
    }

    if (category === "bedrooms") {
      basePoints = scoreHigherIsBetter(
        listing.numBedroom,
        bedroomRange.min,
        bedroomRange.max,
        categoryInfo.maxPoints
      );
      explanation = `${listing.numBedroom} bedroom(s) compared with the current filtered listings`;
    }

    if (category === "squareFeet") {
      const squareFootage = getListingNumber(listing, "squareFootage");
      if (preferences.minSquareFeet !== "") {
        basePoints =
          squareFootage >= Number(preferences.minSquareFeet)
            ? categoryInfo.maxPoints
            : Math.max(
                0,
                (squareFootage / Number(preferences.minSquareFeet)) * categoryInfo.maxPoints
              );
        explanation = `${squareFootage} square feet compared with your ${preferences.minSquareFeet} square foot target`;
      } else {
        basePoints = scoreHigherIsBetter(
          squareFootage,
          squareFeetRange.min,
          squareFeetRange.max,
          categoryInfo.maxPoints
        );
        explanation = `${squareFootage} square feet compared with the current filtered listings`;
      }
    }

    if (category === "baths") {
      const bathrooms = getListingNumber(listing, "bathrooms");
      if (preferences.minBaths !== "") {
        basePoints =
          bathrooms >= Number(preferences.minBaths)
            ? categoryInfo.maxPoints
            : Math.max(0, (bathrooms / Number(preferences.minBaths)) * categoryInfo.maxPoints);
        explanation = `${bathrooms} bathroom(s) compared with your ${preferences.minBaths} bathroom target`;
      } else {
        basePoints = scoreHigherIsBetter(
          bathrooms,
          bathRange.min,
          bathRange.max,
          categoryInfo.maxPoints
        );
        explanation = `${bathrooms} bathroom(s) compared with the current filtered listings`;
      }
    }

    if (category === "amenities") {
      const amenityCount = [listing.furnished, listing.laundry, listing.parking].filter(Boolean).length;
      basePoints = (amenityCount / 3) * categoryInfo.maxPoints;
      explanation = `${amenityCount} of 3 tracked amenities: furnished, laundry, parking`;
    }

    return {
      label: categoryInfo.label,
      points: basePoints * multiplier,
      explanation: `${explanation}. Priority #${index + 1} applies a ${multiplier}x weight.`,
    };
  });
}

const chartMetrics: Record<ChartMetric, { label: string; suffix: string }> = {
  matchScore: { label: "Match score", suffix: " pts" },
  price: { label: "Price", suffix: "" },
  commuteTime: { label: "Commute time", suffix: " min" },
  leaseTerm: { label: "Lease term", suffix: " mo" },
  numBedroom: { label: "Bedrooms", suffix: "" },
  squareFootage: { label: "Square feet", suffix: " sq ft" },
  bathrooms: { label: "Baths", suffix: "" },
};

function inferTasteProfile({
  priorityOrder,
  rankingMode,
  chartMetric,
  sortedListings,
  interactions,
}: {
  priorityOrder: ScoreCategoryKey[];
  rankingMode: RankingMode;
  chartMetric: ChartMetric;
  sortedListings: ScoredListing[];
  interactions: InteractionSignals;
}): TasteProfile {
  const categoryScores: Record<ScoreCategoryKey, number> = {
    budget: 0,
    commute: 0,
    lease: 0,
    bedrooms: 0,
    squareFeet: 0,
    baths: 0,
    amenities: 0,
  };

  if (rankingMode !== "skipped") {
    priorityOrder.forEach((category, index) => {
      categoryScores[category] += priorityOrder.length - index;
    });
  }

  if (chartMetric === "price") categoryScores.budget += 0.75;
  if (chartMetric === "commuteTime") categoryScores.commute += 0.75;
  if (chartMetric === "leaseTerm") categoryScores.lease += 0.75;
  if (chartMetric === "numBedroom") categoryScores.bedrooms += 0.75;
  if (chartMetric === "squareFootage") categoryScores.squareFeet += 0.75;
  if (chartMetric === "bathrooms") categoryScores.baths += 0.75;

  const clickedListings = sortedListings.filter((listing) =>
    interactions.explanationClicks.includes(listing.id)
  );
  const medianPrice = getMedianValue(sortedListings.map((listing) => listing.price));
  const medianCommute = getMedianValue(sortedListings.map((listing) => listing.commuteTime));
  const medianSquareFeet = getMedianValue(
    sortedListings.map((listing) => getListingNumber(listing, "squareFootage"))
  );
  const medianBaths = getMedianValue(
    sortedListings.map((listing) => getListingNumber(listing, "bathrooms"))
  );
  const clickedCount = Math.max(clickedListings.length, 1);
  const clickedAmenityStrength =
    clickedListings.reduce((sum, listing) => sum + getAmenityStrength(listing), 0) / clickedCount;
  const clickedBudgetStrength =
    clickedListings.filter((listing) => medianPrice > 0 && listing.price <= medianPrice).length /
    clickedCount;
  const clickedCommuteStrength =
    clickedListings.filter((listing) => medianCommute > 0 && listing.commuteTime <= medianCommute)
      .length / clickedCount;
  const clickedLeaseStrength =
    clickedListings.filter((listing) => listing.leaseTerm <= 12).length / clickedCount;
  const clickedBedroomStrength =
    clickedListings.filter((listing) => listing.numBedroom >= 2).length / clickedCount;
  const clickedSquareFeetStrength =
    clickedListings.filter(
      (listing) =>
        medianSquareFeet > 0 && getListingNumber(listing, "squareFootage") >= medianSquareFeet
    ).length / clickedCount;
  const clickedBathStrength =
    clickedListings.filter(
      (listing) => medianBaths > 0 && getListingNumber(listing, "bathrooms") >= medianBaths
    ).length / clickedCount;

  clickedListings.forEach((listing) => {
    if (medianPrice > 0 && listing.price <= medianPrice) categoryScores.budget += 0.7;
    if (medianCommute > 0 && listing.commuteTime <= medianCommute) categoryScores.commute += 0.7;
    if (listing.leaseTerm <= 12) categoryScores.lease += 0.45;
    if (listing.numBedroom >= 2) categoryScores.bedrooms += 0.55;
    if (
      medianSquareFeet > 0 &&
      getListingNumber(listing, "squareFootage") >= medianSquareFeet
    ) {
      categoryScores.squareFeet += 0.6;
    }
    if (medianBaths > 0 && getListingNumber(listing, "bathrooms") >= medianBaths) {
      categoryScores.baths += 0.6;
    }
    if ([listing.furnished, listing.laundry, listing.parking].filter(Boolean).length >= 2) {
      categoryScores.amenities += 0.55;
    }
  });

  const modelProfile = predictTasteProfile({
    budgetPriority: getPriorityStrength("budget", priorityOrder, rankingMode),
    commutePriority: getPriorityStrength("commute", priorityOrder, rankingMode),
    leasePriority: getPriorityStrength("lease", priorityOrder, rankingMode),
    bedroomsPriority: getPriorityStrength("bedrooms", priorityOrder, rankingMode),
    squareFeetPriority: getPriorityStrength("squareFeet", priorityOrder, rankingMode),
    bathsPriority: getPriorityStrength("baths", priorityOrder, rankingMode),
    amenitiesPriority: getPriorityStrength("amenities", priorityOrder, rankingMode),
    strictBudget: clickedBudgetStrength,
    strictCommute: clickedCommuteStrength,
    leaseSet: clickedLeaseStrength,
    bedroomNeed: clickedBedroomStrength,
    squareFeetNeed: clickedSquareFeetStrength,
    bathNeed: clickedBathStrength,
    amenityNeed: clickedAmenityStrength,
    priceChart: chartMetric === "price" ? 1 : 0,
    commuteChart: chartMetric === "commuteTime" ? 1 : 0,
    leaseChart: chartMetric === "leaseTerm" ? 1 : 0,
    bedroomChart: chartMetric === "numBedroom" ? 1 : 0,
    squareFeetChart: chartMetric === "squareFootage" ? 1 : 0,
    bathChart: chartMetric === "bathrooms" ? 1 : 0,
    explanationActivity: Math.min(interactions.explanationClicks.length / 3, 1),
    pagingActivity: Math.min(interactions.listingPageChanges / 3, 1),
  });

  const rankedSignals = (Object.entries(categoryScores) as Array<[ScoreCategoryKey, number]>)
    .sort((a, b) => b[1] - a[1]);
  const [topCategory] = rankedSignals[0];
  const secondCategory = rankedSignals[1][0];
  const smartPick = getSmartPick({
    modelProfile,
    sortedListings,
    viewedListingIds: interactions.explanationClicks,
  });

  return {
    title: profileTitles[modelProfile],
    summary: `You seem to care most about ${scoreCategories[topCategory].label.toLowerCase()} while still comparing ${scoreCategories[secondCategory].label.toLowerCase()} closely.`,
    fitTip: `Your best fit will probably balance ${scoreCategories[topCategory].label.toLowerCase()} with ${scoreCategories[secondCategory].label.toLowerCase()}.`,
    smartSuggestion:
      smartPick !== null
        ? `Smart pick: ${smartPick.name}. It fits your current housing style because ${profilePickReasons[modelProfile]}.`
        : "Add or loosen filters to get more listings to compare.",
  };
}

function ListingMetricChart({
  listings,
  highlightedListingIds,
  metric,
  chartType,
  xAxisLabel = "Ranked listings",
}: {
  listings: ScoredListing[];
  highlightedListingIds: number[];
  metric: ChartMetric;
  chartType: ChartType;
  xAxisLabel?: string;
}) {
  const values = listings.map((listing) => Number(listing[metric]) || 0);
  const maxValue = Math.max(...values, 1);
  const chartWidth = 920;
  const chartHeight = 350;
  const paddingX = 62;
  const paddingTop = 58;
  const paddingBottom = 96;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const isDenseChart = listings.length > 12;
  const points = values.map((value, index) => {
    const x =
      listings.length === 1
        ? chartWidth / 2
        : paddingX + (index / (listings.length - 1)) * plotWidth;
    const y = paddingTop + plotHeight - (value / maxValue) * plotHeight;
    return { x, y, value };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div
      className={`chart-frame ${isDenseChart ? "is-dense" : ""}`}
      aria-label={`${chartMetrics[metric].label} chart`}
    >
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
        <line
          className="chart-axis"
          x1={paddingX}
          x2={chartWidth - paddingX}
          y1={chartHeight - paddingBottom}
          y2={chartHeight - paddingBottom}
        />
        <line
          className="chart-axis"
          x1={paddingX}
          x2={paddingX}
          y1={paddingTop}
          y2={chartHeight - paddingBottom}
        />
        <rect
          className="chart-axis-title-bg"
          x={chartWidth / 2 - 78}
          y={chartHeight - 30}
          width="156"
          height="24"
          rx="12"
        />
        <text className="chart-axis-label" x={chartWidth / 2} y={chartHeight - 14}>
          {xAxisLabel}
        </text>
        <g transform={`translate(18 ${chartHeight / 2}) rotate(-90)`}>
          <rect
            className="chart-axis-title-bg"
            x="-72"
            y="-12"
            width="144"
            height="24"
            rx="12"
          />
          <text className="chart-axis-label" x="0" y="5">
            {chartMetrics[metric].label}
          </text>
        </g>
        {chartType === "bar" ? (
          values.map((value, index) => {
            const barGap = Math.max(4, Math.min(18, plotWidth / listings.length / 2.4));
            const barWidth = (plotWidth - barGap * (listings.length - 1)) / listings.length;
            const barHeight = (value / maxValue) * plotHeight;
            const x = paddingX + index * (barWidth + barGap);
            const y = chartHeight - paddingBottom - barHeight;

            return (
              <g key={listings[index].id}>
                <rect
                  className={`chart-bar ${highlightedListingIds.includes(listings[index].id) ? "is-highlighted" : ""}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="8"
                />
                <text
                  className={`chart-value chart-bar-value ${
                    highlightedListingIds.includes(listings[index].id) ? "is-highlighted" : ""
                  }`}
                  x={x + barWidth / 2}
                  y={Math.min(chartHeight - paddingBottom - 8, y + 22)}
                >
                  {Math.round(value)}
                </text>
                <text className="chart-label" x={x + barWidth / 2} y={chartHeight - 50}>
                  #{index + 1}
                </text>
              </g>
            );
          })
        ) : (
          <>
            <path className="chart-line" d={linePath} />
            {points.map((point, index) => (
              <g key={listings[index].id}>
                <circle
                  className={`chart-dot ${highlightedListingIds.includes(listings[index].id) ? "is-highlighted" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={highlightedListingIds.includes(listings[index].id) ? "7" : "4"}
                />
                <text
                  className="chart-value"
                  x={point.x}
                  y={Math.max(20, point.y - 13 - (isDenseChart ? (index % 2) * 16 : 0))}
                >
                  {Math.round(point.value)}
                </text>
                <text className="chart-label" x={point.x} y={chartHeight - 50}>
                  #{index + 1}
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
      <div className="chart-legend">
        {listings.map((listing, index) => (
          <span
            className={highlightedListingIds.includes(listing.id) ? "is-highlighted" : ""}
            key={listing.id}
          >
            #{index + 1} {listing.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function escapeMapText(value: string | number | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createListingMapIcon({
  label,
  isHighlighted,
  isSelected,
}: {
  label: string;
  isHighlighted: boolean;
  isSelected: boolean;
}) {
  const className = [
    "map-marker",
    "map-marker-listing",
    isHighlighted ? "is-highlighted" : "",
    isSelected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return L.divIcon({
    className: "map-marker-shell",
    html: `<span class="${className}">${escapeMapText(label)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function createCommuteTargetIcon() {
  return L.divIcon({
    className: "map-marker-shell",
    html: `<span class="map-marker map-marker-target"><span class="map-marker-target-star">★</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  });
}

function ListingsMap({
  listings,
  mapListingIds,
  selectedListingId,
  commuteTarget,
  commuteTargetDisplayName,
  rankLabel,
  onListingSelect,
}: {
  listings: ScoredListing[];
  mapListingIds: number[];
  selectedListingId: number | null;
  commuteTarget: CommuteTarget;
  commuteTargetDisplayName: string;
  rankLabel: string;
  onListingSelect: (listingId: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([commuteTarget.latitude, commuteTarget.longitude], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [commuteTarget.latitude, commuteTarget.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;

    if (!map || !markerLayer) {
      return;
    }

    markerLayer.clearLayers();

    const targetLatLng = L.latLng(commuteTarget.latitude, commuteTarget.longitude);
    const bounds = L.latLngBounds([targetLatLng]);

    L.marker(targetLatLng, {
      icon: createCommuteTargetIcon(),
      keyboard: true,
      title: commuteTargetDisplayName,
    })
      .bindPopup(
        `<strong>${escapeMapText(commuteTargetDisplayName)}</strong><br />Internship location`
      )
      .addTo(markerLayer);

    listings.forEach((listing, index) => {
      if (
        !mapListingIds.includes(listing.id) ||
        !Number.isFinite(listing.latitude) ||
        !Number.isFinite(listing.longitude)
      ) {
        return;
      }

      const listingLatLng = L.latLng(Number(listing.latitude), Number(listing.longitude));
      const isSelected = selectedListingId === listing.id;
      const marker = L.marker(listingLatLng, {
        icon: createListingMapIcon({
          label: String(index + 1),
          isHighlighted: true,
          isSelected,
        }),
        keyboard: true,
        title: listing.name,
      });

      marker
        .bindPopup(
          `<strong>${escapeMapText(listing.name)}</strong><br />${escapeMapText(
            rankLabel
          )} #${index + 1}<br />${escapeMapText(listing.commuteTime)} min commute`
        )
        .on("click", () => onListingSelect(listing.id))
        .addTo(markerLayer);

      bounds.extend(listingLatLng);
    });

    window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        maxZoom: 13,
        padding: [28, 28],
      });
    }, 0);
  }, [
    commuteTarget,
    commuteTargetDisplayName,
    listings,
    mapListingIds,
    onListingSelect,
    rankLabel,
    selectedListingId,
  ]);

  return (
    <section className="map-panel">
      <div className="map-header">
        <div>
          <p className="eyebrow">Map</p>
          <h2>See what is nearby</h2>
        </div>
        <div className="map-legend" aria-label="Map marker legend">
          <span className="legend-target">Internship</span>
          <span className="legend-current">{mapListingIds.length} places</span>
        </div>
      </div>
      <p className="panel-copy">
        The map shows your internship plus the places from the current results
        page, so it stays easy to read.
      </p>
      <div
        className="listing-map"
        ref={mapContainerRef}
        role="img"
        aria-label="Map of filtered listings and internship location"
      />
    </section>
  );
}

function App() {
  const listingsPerPage = 4;
  const defaultPriorityOrder: ScoreCategoryKey[] = [
    "budget",
    "commute",
    "lease",
    "bedrooms",
    "squareFeet",
    "baths",
    "amenities",
  ];
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [selectedCommuteTargetId, setSelectedCommuteTargetId] = useState("uw");
  const [internshipNameInput, setInternshipNameInput] = useState("");
  const [internshipLocationInput, setInternshipLocationInput] = useState("");
  const [resolvedCommuteTarget, setResolvedCommuteTarget] = useState<CommuteTarget | null>(null);
  const [commuteResolutionStatus, setCommuteResolutionStatus] =
    useState<CommuteResolutionStatus>("idle");
  const [commuteResolutionMessage, setCommuteResolutionMessage] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxCommuteTime, setMaxCommuteTime] = useState("");
  const [leaseTerm, setLeaseTerm] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [minSquareFeet, setMinSquareFeet] = useState("");
  const [minBaths, setMinBaths] = useState("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [laundryOnly, setLaundryOnly] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [loadingIds, setLoadingIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedMapListingId, setSelectedMapListingId] = useState<number | null>(null);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("matchScore");
  const [rankingMode, setRankingMode] = useState<RankingMode>("default");
  const [showTasteProfile, setShowTasteProfile] = useState(false);
  const [dismissedTastePrompt, setDismissedTastePrompt] = useState(false);
  const [lastProfileTitle, setLastProfileTitle] = useState("");
  const [showProfileUpdatedPrompt, setShowProfileUpdatedPrompt] = useState(false);
  const [isResultsIntroLoading, setIsResultsIntroLoading] = useState(false);
  const resultsIntroTimeoutRef = useRef<number | null>(null);
  const priorityListRef = useRef<HTMLDivElement | null>(null);
  const draggedPriorityRef = useRef<ScoreCategoryKey | null>(null);
  const [interactions, setInteractions] = useState<InteractionSignals>({
    explanationClicks: [],
    resultPageViews: 0,
    chartMetricChanges: 0,
    listingPageChanges: 0,
  });
  const [priorityOrder, setPriorityOrder] = useState<ScoreCategoryKey[]>(defaultPriorityOrder);
  const [draggedPriority, setDraggedPriority] = useState<ScoreCategoryKey | null>(null);
  const [dragOverPriority, setDragOverPriority] = useState<ScoreCategoryKey | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const presetCommuteTarget =
    commuteTargets.find((target) => target.id === selectedCommuteTargetId) ||
    commuteTargets[0];
  const selectedCommuteTarget = resolvedCommuteTarget || presetCommuteTarget;
  const selectedCommuteTargetCity = getTargetCity(selectedCommuteTarget);
  const commuteLocationQuery = internshipLocationInput.trim();
  const internshipDisplayName =
    internshipNameInput.trim() === "" ? selectedCommuteTarget.label : internshipNameInput.trim();
  const commuteTargetName = internshipDisplayName;
  const hasTypedCommuteLocation = commuteLocationQuery !== "";
  const hasPartialCommuteAddress = isLikelyPartialAddress(internshipLocationInput);
  const locationActionLabel = hasPartialCommuteAddress
    ? "Add more detail"
    : hasTypedCommuteLocation
      ? "Check & Continue"
      : "Save & Continue";
  const userPreferences: UserPreferences = {
    commuteTarget: commuteTargetName,
    commuteArea: selectedCommuteTarget.label,
    commuteLatitude: selectedCommuteTarget.latitude,
    commuteLongitude: selectedCommuteTarget.longitude,
    maxPrice,
    maxCommuteTime,
    leaseTerm,
    minBedrooms,
    minSquareFeet,
    minBaths,
    furnishedOnly,
    laundryOnly,
    parkingOnly,
  };
  useEffect(() => {
    let isCurrentRequest = true;

    const fetchListings = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          latitude: String(selectedCommuteTarget.latitude),
          longitude: String(selectedCommuteTarget.longitude),
          targetLabel: selectedCommuteTarget.label,
          targetCity: selectedCommuteTargetCity,
          maxListings: "24",
        });
        const response = await fetch(`${API_BASE_URL}/api/listings?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch listings");
        }
        const data: Listing[] = await response.json();
        if (isCurrentRequest) {
          setListings(data);
          setError("");
        }
      } catch (err) {
        console.error(err);
        if (isCurrentRequest) {
          setError("Could not load listings");
        }
      } finally {
        if (isCurrentRequest) {
          setLoading(false);
        }
      }
    };
    fetchListings();

    return () => {
      isCurrentRequest = false;
    };
  }, [
    selectedCommuteTarget.latitude,
    selectedCommuteTarget.longitude,
    selectedCommuteTarget.label,
    selectedCommuteTargetCity,
  ]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePage]);

  useEffect(() => {
    return () => {
      if (resultsIntroTimeoutRef.current !== null) {
        window.clearTimeout(resultsIntroTimeoutRef.current);
      }
    };
  }, []);

  const listingsWithCommute = listings.map((listing) => ({
    ...listing,
    commuteTime: estimateCommuteMinutesForTarget(listing, selectedCommuteTarget),
    commuteNote: `Distance-based estimate to ${commuteTargetName}`,
    commuteTargetLabel: commuteTargetName,
  }));

  const hasCommuteLimit = maxCommuteTime !== "";
  const listingMatchesFilters = (
    listing: Listing,
    options: { includeCommute: boolean } = { includeCommute: true }
  ) => {
    const matchesPrice =
      maxPrice === "" || listing.price <= Number(maxPrice);

    const matchesCommuteTime =
      !options.includeCommute || maxCommuteTime === "" || listing.commuteTime <= Number(maxCommuteTime);

    const matchesLeaseTerm =
      leaseTerm === "" || listing.leaseTerm === Number(leaseTerm);

    const matchesBedrooms =
      minBedrooms === "" || listing.numBedroom >= Number(minBedrooms);

    const matchesSquareFeet =
      minSquareFeet === "" || getListingNumber(listing, "squareFootage") >= Number(minSquareFeet);

    const matchesBaths =
      minBaths === "" || getListingNumber(listing, "bathrooms") >= Number(minBaths);

    const matchesFurnished =
      !furnishedOnly || listing.furnished;

    const matchesLaundry =
      !laundryOnly || listing.laundry;

    const matchesParking =
      !parkingOnly || listing.parking;

    return (
      matchesPrice &&
      matchesCommuteTime &&
      matchesLeaseTerm &&
      matchesBedrooms &&
      matchesSquareFeet &&
      matchesBaths &&
      matchesFurnished &&
      matchesLaundry &&
      matchesParking
    );
  };
  const exactFilteredListings = listingsWithCommute.filter((listing) =>
    listingMatchesFilters(listing)
  );
  const commuteRelaxedListings = hasCommuteLimit
    ? listingsWithCommute.filter((listing) =>
        listingMatchesFilters(listing, { includeCommute: false })
      )
    : [];
  const isShowingCommuteFallback =
    exactFilteredListings.length === 0 && commuteRelaxedListings.length > 0;
  const noListingsLoadedForArea = !loading && listingsWithCommute.length === 0;
  const emptyResultsCopy = noListingsLoadedForArea
    ? `I couldn't load nearby live listings for ${selectedCommuteTarget.label} right now. Try another nearby area or check again in a bit.`
    : "Nothing matches those filters yet. Go back and loosen one thing to see more options.";
  const filteredListings = isShowingCommuteFallback
    ? [...commuteRelaxedListings]
        .sort((a, b) => a.commuteTime - b.commuteTime)
        .slice(0, Math.max(listingsPerPage * 2, 8))
    : exactFilteredListings;
  const commuteFallbackMessage = isShowingCommuteFallback
    ? `No places were inside ${maxCommuteTime} minutes of ${commuteTargetName}, so these are the closest places that match your other must-haves.`
    : "";
  const scoredListings: ScoredListing[] = filteredListings.map((listing) => {
    const scoreBreakdown = calculateScoreBreakdown(
      listing,
      userPreferences,
      priorityOrder,
      filteredListings
    );
    const rawScore = scoreBreakdown.reduce((sum, item) => sum + item.points, 0);
    const maxPossibleScore = priorityOrder.reduce((sum, category, index) => {
      return sum + scoreCategories[category].maxPoints * (priorityMultipliers[index] ?? 1);
    }, 0);
    const matchScore = maxPossibleScore > 0 ? (rawScore / maxPossibleScore) * 100 : 0;

    return { ...listing, matchScore, scoreBreakdown };
  });
  // sorting implemented here
  const sortedListings = [...scoredListings].sort((a, b) => {
    if (rankingMode === "skipped") {
      const randomA = (a.id * 9301 + 49297) % 233280;
      const randomB = (b.id * 9301 + 49297) % 233280;
      return randomA - randomB;
    }

    return b.matchScore - a.matchScore;
  });
  const effectiveChartMetric: ChartMetric =
    rankingMode === "skipped" && chartMetric === "matchScore" ? "price" : chartMetric;
  const totalPages = Math.max(1, Math.ceil(sortedListings.length / listingsPerPage));
  const currentPageStart = currentPage * listingsPerPage;
  const visiblePageListings = sortedListings.slice(
    currentPageStart,
    currentPageStart + listingsPerPage
  );
  const visibleListingIds = visiblePageListings.map((listing) => listing.id);
  const mapListingIds = visibleListingIds;
  const mapListingKey = mapListingIds.join("|");
  const visibleStartRank = sortedListings.length === 0 ? 0 : currentPageStart + 1;
  const visibleEndRank = Math.min(currentPageStart + listingsPerPage, sortedListings.length);
  const decisionContextKey = JSON.stringify({
    priorityOrder,
    rankingMode,
    userPreferences,
  });
  const stepPages: Array<{ key: StepPageKey; label: string }> = [
    { key: "location", label: "Commute" },
    { key: "preferences", label: "Must-haves" },
    { key: "ranking", label: "Ranking" },
    { key: "results", label: "Results" },
  ];
  const currentStepIndex = stepPages.findIndex((page) => page.key === activePage);
  const previousPage: PageKey =
    currentStepIndex <= 0 ? "home" : stepPages[currentStepIndex - 1].key;
  const tasteProfile = inferTasteProfile({
    priorityOrder,
    rankingMode,
    chartMetric: effectiveChartMetric,
    sortedListings,
    interactions,
  });
  const currentListingIdSet = new Set(sortedListings.map((listing) => listing.id));
  const openExplanationIds = Object.keys(explanations)
    .map((listingId) => Number(listingId))
    .filter((listingId) => currentListingIdSet.has(listingId));
  const viewedListingIds = new Set([
    ...interactions.explanationClicks.filter((listingId) => currentListingIdSet.has(listingId)),
    ...openExplanationIds,
  ]);
  const isTasteProfileReady = activePage === "results" && viewedListingIds.size >= 3;

  const resetHousingStyleProgress = () => {
    setExplanations({});
    setLoadingIds([]);
    setShowTasteProfile(false);
    setDismissedTastePrompt(false);
    setShowProfileUpdatedPrompt(false);
    setLastProfileTitle("");
    setInteractions((current) => ({
      ...current,
      explanationClicks: [],
      chartMetricChanges: 0,
      listingPageChanges: 0,
    }));
  };

  const resetCommuteResolution = () => {
    setResolvedCommuteTarget(null);
    setCommuteResolutionStatus("idle");
    setCommuteResolutionMessage("");
  };

  const selectListingFromMap = (listingId: number) => {
    const listingIndex = sortedListings.findIndex((listing) => listing.id === listingId);

    if (listingIndex < 0) {
      return;
    }

    setSelectedMapListingId(listingId);
    setCurrentPage(Math.floor(listingIndex / listingsPerPage));
    setInteractions((current) => ({
      ...current,
      listingPageChanges: current.listingPageChanges + 1,
    }));
    window.setTimeout(() => {
      document.querySelector(".results-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const openResultsWithIntro = ({
    skipRanking = false,
  }: {
    skipRanking?: boolean;
  } = {}) => {
    resetHousingStyleProgress();
    setCurrentPage(0);
    setSelectedMapListingId(null);

    if (skipRanking) {
      setRankingMode("skipped");
      setChartMetric("price");
    } else {
      setRankingMode((current) => (current === "skipped" ? "default" : current));
    }

    if (resultsIntroTimeoutRef.current !== null) {
      window.clearTimeout(resultsIntroTimeoutRef.current);
    }

    setIsResultsIntroLoading(true);
    resultsIntroTimeoutRef.current = window.setTimeout(() => {
      setActivePage("results");
      setIsResultsIntroLoading(false);
      resultsIntroTimeoutRef.current = null;
    }, 1550);
  };

  const saveLocationAndContinue = async () => {
    const typedLocation = internshipLocationInput.trim();

    if (typedLocation === "") {
      resetCommuteResolution();
      setCurrentPage(0);
      setActivePage("preferences");
      return;
    }

    if (isLikelyPartialAddress(typedLocation)) {
      setCommuteResolutionStatus("fallback");
      setCommuteResolutionMessage(
        "This looks like a partial address. Add the full street and city, or clear it and choose a quick area."
      );
      return;
    }

    setCommuteResolutionStatus("resolving");
    setCommuteResolutionMessage("Matching your internship area...");

    try {
      const matchedLocation = await resolveCommuteTarget(typedLocation, presetCommuteTarget);
      setResolvedCommuteTarget(matchedLocation.target);
      setCommuteResolutionStatus(matchedLocation.status);
      setCommuteResolutionMessage(matchedLocation.message);
      setCurrentPage(0);
      setActivePage("preferences");
    } catch (error) {
      const fallbackTarget = findTargetFromInput(typedLocation) || presetCommuteTarget;
      setResolvedCommuteTarget(null);
      setSelectedCommuteTargetId(fallbackTarget.id);
      setCommuteResolutionStatus("fallback");
      setCommuteResolutionMessage(
        error instanceof Error
          ? `I could not match that exactly, so I used ${fallbackTarget.label}.`
          : `I used ${fallbackTarget.label} for now.`
      );
      setCurrentPage(0);
      setActivePage("preferences");
    }
  };

  const movePriorityToIndex = (insertIndex: number) => {
    const activeDraggedPriority = draggedPriorityRef.current;

    if (!activeDraggedPriority) {
      return;
    }

    setRankingMode("custom");

    setPriorityOrder((currentOrder) => {
      const withoutDragged = currentOrder.filter((category) => category !== activeDraggedPriority);
      const safeInsertIndex = Math.max(0, Math.min(insertIndex, withoutDragged.length));
      const nextOrder = [
        ...withoutDragged.slice(0, safeInsertIndex),
        activeDraggedPriority,
        ...withoutDragged.slice(safeInsertIndex),
      ];

      if (nextOrder.every((category, index) => category === currentOrder[index])) {
        return currentOrder;
      }

      return nextOrder;
    });
  };

  const updatePriorityDragPosition = (clientY: number) => {
    const activeDraggedPriority = draggedPriorityRef.current;
    const priorityList = priorityListRef.current;

    if (!activeDraggedPriority || !priorityList) {
      return;
    }

    const priorityCards = Array.from(
      priorityList.querySelectorAll<HTMLElement>("[data-priority-card]")
    ).filter((card) => card.dataset.priorityCategory !== activeDraggedPriority);

    const hoveredIndex = priorityCards.findIndex((card) => {
      const cardBox = card.getBoundingClientRect();
      return clientY < cardBox.top + cardBox.height / 2;
    });
    const insertIndex = hoveredIndex === -1 ? priorityCards.length : hoveredIndex;
    const highlightedCard = priorityCards[Math.min(insertIndex, priorityCards.length - 1)];
    const highlightedCategory = highlightedCard?.dataset.priorityCategory as
      | ScoreCategoryKey
      | undefined;

    setDragOverPriority(highlightedCategory ?? null);
    movePriorityToIndex(insertIndex);
  };

  useEffect(() => {
    setCurrentPage(0);
    setSelectedMapListingId(null);
  }, [
    selectedCommuteTarget.id,
    commuteTargetName,
    maxPrice,
    maxCommuteTime,
    leaseTerm,
    minBedrooms,
    minSquareFeet,
    minBaths,
    furnishedOnly,
    laundryOnly,
    parkingOnly,
  ]);

  useEffect(() => {
    resetHousingStyleProgress();
  }, [decisionContextKey]);

  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const nextMapIds =
      mapListingKey === "" ? [] : mapListingKey.split("|").map((listingId) => Number(listingId));

    setSelectedMapListingId((currentListingId) =>
      currentListingId !== null && nextMapIds.includes(currentListingId)
        ? currentListingId
        : null
    );
  }, [mapListingKey]);

  useEffect(() => {
    if (activePage === "results") {
      setInteractions((current) => ({
        ...current,
        resultPageViews: current.resultPageViews + 1,
      }));
    }
  }, [activePage]);

  useEffect(() => {
    if (!isTasteProfileReady) {
      setLastProfileTitle("");
      setShowProfileUpdatedPrompt(false);
      return;
    }

    if (lastProfileTitle === "") {
      setLastProfileTitle(tasteProfile.title);
      return;
    }

    if (lastProfileTitle !== tasteProfile.title) {
      setLastProfileTitle(tasteProfile.title);
      setShowProfileUpdatedPrompt(true);
      setDismissedTastePrompt(true);
    }
  }, [isTasteProfileReady, lastProfileTitle, tasteProfile.title]);

  // ai feature
  const explainMatch = async (listing: ExplainableListing) => {
    if (explanations[listing.id]) {
      setExplanations((prev) => {
      const updated = { ...prev };
      delete updated[listing.id];
      return updated;
    });
    return;
  }
    if (loadingIds.includes(listing.id)) {
      return;
    }

    setInteractions((current) => ({
      ...current,
      explanationClicks: current.explanationClicks.includes(listing.id)
        ? current.explanationClicks
        : [...current.explanationClicks, listing.id],
    }));
    setLoadingIds((current) =>
      current.includes(listing.id) ? current : [...current, listing.id]
    );

    try {
      const explanation = await getMatchExplanation(
        userPreferences,
        listing,
        sortedListings
      );
      setExplanations((prev) => ({
        ...prev,
        [listing.id]: explanation,
      }));
    } finally {
      setLoadingIds((current) => current.filter((listingId) => listingId !== listing.id));
    }
  }
  if (loading && listings.length === 0) return <p>Loading listings...</p>;
  if (error) return <p>{error}</p>;
  return (
    <main className={`app-shell ${activePage === "home" ? "is-home" : "is-flow"}`}>
      <header className="app-header">
        <p className="eyebrow">AI-assisted</p>
        <h1>
          Intern <span className="title-keep">Housing Finder</span>
        </h1>
        <p className="hero-copy">
          Find real Seattle rentals that fit your commute, budget, and living
          style without opening a million tabs.
        </p>
        <div className="hero-points" aria-label="Project strengths">
          <span>Real rentals</span>
          <span>Commute estimates</span>
          <span>AI tradeoff help</span>
        </div>
        {activePage !== "home" && (
          <nav className="step-nav" aria-label="Current step">
            {stepPages.map((page, index) => (
              <div className="step-nav-item" key={page.key}>
                <span className={activePage === page.key ? "is-active" : ""}>
                  Step {index + 1}: {page.label}
                </span>
                {page.key === "results" && isTasteProfileReady && (
                  <button
                    className="taste-profile-nav-button"
                    onClick={() => {
                      setShowTasteProfile(true);
                      setDismissedTastePrompt(true);
                    }}
                    type="button"
                  >
                    VIEW TASTE PROFILE
                  </button>
                )}
              </div>
            ))}
          </nav>
        )}
      </header>

      <section className={`page-section home-page ${activePage === "home" ? "" : "is-hidden"}`}>
        <div className="start-panel">
          <button onClick={() => setActivePage("location")} type="button">
            Start finding housing
          </button>
        </div>
        <div className="home-grid">
          <article className="home-card">
            <p className="eyebrow">Step 1</p>
            <h3>Add your commute</h3>
            <p>
              Tell us where your internship is so the commute numbers make
              sense.
            </p>
          </article>
          <article className="home-card">
            <p className="eyebrow">Step 2</p>
            <h3>Set dealbreakers</h3>
            <p>
              Add the budget, space, lease, and amenities you actually care
              about.
            </p>
          </article>
          <article className="home-card">
            <p className="eyebrow">Step 3</p>
            <h3>Pick priorities</h3>
            <p>
              Drag what matters most to the top so the app knows your vibe.
            </p>
          </article>
          <article className="home-card">
            <p className="eyebrow">Step 4</p>
            <h3>See your matches</h3>
            <p>
              Compare listings, map pins, charts, and AI tradeoffs in one
              place.
            </p>
          </article>
        </div>
      </section>

      <section className={`page-section decision-panel location-page ${activePage === "location" ? "" : "is-hidden"}`}>
        <div className="panel-heading">
          <p className="eyebrow">Step 1: Commute</p>
          <h2>Where is your internship?</h2>
        </div>
        <p className="panel-copy">
          Name your internship for the map. Then choose how we estimate your
          commute: type a full address or pick a nearby area.
        </p>

        <div className="location-input-label">
          <label htmlFor="internship-name-input">Internship or company name</label>
          <input
            id="internship-name-input"
            type="text"
            placeholder="Example: Amazon internship, UW lab, Microsoft"
            value={internshipNameInput}
            onChange={(event) => setInternshipNameInput(event.target.value)}
          />
          <span className="location-helper">
            This name shows on your map marker.
          </span>
        </div>

        <div className={`location-input-label ${hasPartialCommuteAddress ? "has-warning" : ""}`}>
          <label htmlFor="commute-location-input">Full address or exact area</label>
          <input
            id="commute-location-input"
            className={hasPartialCommuteAddress ? "is-warning" : ""}
            type="text"
            placeholder="Example: 410 Terry Ave N Seattle"
            value={internshipLocationInput}
            onChange={(event) => {
              const nextLocation = event.target.value;
              setInternshipLocationInput(nextLocation);
              setResolvedCommuteTarget(null);
              setCommuteResolutionStatus("idle");
              setCommuteResolutionMessage("");
            }}
          />
          <span className={`location-helper ${hasPartialCommuteAddress ? "is-warning" : ""}`}>
            {hasPartialCommuteAddress
              ? "That looks like a partial address. Add the full street and city, like 2412 S Jackson St Seattle."
              : "Use this for a better commute estimate. Leave it blank if a quick pick is close enough."}
          </span>
        </div>

        <div className="location-section-heading">
          <p className="eyebrow">Nearby areas</p>
          <p>Pick one if you do not know the exact address yet.</p>
        </div>
        <div className="location-grid" aria-label="Common commute areas">
          {commuteTargets.map((target) => (
            <button
              className={`location-card ${
                !hasTypedCommuteLocation && selectedCommuteTargetId === target.id ? "is-selected" : ""
              } ${hasTypedCommuteLocation ? "is-inactive" : ""}`}
              key={target.id}
              onClick={() => {
                setInternshipLocationInput("");
                setSelectedCommuteTargetId(target.id);
                setResolvedCommuteTarget(null);
                setCommuteResolutionStatus("idle");
                setCommuteResolutionMessage("");
              }}
              type="button"
            >
              <span>{target.label}</span>
              <small>{target.area}</small>
            </button>
          ))}
        </div>

        <div className="location-estimate-note">
          <p className="eyebrow">Commute target</p>
          {hasPartialCommuteAddress ? (
            <p>
              Add the full street and city so the commute estimate does not
              guess wrong.
            </p>
          ) : (
            <p>
              {commuteResolutionStatus === "resolving"
                ? "Checking "
                : hasTypedCommuteLocation && commuteResolutionStatus === "idle"
                  ? "Ready to check "
                  : "Using "}
              <strong>{commuteTargetName}</strong>
              {hasTypedCommuteLocation ? (
                <>
                  {" "}at <strong>{commuteLocationQuery}</strong>
                </>
              ) : commuteTargetName !== selectedCommuteTarget.label ? (
                <>
                  {" "}near <strong>{selectedCommuteTarget.label}</strong>
                </>
              ) : null}
              .
            </p>
          )}
          {hasTypedCommuteLocation && !hasPartialCommuteAddress && commuteResolutionStatus === "idle" && (
            <p className="location-resolution-message">
              We will use this address when you continue.
            </p>
          )}
          {commuteResolutionMessage !== "" && (
            <p
              className={`location-resolution-message ${
                hasPartialCommuteAddress ? "is-warning" : ""
              }`}
            >
              {commuteResolutionMessage}
            </p>
          )}
        </div>

        <div className="location-product-note">
          <span>Why it matters</span>
          <p>
            Commute can make or break a place, so we check it before showing
            your matches.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setInternshipLocationInput("");
              setSelectedCommuteTargetId("uw");
              resetCommuteResolution();
              setCurrentPage(0);
              setActivePage("preferences");
            }}
            type="button"
          >
            Skip, use UW
          </button>
          <button
            disabled={commuteResolutionStatus === "resolving" || hasPartialCommuteAddress}
            onClick={saveLocationAndContinue}
            type="button"
          >
            {commuteResolutionStatus === "resolving" ? "Matching..." : locationActionLabel}{" "}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      <section className={`page-section decision-panel ${activePage === "preferences" ? "" : "is-hidden"}`}>
        <div className="panel-heading">
          <p className="eyebrow">Step 2: Preferences</p>
          <h2>Choose your must-haves</h2>
        </div>
        <p className="panel-copy">
          Only fill out what matters to you. Blank boxes keep more options
          open.
        </p>

        <div className="filter-grid">
          <label>
            Max price
            <input
              type="number"
              placeholder="1500"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
          <label>
            Max commute time
            <input
              type="number"
              placeholder="20 minutes"
              value={maxCommuteTime}
              onChange={(e) => setMaxCommuteTime(e.target.value)}
            />
          </label>
          <label>
            Lease term
            <input
              type="number"
              placeholder="12 months"
              value={leaseTerm}
              onChange={(e) => setLeaseTerm(e.target.value)}
            />
          </label>
          <label>
            Minimum bedrooms
            <input
              type="number"
              placeholder="1"
              value={minBedrooms}
              onChange={(e) => setMinBedrooms(e.target.value)}
            />
          </label>
          <label>
            Minimum square feet
            <input
              type="number"
              placeholder="500"
              value={minSquareFeet}
              onChange={(e) => setMinSquareFeet(e.target.value)}
            />
          </label>
          <label>
            Minimum baths
            <input
              type="number"
              placeholder="1"
              value={minBaths}
              onChange={(e) => setMinBaths(e.target.value)}
            />
          </label>
        </div>

        <div className="checkbox-row" aria-label="Required amenities">
          <label>
            <input
              type="checkbox"
              checked={furnishedOnly}
              onChange={(e) => setFurnishedOnly(e.target.checked)}
            />
            Furnished only
          </label>
          <label>
            <input
              type="checkbox"
              checked={laundryOnly}
              onChange={(e) => setLaundryOnly(e.target.checked)}
            />
            Laundry only
          </label>
          <label>
            <input
              type="checkbox"
              checked={parkingOnly}
              onChange={(e) => setParkingOnly(e.target.checked)}
            />
            Parking only
          </label>
        </div>
        <div className="page-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setMaxPrice("");
              setMaxCommuteTime("");
              setLeaseTerm("");
              setMinBedrooms("");
              setMinSquareFeet("");
              setMinBaths("");
              setFurnishedOnly(false);
              setLaundryOnly(false);
              setParkingOnly(false);
              setCurrentPage(0);
              setActivePage("ranking");
            }}
            type="button"
          >
            Skip for now
          </button>
          <button
            onClick={() => {
              setActivePage("ranking");
            }}
            type="button"
          >
            Save & Continue <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      <section className={`page-section rules-panel ${activePage === "ranking" ? "" : "is-hidden"}`}>
          <div className="panel-heading">
            <p className="eyebrow">Step 3: Priorities</p>
            <h2>Rank what matters most</h2>
          </div>
          <p className="panel-copy">
            Drag your top priorities upward. This changes the match scores. You
            can also skip and just browse.
          </p>
          <div
            aria-label="Drag to reorder ranking priorities"
            className="priority-list"
            onDragOver={(event) => {
              event.preventDefault();
              updatePriorityDragPosition(event.clientY);
            }}
            onDrop={(event) => {
              event.preventDefault();
              draggedPriorityRef.current = null;
              setDraggedPriority(null);
              setDragOverPriority(null);
            }}
            ref={priorityListRef}
          >
            {priorityOrder.map((category, index) => {
              const categoryInfo = scoreCategories[category];

              return (
                <article
                  className={`priority-card ${draggedPriority === category ? "is-dragging" : ""} ${
                    dragOverPriority === category ? "is-drag-over" : ""
                  }`}
                  data-priority-card="true"
                  data-priority-category={category}
                  draggable
                  key={category}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    const blankDragImage = document.createElement("div");
                    blankDragImage.className = "priority-blank-drag-image";
                    document.body.appendChild(blankDragImage);
                    event.dataTransfer.setDragImage(blankDragImage, 0, 0);
                    window.setTimeout(() => blankDragImage.remove(), 0);
                    draggedPriorityRef.current = category;
                    setDraggedPriority(category);
                  }}
                  onDragEnd={() => {
                    draggedPriorityRef.current = null;
                    setDraggedPriority(null);
                    setDragOverPriority(null);
                  }}
                >
                  <span className="priority-rank">#{index + 1}</span>
                  <div>
                    <h3>{categoryInfo.label}</h3>
                    <p>{categoryInfo.description}</p>
                  </div>
                  <span className="priority-weight">
                    {priorityMultipliers[index]}x
                  </span>
                </article>
              );
            })}
          </div>
          <div className="ai-note">
            <p className="eyebrow">Your ranking</p>
            <p>
              Top priority: <strong>{scoreCategories[priorityOrder[0]].label}</strong>.
              Lowest priority:{" "}
              <strong>{scoreCategories[priorityOrder[priorityOrder.length - 1]].label}</strong>.
              Ready when you are.
            </p>
          </div>
          <div className="page-actions">
            <button
              className="secondary-button"
              onClick={() => {
                openResultsWithIntro({ skipRanking: true });
              }}
              type="button"
            >
              Skip for now
            </button>
            <button
              onClick={() => {
                openResultsWithIntro();
              }}
              type="button"
            >
              Save & See Results <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
      </section>

      <section className={`page-section results-page ${activePage === "results" ? "" : "is-hidden"}`}>
      <div className="results-layout">
      {activePage === "results" && sortedListings.length > 0 && (
        <ListingsMap
          listings={sortedListings}
          mapListingIds={mapListingIds}
          selectedListingId={selectedMapListingId}
          commuteTarget={selectedCommuteTarget}
          commuteTargetDisplayName={internshipDisplayName}
          rankLabel={rankingMode === "skipped" ? "Listing" : "Rank"}
          onListingSelect={selectListingFromMap}
        />
      )}
      <section className="chart-panel">
        <div className="chart-header">
          <div>
            <p className="eyebrow">Compare</p>
            <h2>Compare your options</h2>
          </div>
          <div className="chart-controls">
            <label>
              Chart type
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
              >
                <option value="bar">Bar graph</option>
                <option value="line">Line graph</option>
              </select>
            </label>
            <label>
              Metric
              <select
                value={effectiveChartMetric}
                onChange={(e) => {
                  const nextMetric = e.target.value as ChartMetric;
                  setChartMetric(
                    rankingMode === "skipped" && nextMetric === "matchScore" ? "price" : nextMetric
                  );
                  setInteractions((current) => ({
                    ...current,
                    chartMetricChanges: current.chartMetricChanges + 1,
                  }));
                }}
              >
                {rankingMode !== "skipped" && <option value="matchScore">Match score</option>}
                <option value="price">Price</option>
                <option value="commuteTime">Commute time</option>
                <option value="leaseTerm">Lease term</option>
                <option value="numBedroom">Bedrooms</option>
                <option value="squareFootage">Square feet</option>
                <option value="bathrooms">Baths</option>
              </select>
            </label>
          </div>
        </div>
        <p className="panel-copy">
          This chart includes every listing that matches. Pink ones are the 4
          cards shown below.
          {rankingMode === "skipped" && " Since ranking was skipped, the list is shuffled for browsing."}
        </p>
        {commuteFallbackMessage && (
          <p className="results-notice">{commuteFallbackMessage}</p>
        )}
        {sortedListings.length > 0 ? (
          <ListingMetricChart
            listings={sortedListings}
            highlightedListingIds={visibleListingIds}
            metric={effectiveChartMetric}
            chartType={chartType}
            xAxisLabel={rankingMode === "skipped" ? "Browsing order" : "Ranked listings"}
          />
        ) : (
          <div className="empty-state">
            <p className="eyebrow">
              {noListingsLoadedForArea ? "No nearby listings loaded" : "No matches yet"}
            </p>
            <p>{emptyResultsCopy}</p>
          </div>
        )}
      </section>

      <section className="results-section">
        <div className="results-header">
          <div>
            <p className="eyebrow">Step 4: Results</p>
            <h2>
              {filteredListings.length}{" "}
              {isShowingCommuteFallback ? "closest places found" : "places found"}
            </h2>
          </div>
        </div>

        {sortedListings.length > 0 ? (
          <>
            <div className="listing-pager" aria-label="Listing navigation">
              <button
                className="arrow-button"
                type="button"
                onClick={() => {
                  setCurrentPage((page) => Math.max(0, page - 1));
                  setInteractions((current) => ({
                    ...current,
                    listingPageChanges: current.listingPageChanges + 1,
                  }));
                }}
                disabled={currentPage === 0}
                aria-label="Previous listings"
              >
                <span aria-hidden="true">&larr;</span>
              </button>
              <p>
                Showing {rankingMode === "skipped" ? "places" : "matches"}{" "}
                <strong>{visibleStartRank}-{visibleEndRank}</strong> of{" "}
                <strong>{sortedListings.length}</strong>
              </p>
              <button
                className="arrow-button"
                type="button"
                onClick={() => {
                  setCurrentPage((page) => Math.min(totalPages - 1, page + 1));
                  setInteractions((current) => ({
                    ...current,
                    listingPageChanges: current.listingPageChanges + 1,
                  }));
                }}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next listings"
              >
                <span aria-hidden="true">&rarr;</span>
              </button>
            </div>

            <div className="listing-list">
              {visiblePageListings.map((listing, index) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  rank={currentPageStart + index + 1}
                  onExplainMatch={explainMatch}
                  explanation={explanations[listing.id] || ""}
                  isLoading={loadingIds.includes(listing.id)}
                  hideScore={rankingMode === "skipped"}
                  rankLabel={rankingMode === "skipped" ? "Listing" : "Rank"}
                  isMapSelected={selectedMapListingId === listing.id}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p className="eyebrow">
              {noListingsLoadedForArea ? "No nearby listings loaded" : "Nothing to compare yet"}
            </p>
            <p>
              {noListingsLoadedForArea
                ? emptyResultsCopy
                : "Your filters are too tight right now. Try a higher budget, a longer commute, or fewer must-haves."}
            </p>
          </div>
        )}
      </section>
      </div>
      </section>
      {isResultsIntroLoading && (
        <div className="results-scan-overlay" role="status" aria-live="polite">
          <div className="results-scan-scene">
            <span className="loader-shape loader-shape-one" />
            <span className="loader-shape loader-shape-two" />
            <span className="loader-shape loader-shape-three" />
            <span className="loader-shape loader-shape-four" />
            <span className="loader-shape loader-shape-five" />
            <div className="pixel-walk-stage" aria-hidden="true">
              <div className="cat-gif-frame">
                <img
                  className="cat-loader-gif"
                  src="/cat-loader.gif"
                  alt=""
                  draggable="false"
                />
              </div>
              <span className="cat-ground-shadow" />
              <span className="paw-step paw-step-one" />
              <span className="paw-step paw-step-two" />
              <span className="paw-step paw-step-three" />
              <span className="paw-step paw-step-four" />
            </div>
            <p className="loader-caption">Finding places that fit your internship life...</p>
          </div>
        </div>
      )}
      {isTasteProfileReady && !dismissedTastePrompt && !showTasteProfile && (
        <div className="taste-profile-toast" role="status">
          <div>
            <p className="eyebrow">Housing style unlocked</p>
            <p>Want to see what kind of place fits your taste?</p>
          </div>
          <div className="toast-actions">
            <button
              onClick={() => {
                setShowTasteProfile(true);
                setDismissedTastePrompt(true);
              }}
              type="button"
            >
              VIEW TASTE PROFILE
            </button>
            <button
              className="quiet-button"
              onClick={() => setDismissedTastePrompt(true)}
              type="button"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
      {showProfileUpdatedPrompt && !showTasteProfile && (
        <div className="taste-profile-toast profile-update-toast" role="status">
          <div>
            <p className="eyebrow">Housing style updated</p>
            <p>Your style changed as you checked more places.</p>
          </div>
          <div className="toast-actions">
            <button
              onClick={() => {
                setShowTasteProfile(true);
                setShowProfileUpdatedPrompt(false);
              }}
              type="button"
            >
              VIEW TASTE PROFILE
            </button>
            <button
              className="quiet-button"
              onClick={() => setShowProfileUpdatedPrompt(false)}
              type="button"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {showTasteProfile && (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true">
          <div className="profile-modal">
            <button
              className="modal-close-button"
              onClick={() => setShowTasteProfile(false)}
              type="button"
              aria-label="Close taste profile"
            >
              &times;
            </button>
            <p className="eyebrow">Your housing style</p>
            <h2>{tasteProfile.title}</h2>
            <p>{tasteProfile.summary}</p>
            <div className="profile-highlight">
              <strong>Best fit:</strong> {tasteProfile.fitTip}
            </div>
            <p className="profile-suggestion">{tasteProfile.smartSuggestion}</p>
          </div>
        </div>
      )}
      {activePage !== "home" && (
        <button
          className="back-button"
          onClick={() => setActivePage(previousPage)}
          type="button"
          aria-label="Go back"
        >
          <span aria-hidden="true">&larr;</span> Back
        </button>
      )}
    </main>
  );
}

export default App;
