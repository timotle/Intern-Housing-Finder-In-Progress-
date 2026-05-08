# Intern Housing Finder

## Live App

You can try the project here:

https://intern-housing-finder-in-progress.vercel.app/

## Overview

Intern Housing Finder is a web app I built to help students and interns compare housing options when moving for internships. Instead of looking through a bunch of different websites and trying to remember every detail, users can filter listings, compare options, and get AI explanations for the tradeoffs.

## Features

- Filter housing by price, commute time, lease term, bedrooms, square feet, baths, and amenities
- Rank listings with a match score
- Drag and reorder ranking rules based on what the user cares about most
- View 4 listings at a time so the page does not feel overwhelming
- Compare listings with bar graph and line graph views
- Highlight the listings currently being viewed in the visual chart
- Use cached real rental listings from RentCast instead of fake sample listings
- Get AI explanations for housing tradeoffs
- Reveal a housing style after the user compares enough listings
- Use a lightweight PyTorch-trained taste profile model to suggest a smart next listing
- Simple UI made for students and interns

## Languages/Tools/Frameworks

- TypeScript
- React
- Node.js
- Express
- Vercel
- HTML/CSS
- OpenAI API
- RentCast API
- PyTorch/ML

## How It Works

Users enter housing preferences like budget, commute time, lease length, bedrooms, square feet, baths, and amenities. The app filters the listings and ranks them with a match score. Users can also drag the ranking rules to choose what matters most to them, like cheaper rent, shorter commute, lease fit, space, bathrooms, or amenities.

The listing data comes from RentCast. I use RentCast to refresh real active rental listings near the University of Washington, then save those listings into the project so users are not making API calls every time they visit the site. This keeps the app cheaper to run while still replacing the old fake listings with real rental data.

RentCast gives real rent, bedrooms, bathrooms, square footage, listing status, and days on market. Commute time is still an estimate based on distance to campus, and lease length/amenities should still be verified because rental listing APIs do not always include every detail students care about.

The AI part explains tradeoffs between housing options in a way that is easier to understand. It does not just assume the listing a user clicks is the best option. It compares the listing against the ranked list first, then explains why it ranks where it does.

The ML part is for the housing style feature. After a user opens at least 3 listing explanations, the app uses a lightweight PyTorch-trained taste profile model to predict what kind of housing style they seem to prefer. Then it gives a smart pick for what listing they should check next. I did it this way so the ML has a real purpose instead of just being added for no reason.

## Environment Variables

These are set in Vercel, not committed to GitHub:

- `OPENAI_API_KEY`

This is only needed locally when I want to refresh the cached rental listings:

- `RENTCAST_API_KEY`

I do not need to put the RentCast key on Vercel because the app serves the cached listings.

## What Still Needs Development

- Keep refreshing the cached RentCast listings when I want newer housing data
- Find a better way to verify commute, lease, and amenity details
- Keep improving the UI
- Keep improving the ML training examples as the project grows
