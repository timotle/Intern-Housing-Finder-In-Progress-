import type { Listing } from "../types";

type ListingCardListing = Listing & {
    matchScore?: number;
};

type ListingCardProps = {
    listing: ListingCardListing;
    rank: number;
    onExplainMatch: (listing: ListingCardListing) => void | Promise<void>;
    explanation: string;
    isLoading: boolean;
    hideScore: boolean;
    rankLabel?: string;
    isMapSelected?: boolean;
};

function ListingCard({
    listing,
    rank,
    onExplainMatch,
    explanation,
    isLoading,
    hideScore,
    rankLabel = "Rank",
    isMapSelected = false,
}: ListingCardProps) {
    const isExplanationOpen = Boolean(explanation) || isLoading;
    const squareFeet = listing.squareFootage ? `${listing.squareFootage} sq ft` : "Not listed";
    const baths =
        listing.bathrooms !== undefined && listing.bathrooms !== null
            ? `${listing.bathrooms}`
            : "Not listed";
    const locationText = listing.address || listing.location;
    const hasDirectListingLink = listing.listingLinkType === "direct" && Boolean(listing.websiteUri);
    const listingCheckLabel = listing.websiteLabel || "View listing";

    return(
        <article
            className={`listing-row ${isExplanationOpen ? "has-explanation" : ""} ${
                isMapSelected ? "is-map-selected" : ""
            }`}
        >
            <div className="listing-card">
                <div className="listing-topline">
                    <span>{rankLabel} #{rank}</span>
                    {!hideScore && listing.matchScore !== undefined && (
                        <strong>{Math.round(listing.matchScore)} match score</strong>
                    )}
                </div>
                <h3>{listing.name}</h3>
                <p className="location-line">{locationText}</p>
                {!hideScore && listing.matchScore !== undefined && (
                    <p className="score-note">
                        Based on your commute, budget, lease, space, baths, and amenities.
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
                    <div>
                        <dt>Square feet</dt>
                        <dd>{squareFeet}</dd>
                    </div>
                    <div>
                        <dt>Baths</dt>
                        <dd>{baths}</dd>
                    </div>
                </dl>
                <div className="amenity-tags">
                    {listing.furnished && <span>Furnished</span>}
                    {listing.laundry && <span>Laundry</span>}
                    {listing.parking && <span>Parking</span>}
                </div>
                {hasDirectListingLink ? (
                    <div className="listing-links">
                        <a href={listing.websiteUri} target="_blank" rel="noreferrer">
                            {listingCheckLabel}
                        </a>
                    </div>
                ) : (
                    <p className="listing-link-unavailable">
                        Direct leasing link not provided for this listing yet.
                    </p>
                )}
                <button disabled={isLoading} onClick={() => onExplainMatch(listing)}>
                    {isLoading
                        ? "Checking..."
                        : isExplanationOpen
                          ? "Close explanation"
                          : "Explain tradeoffs"}
                </button>
            </div>
            {isExplanationOpen && (
                <div className="explanation-card">
                    <p className="eyebrow">AI tradeoff check</p>
                    {isLoading ? (
                        <p className="loading-note">Checking the tradeoffs...</p>
                    ) : (
                        <pre>{explanation}</pre>
                    )}
                </div>
            )}
        </article>
    );
} 
export default ListingCard;
