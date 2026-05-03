import { useEffect, useState } from "react";
import type { Listing } from "./types";
import ListingCard from "./components/ListingCard";

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

async function getMatchExplanation(
  userPreferences: any,
  selectedListing: any,
  visibleListings: any[]
) {
  try {
    const response = await fetch("http://localhost:5000/api/explain-match", {
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

    if (!response.ok) {
      throw new Error("Sorry explanation could not be fetched");
    }

    const data = await response.json();
    return data.explanation;
  } catch (error) {
    console.error("The explanation erorr:", error);
    return "Sorry the explanation can't be generated right now.";
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

function ListingMetricChart({
  listings,
  highlightedListingIds,
  metric,
  chartType,
}: {
  listings: ScoredListing[];
  highlightedListingIds: number[];
  metric: ChartMetric;
  chartType: ChartType;
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
          Ranked listings
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
                  className="chart-value"
                  x={x + barWidth / 2}
                  y={Math.max(20, y - 8 - (isDenseChart ? (index % 2) * 16 : 0))}
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
        const response = await fetch("http://localhost:5000/api/listings");
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
  const sortedListings = [...scoredListings].sort(
    (a, b) => b.matchScore - a.matchScore
  );
  const totalPages = Math.max(1, Math.ceil(sortedListings.length / listingsPerPage));
  const currentPageStart = currentPage * listingsPerPage;
  const visiblePageListings = sortedListings.slice(
    currentPageStart,
    currentPageStart + listingsPerPage
  );
  const visibleListingIds = visiblePageListings.map((listing) => listing.id);
  const visibleStartRank = sortedListings.length === 0 ? 0 : currentPageStart + 1;
  const visibleEndRank = Math.min(currentPageStart + listingsPerPage, sortedListings.length);

  const movePriority = (targetCategory: ScoreCategoryKey) => {
    if (!draggedPriority || draggedPriority === targetCategory) {
      return;
    }

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
    setExplanations((prev) => ({
      ...prev,
      [listing.id]: explanation,
    }));
    setLoadingId(null);
  }
  if (loading) return <p>Loading listings...</p>;
  if (error) return <p>{error}</p>;
  return (
    <main className="app-shell">
      <section className="hero-section">
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
      </section>

      <section className="decision-panel">
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
      </section>

      <section className="rules-panel">
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
          <div className="priority-actions" aria-label="Priority quick actions">
            {priorityOrder.map((category, index) => (
              <article className="priority-summary" key={category}>
                <strong>{scoreCategories[category].shortLabel}</strong>
                <span>{index === 0 ? "Most important" : `Priority ${index + 1}`}</span>
              </article>
            ))}
          </div>
      </section>

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
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as ChartMetric)}
              >
                <option value="matchScore">Match score</option>
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
        </p>
        <ListingMetricChart
          listings={sortedListings}
          highlightedListingIds={visibleListingIds}
          metric={chartMetric}
          chartType={chartType}
        />
      </section>

      <section className="results-section">
        <div className="results-header">
          <div>
            <p className="eyebrow">Ranked output</p>
            <h2>{filteredListings.length} listing(s) found</h2>
          </div>
          <p>
            Listings are sorted by a structured match score before the AI
            explains the selected option.
          </p>
        </div>

        <div className="listing-pager" aria-label="Listing navigation">
          <button
            className="arrow-button"
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
            disabled={currentPage === 0}
            aria-label="Previous listings"
          >
            <span aria-hidden="true">←</span>
          </button>
          <p>
            Showing ranks <strong>{visibleStartRank}-{visibleEndRank}</strong> of{" "}
            <strong>{sortedListings.length}</strong>
          </p>
          <button
            className="arrow-button"
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages - 1, page + 1))
            }
            disabled={currentPage >= totalPages - 1}
            aria-label="Next listings"
          >
            <span aria-hidden="true">→</span>
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
              isLoading={loadingId === listing.id}/>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
