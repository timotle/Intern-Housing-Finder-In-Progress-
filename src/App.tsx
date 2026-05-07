import { useEffect, useState } from "react";
import type { Listing } from "./types";
import ListingCard from "./components/ListingCard";
import { predictTasteProfile } from "./data/tasteProfileModel";

type UserPreferences = {
  maxPrice: string;
  maxCommuteTime: string;
  leaseTerm: string;
  minBedrooms: string;
  furnishedOnly: boolean;
  laundryOnly: boolean;
  parkingOnly: boolean;
};

type ScoreBreakdownItem = {
  label: string;
  points: number;
  explanation: string;
};

type ScoredListing = Listing & {
  matchScore: number;
  scoreBreakdown: ScoreBreakdownItem[];
};

type ScoreCategoryKey = "budget" | "commute" | "lease" | "bedrooms" | "amenities";
type ChartMetric = "matchScore" | "price" | "commuteTime" | "leaseTerm" | "numBedroom";
type ChartType = "bar" | "line";
type PageKey = "home" | "preferences" | "ranking" | "results";
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function getMatchExplanation(
  userPreferences: any,
  selectedListing: any,
  visibleListings: any[]
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
    console.error("The explanation erorr:", error);
    return error instanceof Error
      ? `Sorry, the AI explanation could not be generated right now. ${error.message}`
      : "Sorry, the AI explanation could not be generated right now.";
  }
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
  amenities: {
    label: "Amenities",
    shortLabel: "Amenities",
    description: "Furnished, laundry, and parking add points.",
    maxPoints: 20,
  },
};

const priorityMultipliers = [1.4, 1.2, 1, 0.85, 0.7];

function getRange(listings: Listing[], key: "price" | "commuteTime" | "leaseTerm" | "numBedroom") {
  const values = listings.map((listing) => listing[key]);
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
};

