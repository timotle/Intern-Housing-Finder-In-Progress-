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
  const [maxPrice, setMaxPrice] = useState("");
  const [maxCommuteTime, setMaxCommuteTime] = useState("");
  const [leaseTerm, setLeaseTerm] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [laundryOnly, setLaundryOnly] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

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
    <div>
      <h1>Intern Housing Finder</h1>
      <input
        type="number"
        placeholder="Max Price"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
      />
      <input
        type="number"
        placeholder="Max Commute Time"
        value={maxCommuteTime}
        onChange={(e) => setMaxCommuteTime(e.target.value)}
      />
      <input
        type="number"
        placeholder="Lease Term (months)"
        value={leaseTerm}
        onChange={(e) => setLeaseTerm(e.target.value)}
      />
      <input
        type="number"
        placeholder="Minimum number of Bedrooms"
        value={minBedrooms}
        onChange={(e) => setMinBedrooms(e.target.value)}
      />
      <div style={{ marginTop: "10px", display: "flex", gap: "15px", justifyContent: "center" }}>
        <label>
          <input
            type="checkbox"
            checked={furnishedOnly}
            onChange={(e) => setFurnishedOnly(e.target.checked)}
          />
          Furnished Only
        </label>
        <label>
          <input
            type="checkbox"
            checked={laundryOnly}
            onChange={(e) => setLaundryOnly(e.target.checked)}
          />
          Laundry Only
        </label>
        <label>
          <input
            type="checkbox"
            checked={parkingOnly}
            onChange={(e) => setParkingOnly(e.target.checked)}
          />
          Parking Only
        </label>
      </div>
      <p>{filteredListings.length} listing(s) found</p>
      {sortedListings.map((listing, index) => (
        <ListingCard 
          key={listing.id} 
          listing={listing}
          rank={index + 1} 
          onExplainMatch={explainMatch}
          explanation={explanations[listing.id] || ""}
          isLoading={loadingId === listing.id}/>
      ))}
    </div>
  );
}

export default App;