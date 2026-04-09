function ListingCard({ listing, onExplainMatch }: any) {
    return(
        <div>
            <h2>{listing.name}</h2>
            {listing.matchScore !== undefined && (
                <p>Match Score: {listing.matchScore}</p>
            )}
            <p>Price: ${listing.price}</p>
            <p>Location: {listing.location}</p>
            <p>Commute Time: {listing.commuteTime} minutes</p>
            <p>Lease Term: {listing.leaseTerm} months</p>
            <p>Number of Bedrooms: {listing.numBedroom}</p>
            <p>{listing.furnished && "Furnished"}</p>
            <p>{listing.laundry && "Laundry"}</p>
            <p>{listing.parking && "Parking"}</p>
            <button onClick={() => onExplainMatch(listing)}>
            Explain This Match Score
            </button>
        </div>
    );
} 
export default ListingCard;