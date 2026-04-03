import { listings } from "./data/listings";
import ListingCard from "./components/ListingCard";
import { useState } from "react";
function App() {
  const [maxPrice, setMaxPrice] = useState("");
  const [maxCommuteTime, setMaxCommuteTime] = useState("");
  const [leaseTerm, setLeaseTerm] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [laundryOnly, setLaundryOnly] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);

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
    if (maxPrice !== "" && listing.price <= Number(maxPrice)) {
      score += 25;
    }
    if (maxCommuteTime !== "" && listing.commuteTime <= Number(maxCommuteTime)) {
      score += 20;
    }
    if (leaseTerm !== "" && listing.leaseTerm === Number(leaseTerm)) {
      score += 20;
    }
    if (minBedrooms !== "" && listing.numBedroom >= Number(minBedrooms)) {
      score += 15;
    }
    if (furnishedOnly && listing.furnished) {
      score += 10;
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
  const sortedListings = scoredListings.sort(
    (a, b) => b.matchScore - a.matchScore
  );

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
      {sortedListings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

export default App;