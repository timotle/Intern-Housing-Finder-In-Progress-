# Intern Housing Finder

## Live App

You can try the project here:

https://intern-housing-finder-in-progress.vercel.app/

## Overview

Intern Housing Finder is a web app I built to help students and interns compare housing options when moving for internships. Instead of looking through a bunch of different websites and trying to remember every detail, users can filter listings, compare options, and get AI explanations for the tradeoffs.

## Features

- Filter housing by price, commute time, lease term, bedrooms, and amenities
- Rank listings with a match score
- Drag and reorder ranking rules based on what the user cares about most
- View 4 listings at a time so the page does not feel overwhelming
- Compare listings with bar graph and line graph views
- Highlight the listings currently being viewed in the visual chart
- Get AI explanations for housing tradeoffs
- Simple UI made for students and interns

## Languages/Tools/Frameworks

- TypeScript
- React
- Node.js
- Express
- Vercel
- HTML/CSS
- OpenAI API
- PyTorch/ML (in progress)

## How It Works

Users enter housing preferences like budget, commute time, lease length, bedrooms, and amenities. The app filters the listings and ranks them with a match score. Users can also drag the ranking rules to choose what matters most to them, like cheaper rent, shorter commute, lease fit, bedrooms, or amenities.

The AI part explains tradeoffs between housing options in a way that is easier to understand. It does not just assume the listing a user clicks is the best option. It compares the listing against the ranked list first, then explains why it ranks where it does.

## What Still Needs Development

- Replace sample listings with real listing/map data using the Google Maps API
- Keep improving the UI
- Add PyTorch/ML experiments later
