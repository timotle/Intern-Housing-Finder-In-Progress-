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
    const isStudio = listing.numBedroom === 0;
    const squareFeet = listing.squareFootage ? `${listing.squareFootage} sq ft` : "Not listed";
    const baths =
        listing.bathrooms !== undefined && listing.bathrooms !== null
            ? `${listing.bathrooms}`
            : "Baths not listed";
    const hasListingLink = listing.listingLinkType !== "unavailable" && Boolean(listing.websiteUri);
    const listingCheckLabel = listing.websiteLabel || "View listing";
    const hasContactLink = Boolean(listing.contactUri);
    return(
        <article
            id={`listing-${listing.id}`}
            className={`listing-row ${isExplanationOpen ? "has-explanation" : ""} ${
                isMapSelected ? "is-map-selected" : ""
            }`}
            data-listing-card={listing.id}
        >
            <div className="listing-card">
                <div className="listing-topline">
                    <span>{rankLabel} #{rank}</span>
                    {!hideScore && listing.matchScore !== undefined && (
                        <strong>{Math.round(listing.matchScore)} match score</strong>
                    )}
                </div>
                <h3>{listing.name}</h3>
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
                    {isStudio && <span>Studio</span>}
                    {listing.amenitiesKnown === false ? (
                        <span>Amenities not listed</span>
                    ) : (
                        <>
                            {listing.furnished && <span>Furnished</span>}
                            {listing.laundry && <span>Laundry</span>}
                            {listing.parking && <span>Parking</span>}
                        </>
                    )}
                </div>
                {hasListingLink ? (
                    <div className="listing-links">
                        <a href={listing.websiteUri} target="_blank" rel="noreferrer">
                            {listingCheckLabel}
                        </a>
                    </div>
                ) : hasContactLink ? (
                    <div className="listing-links">
                        <a
                            className="listing-contact-link"
                            href={listing.contactUri}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {listing.contactLabel || "Contact listing office"}
                        </a>
                    </div>
                ) : (
                    <p className="listing-link-unavailable">
                        Direct leasing link not provided for this listing yet.
                    </p>
                )}
                <button disabled={isLoading} onClick={() => onExplainMatch(listing)} type="button">
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
