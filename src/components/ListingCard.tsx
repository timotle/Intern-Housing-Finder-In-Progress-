import type { Listing } from "../types";

type ListingCardProps = {
    listing: Listing;
};

function ListingCard({ listing }: ListingCardProps) {
    return(
        <div>
            <h2>{listing.name}</h2>
            <p>Price: ${listing.price}</p>
            <p>Location: {listing.location}</p>
            <p>Commute Time: {listing.commuteTime} minutes</p>
            <p>Lease Term: {listing.leaseTerm} months</p>
            <p>Number of Bedrooms: {listing.numBedroom}</p>
            <p>{listing.furnished && "Furnished"}</p>
            <p>{listing.laundry && "Laundry"}</p>
            <p>{listing.parking && "Parking"}</p>
        </div>
    );
}
export default ListingCard;