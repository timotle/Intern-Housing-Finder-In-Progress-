import type { Listing } from "../types";
// our fake data -> can transition to data scraping later
export const listings: Listing[] = [
  {
    id: 1,
    name: "The Olive",
    price: 1300,
    location: "Seattle, WA",
    commuteTime: 15,
    leaseTerm: 3,
    numBedroom: 4,
    furnished: true,
    laundry: false,
    parking: true,
  },

  {
    id: 2,
    name: "The Standard",
    price: 1500,
    location: "Seattle, WA",
    commuteTime: 25,
    leaseTerm: 6,
    numBedroom: 5,
    furnished: true,
    laundry: true,
    parking: false,
  }
];