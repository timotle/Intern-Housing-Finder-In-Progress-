import type { Listing } from "../types";

export const listings: Listing[] = [
  {
    id: 1,
    name: "The Olive",
    price: 1300,
    location: "Seattle, WA",
    commuteTime: 15,
    leaseTerm: "3 months",
    numPeople: 5,
    description: "a premier, modern student housing community offering fully furnished, high-end apartments"
  },
  {
    id: 2,
    name: "The Standard",
    price: 1500,
    location: "Seattle, WA",
    commuteTime: 25,
    leaseTerm: "6 months",
    numPeople: 6,
    description: "Affordable shared housing with amenities."
  }
];