function inferTasteProfile({
  preferences,
  priorityOrder,
  rankingMode,
  chartMetric,
  sortedListings,
  interactions,
}: {
  preferences: UserPreferences;
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
    amenities: 0,
  };

  if (rankingMode !== "skipped") {
    priorityOrder.forEach((category, index) => {
      categoryScores[category] += 5 - index;
    });
  }

  if (preferences.maxPrice !== "") {
    categoryScores.budget += Number(preferences.maxPrice) <= 1500 ? 2.5 : 1;
  }
  if (preferences.maxCommuteTime !== "") {
    categoryScores.commute += Number(preferences.maxCommuteTime) <= 15 ? 2.5 : 1;
  }
  if (preferences.leaseTerm !== "") {
    categoryScores.lease += 1.5;
  }
  if (preferences.minBedrooms !== "") {
    categoryScores.bedrooms += Number(preferences.minBedrooms) >= 2 ? 2 : 1;
  }
  const requiredAmenities = [
    preferences.furnishedOnly,
    preferences.laundryOnly,
    preferences.parkingOnly,
  ].filter(Boolean).length;
  categoryScores.amenities += requiredAmenities * 1.2;

  if (chartMetric === "price") categoryScores.budget += 1.5;
  if (chartMetric === "commuteTime") categoryScores.commute += 1.5;
  if (chartMetric === "leaseTerm") categoryScores.lease += 1.5;
  if (chartMetric === "numBedroom") categoryScores.bedrooms += 1.5;

  const clickedListings = sortedListings.filter((listing) =>
    interactions.explanationClicks.includes(listing.id)
  );
  const medianPrice = sortedListings[Math.floor(sortedListings.length / 2)]?.price ?? 0;
  const medianCommute = sortedListings[Math.floor(sortedListings.length / 2)]?.commuteTime ?? 0;

  clickedListings.forEach((listing) => {
    if (medianPrice > 0 && listing.price <= medianPrice) categoryScores.budget += 1;
    if (medianCommute > 0 && listing.commuteTime <= medianCommute) categoryScores.commute += 1;
    if (listing.leaseTerm <= 12) categoryScores.lease += 0.6;
    if (listing.numBedroom >= 2) categoryScores.bedrooms += 0.9;
    if ([listing.furnished, listing.laundry, listing.parking].filter(Boolean).length >= 2) {
      categoryScores.amenities += 0.9;
    }
  });

  const rankedSignals = (Object.entries(categoryScores) as Array<[ScoreCategoryKey, number]>)
    .sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = rankedSignals[0];
  const secondCategory = rankedSignals[1][0];
  const isBalanced = topScore - rankedSignals[1][1] < 1.25;
  const priorityStrength = (category: ScoreCategoryKey) =>
    rankingMode === "skipped"
      ? 0
      : (priorityOrder.length - priorityOrder.indexOf(category)) / priorityOrder.length;
  const predictedProfile = predictTasteProfile({
    budgetPriority: priorityStrength("budget"),
    commutePriority: priorityStrength("commute"),
    leasePriority: priorityStrength("lease"),
    bedroomsPriority: priorityStrength("bedrooms"),
    amenitiesPriority: priorityStrength("amenities"),
    strictBudget: preferences.maxPrice !== "" && Number(preferences.maxPrice) <= 1500 ? 1 : 0,
    strictCommute:
      preferences.maxCommuteTime !== "" && Number(preferences.maxCommuteTime) <= 15 ? 1 : 0,
    leaseSet: preferences.leaseTerm !== "" ? 1 : 0,
    bedroomNeed: preferences.minBedrooms !== "" && Number(preferences.minBedrooms) >= 2 ? 1 : 0,
    amenityNeed: requiredAmenities / 3,
    priceChart: chartMetric === "price" ? 1 : 0,
    commuteChart: chartMetric === "commuteTime" ? 1 : 0,
    leaseChart: chartMetric === "leaseTerm" ? 1 : 0,
    bedroomChart: chartMetric === "numBedroom" ? 1 : 0,
    explanationActivity: Math.min(interactions.explanationClicks.length / 3, 1),
    pagingActivity: Math.min(interactions.listingPageChanges / 3, 1),
  });

  let title = "Balanced bestie";
  if (predictedProfile === "budget_commuter") {
    title = "Lime scooter warrior";
  } else if (predictedProfile === "budget_first") {
    title = "King Rent";
  } else if (predictedProfile === "convenience") {
    title = "Got no Lime scooter?";
  } else if (predictedProfile === "lease_planner") {
    title = "Lease locked in";
  } else if (predictedProfile === "comfort") {
    title = "Chud";
  } else if (!isBalanced && topCategory === "budget" && secondCategory === "commute") {
    title = "Lime scooter warrior";
  }

  return {
    title,
    summary: `You seem to care most about ${scoreCategories[topCategory].label.toLowerCase()} while still comparing ${scoreCategories[secondCategory].label.toLowerCase()} closely.`,
    fitTip: `Your best fit will probably balance ${scoreCategories[topCategory].label.toLowerCase()} with ${scoreCategories[secondCategory].label.toLowerCase()}.`,
    smartSuggestion:
      sortedListings[0] !== undefined
        ? `Start with ${sortedListings[0].name}, then compare it against the next few listings before deciding.`
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

function App() {
  const listingsPerPage = 4;
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxCommuteTime, setMaxCommuteTime] = useState("");
  const [leaseTerm, setLeaseTerm] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [laundryOnly, setLaundryOnly] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("matchScore");
  const [rankingMode, setRankingMode] = useState<RankingMode>("default");
  const [showTasteProfile, setShowTasteProfile] = useState(false);
  const [dismissedTastePrompt, setDismissedTastePrompt] = useState(false);
  const [lastProfileTitle, setLastProfileTitle] = useState("");
  const [showProfileUpdatedPrompt, setShowProfileUpdatedPrompt] = useState(false);
  const [interactions, setInteractions] = useState<InteractionSignals>({
    explanationClicks: [],
    resultPageViews: 0,
    chartMetricChanges: 0,
    listingPageChanges: 0,
  });
  const [priorityOrder, setPriorityOrder] = useState<ScoreCategoryKey[]>([
    "budget",
    "commute",
    "lease",
    "bedrooms",
    "amenities",
  ]);
  const [draggedPriority, setDraggedPriority] = useState<ScoreCategoryKey | null>(null);
  const [dragOverPriority, setDragOverPriority] = useState<ScoreCategoryKey | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const userPreferences: UserPreferences = {
    maxPrice,
    maxCommuteTime,
    leaseTerm,
    minBedrooms,
    furnishedOnly,
    laundryOnly,
    parkingOnly,
  };
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/listings`);
        if (!response.ok) {
          throw new Error("Failed to fetch listings");
        }
        const data: Listing[] = await response.json();
        setListings(data);
      } catch (err) {
        console.error(err);
        setError("Could not load listings");
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const filteredListings = listings.filter((listing) => {
    const matchesPrice =
      maxPrice === "" || listing.price <= Number(maxPrice);

    const matchesCommuteTime =
      maxCommuteTime === "" || listing.commuteTime <= Number(maxCommuteTime);

    const matchesLeaseTerm =
      leaseTerm === "" || listing.leaseTerm === Number(leaseTerm);

    const matchesBedrooms =
      minBedrooms === "" || listing.numBedroom >= Number(minBedrooms);

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
      matchesFurnished &&
      matchesLaundry &&
      matchesParking
    );
  });
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
  const visibleStartRank = sortedListings.length === 0 ? 0 : currentPageStart + 1;
  const visibleEndRank = Math.min(currentPageStart + listingsPerPage, sortedListings.length);
  const stepPages: Array<{ key: StepPageKey; label: string }> = [
    { key: "preferences", label: "Preferences" },
    { key: "ranking", label: "Ranking Rules" },
    { key: "results", label: "Results" },
  ];
  const currentStepIndex = stepPages.findIndex((page) => page.key === activePage);
  const previousPage: PageKey =
    currentStepIndex <= 0 ? "home" : stepPages[currentStepIndex - 1].key;
  const tasteProfile = inferTasteProfile({
    preferences: userPreferences,
    priorityOrder,
    rankingMode,
    chartMetric: effectiveChartMetric,
    sortedListings,
    interactions,
  });
  const viewedListingIds = new Set(interactions.explanationClicks);
  const isTasteProfileReady = activePage === "results" && viewedListingIds.size >= 3;

  const movePriority = (targetCategory: ScoreCategoryKey) => {
    if (!draggedPriority || draggedPriority === targetCategory) {
      return;
    }
    setRankingMode("custom");

    setPriorityOrder((currentOrder) => {
      const draggedIndex = currentOrder.indexOf(draggedPriority);
      const targetIndex = currentOrder.indexOf(targetCategory);
      const withoutDragged = currentOrder.filter((category) => category !== draggedPriority);
      const adjustedTargetIndex = withoutDragged.indexOf(targetCategory);
      const insertIndex =
        draggedIndex < targetIndex ? adjustedTargetIndex + 1 : adjustedTargetIndex;

      return [
        ...withoutDragged.slice(0, insertIndex),
        draggedPriority,
        ...withoutDragged.slice(insertIndex),
      ];
    });
    setDraggedPriority(null);
    setDragOverPriority(null);
  };

  useEffect(() => {
    setCurrentPage(0);
  }, [
    maxPrice,
    maxCommuteTime,
    leaseTerm,
    minBedrooms,
    furnishedOnly,
    laundryOnly,
    parkingOnly,
  ]);

  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

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
  const explainMatch = async (listing: any) => {
    if (explanations[listing.id]) {
      setExplanations((prev) => {
      const updated = { ...prev };
      delete updated[listing.id];
      return updated;
    });
    return;
  }
    setInteractions((current) => ({
      ...current,
      explanationClicks: current.explanationClicks.includes(listing.id)
        ? current.explanationClicks
        : [...current.explanationClicks, listing.id],
    }));
    setLoadingId(listing.id);
    const explanation = await getMatchExplanation(
      {
        maxPrice,
        maxCommuteTime,
        leaseTerm,
        minBedrooms,
        furnishedOnly,
        laundryOnly,
        parkingOnly
      },
      listing,
      sortedListings
    );
    setExplanations(() => ({
      [listing.id]: explanation,
    }));
    setLoadingId(null);
  }
  if (loading) return <p>Loading listings...</p>;
  if (error) return <p>{error}</p>;
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">AI-assisted decision support</p>
        <h1>
          Intern <span className="title-keep">Housing Finder</span>
        </h1>
        <p className="hero-copy">
          Compare messy housing options with structured ranking rules, match
          scores, and LLM-generated explanations that call out tradeoffs.
        </p>
        <div className="hero-points" aria-label="Project strengths">
          <span>Ranked recommendations</span>
          <span>Transparent tradeoffs</span>
          <span>Student-friendly explanations</span>
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
        <div className="home-grid">
          <article className="home-card">
            <p className="eyebrow">Step 1</p>
            <h3>Set preferences</h3>
            <p>Choose budget, commute, lease, bedrooms, and must-have amenities.</p>
          </article>
          <article className="home-card">
            <p className="eyebrow">Step 2</p>
            <h3>Rank priorities</h3>
            <p>
              Drag the priority cards in order from most important to least
              important.
            </p>
          </article>
          <article className="home-card">
            <p className="eyebrow">Step 3</p>
            <h3>Compare results</h3>
            <p>
              See your filtered listings, compare them visually, and review the
              options four at a time.
            </p>
          </article>
        </div>
        <div className="start-panel">
          <button onClick={() => setActivePage("preferences")} type="button">
            Start
          </button>
        </div>
      </section>

      <section className={`page-section decision-panel ${activePage === "preferences" ? "" : "is-hidden"}`}>
        <div className="panel-heading">
          <p className="eyebrow">User preferences</p>
          <h2>Filter the decision space</h2>
        </div>

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
              setFurnishedOnly(false);
              setLaundryOnly(false);
              setParkingOnly(false);
              setActivePage("ranking");
            }}
            type="button"
          >
            Skip this step
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
            <p className="eyebrow">Personal ranking</p>
            <h2>Ranking Rules</h2>
          </div>
          <p className="panel-copy">
            Drag what matters most to the top. Your order changes the match
            scores right away, so the list can reflect how you actually make a
            housing decision.
          </p>
          <div className="priority-list" aria-label="Drag to reorder ranking priorities">
            {priorityOrder.map((category, index) => {
              const categoryInfo = scoreCategories[category];

              return (
                <article
                  className={`priority-card ${draggedPriority === category ? "is-dragging" : ""} ${
                    dragOverPriority === category ? "is-drag-over" : ""
                  }`}
                  draggable
                  key={category}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    const dragPreview = event.currentTarget.cloneNode(true) as HTMLElement;
                    dragPreview.classList.add("priority-drag-preview");
                    document.body.appendChild(dragPreview);
                    event.dataTransfer.setDragImage(dragPreview, 24, 24);
                    window.setTimeout(() => dragPreview.remove(), 0);
                    setDraggedPriority(category);
                  }}
                  onDragEnd={() => {
                    setDraggedPriority(null);
                    setDragOverPriority(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverPriority(category);
                  }}
                  onDragLeave={() => {
                    if (dragOverPriority === category) {
                      setDragOverPriority(null);
                    }
                  }}
                  onDrop={() => movePriority(category)}
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
              Most important: <strong>{scoreCategories[priorityOrder[0]].label}</strong>.
              Least important:{" "}
              <strong>{scoreCategories[priorityOrder[priorityOrder.length - 1]].label}</strong>.
              Ready to move to the next step!
            </p>
          </div>
          <div className="page-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setRankingMode("skipped");
                setChartMetric("price");
                setActivePage("results");
              }}
              type="button"
            >
              Skip this step
            </button>
            <button
              onClick={() => {
                setRankingMode((current) => (current === "skipped" ? "default" : current));
                setActivePage("results");
              }}
              type="button"
            >
              Save & Continue <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
      </section>

      <section className={`page-section results-page ${activePage === "results" ? "" : "is-hidden"}`}>
      <div className="results-layout">
      <section className="chart-panel">
        <div className="chart-header">
          <div>
            <p className="eyebrow">Visual comparison</p>
            <h2>Compare filtered listings</h2>
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
              </select>
            </label>
          </div>
        </div>
        <p className="panel-copy">
          The graph shows every listing that passes your filters. The four
          listings currently shown below are highlighted.
          {rankingMode === "skipped" && " Since ranking was skipped, the order is random for browsing."}
        </p>
        <ListingMetricChart
          listings={sortedListings}
          highlightedListingIds={visibleListingIds}
          metric={effectiveChartMetric}
          chartType={chartType}
          xAxisLabel={rankingMode === "skipped" ? "Browsing order" : "Ranked listings"}
        />
      </section>

      <section className="results-section">
        <div className="results-header">
          <div>
            <p className="eyebrow">{rankingMode === "skipped" ? "Browsing output" : "Ranked output"}</p>
            <h2>{filteredListings.length} listing(s) found</h2>
          </div>
        </div>

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
            Showing {rankingMode === "skipped" ? "listings" : "ranks"}{" "}
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
              isLoading={loadingId === listing.id}
              hideScore={rankingMode === "skipped"}
              rankLabel={rankingMode === "skipped" ? "Listing" : "Rank"}/>
          ))}
        </div>
      </section>
      </div>
      </section>
      {isTasteProfileReady && !dismissedTastePrompt && !showTasteProfile && (
        <div className="taste-profile-toast" role="status">
          <div>
            <p className="eyebrow">Housing style ready</p>
            <p>Want to see what kind of housing fit you seem to prefer?</p>
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
            <p>Your taste profile changed as you compared more listings.</p>
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
              <strong>Best fit style:</strong> {tasteProfile.fitTip}
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
