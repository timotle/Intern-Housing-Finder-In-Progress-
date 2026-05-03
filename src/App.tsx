import { useEffect, useState } from "react";
import type { Listing } from "./types";
import ListingCard from "./components/ListingCard";
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

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  //match score implemented here
  const scoredListings = filteredListings.map((listing) => {
    let score = 0;
    // closer to the max the better
    if (maxPrice !== "") {
    const diff = Number(maxPrice) - listing.price;
    score += Math.max(0, 30 - diff * 0.05);
  }
  // the shorter the better
    if (maxCommuteTime !== "") {
    const diff = listing.commuteTime - Number(maxCommuteTime);
    score += Math.max(0, 20 - diff * 2);
  }
  // exact match lease
    if (leaseTerm !== "" && listing.leaseTerm === Number(leaseTerm)) {
    score += 20;
  }

    if (minBedrooms !== "" && listing.numBedroom >= Number(minBedrooms)) {
      score += 10;
    }
    if (furnishedOnly && listing.furnished) {
      score += 15;
    }
    if (laundryOnly && listing.laundry) {
      score += 5;
    }
    if (parkingOnly && listing.parking) {
      score += 5;
    }
    
    return { ...listing, matchScore: score };
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
  const visibleStartRank = sortedListings.length === 0 ? 0 : currentPageStart + 1;
  const visibleEndRank = Math.min(currentPageStart + listingsPerPage, sortedListings.length);

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
        <h1>Intern Housing Finder</h1>
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
