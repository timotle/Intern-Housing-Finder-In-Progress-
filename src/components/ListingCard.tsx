function ListingCard({
    listing,
    rank,
    onExplainMatch,
    explanation,
    isLoading,
    hideScore,
}: any) {
    return(
        <article className="listing-row">
            <div className="listing-card">
                <div className="listing-topline">
                    <span>Rank #{rank}</span>
                    {!hideScore && listing.matchScore !== undefined && (
                        <strong>{Math.round(listing.matchScore)} match score</strong>
                    )}
                </div>
                <h3>{listing.name}</h3>
                {!hideScore && listing.matchScore !== undefined && (
                    <p className="score-note">
                        Scored from price, commute, lease, bedrooms, and amenities.
                    </p>
                )}
                <dl className="listing-facts">
                    <div>
                        <dt>Price</dt>
                        <dd>${listing.price}</dd>
                    </div>
                    <div>
                        <dt>Commute</dt>
                        <dd>{listing.commuteTime} min</dd>
                    </div>
                    <div>
                        <dt>Lease</dt>
                        <dd>{listing.leaseTerm} mo</dd>
                    </div>
                    <div>
                        <dt>Bedrooms</dt>
                        <dd>{listing.numBedroom}</dd>
                    </div>
                </dl>
                <p className="location-line">{listing.location}</p>
                <div className="amenity-tags">
                    {listing.furnished && <span>Furnished</span>}
                    {listing.laundry && <span>Laundry</span>}
                    {listing.parking && <span>Parking</span>}
                </div>
                <button onClick={() => onExplainMatch(listing)}>
                    {explanation ? "Close explanation" : "Explain tradeoffs"}
                </button>
                {isLoading && <p className="loading-note">Generating explanation...</p>}
            </div>
            {explanation && (
                <div className="explanation-card">
                    <p className="eyebrow">LLM explanation</p>
                    <pre>{explanation}</pre>
                </div>
            )}
        </article>
    );
} 
export default ListingCard;
