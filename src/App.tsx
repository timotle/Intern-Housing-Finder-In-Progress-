import { listings } from "./data/listings";
import ListingCard from "./components/ListingCard";

function App() {
  return (
    <div>
      <h1>Intern Housing Finder</h1>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />))}
    </div>
  );
}

export default App;