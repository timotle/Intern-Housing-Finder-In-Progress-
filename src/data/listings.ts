import type { Listing } from "../types";

export const listings: Listing[] = [
  {
    id: 1,
    name: "The Olive",
    price: 1300,
    location: "Seattle, WA",
    commuteTime: 15,
    leaseTerm: "3 months",
    numBedroom: 4,
    furnished: true,
    laundry: true,
    parking: true,
  },

  {
    id: 2,
    name: "The Standard",
    price: 1500,
    location: "Seattle, WA",
    commuteTime: 25,
    leaseTerm: "6 months",
    numBedroom: 5,
    furnished: true,
    laundry: true,
    parking: true,
  }
];