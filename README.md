# Intern Housing Finder

## Live App

You can try the project here:

https://intern-housing-finder-in-progress.vercel.app/

## Overview

Intern Housing Finder is a web app I built to help students and interns compare housing options when they are moving for internships. The goal is to make the housing search less overwhelming by putting listings, filters, rankings, visuals, and AI explanations in one place.

Instead of just showing a long list of apartments, the app helps users compare what actually matters: price, commute, lease length, bedrooms, square feet, bathrooms, and amenities.

## Core Features

- Choose an internship or commute area before looking at results
- Filter housing by price, commute time, lease term, bedrooms, square feet, baths, and amenities
- Drag ranking rules to decide what matters most
- View 4 listings at a time so the page is easier to use
- Compare listings with a bar graph or line graph
- See listing locations on a map
- Get AI explanations that explain tradeoffs between housing options
- Reveal a housing style after comparing enough listings
- Use a smart pick feature to suggest another listing to check

## Languages/Tools/Frameworks

- TypeScript
- React
- Node.js
- Express
- HTML/CSS
- Vercel
- OpenAI API
- RentCast API
- PyTorch/ML

## How It Works

Users first choose where their internship or commute area is. They can use a preset area or type in a location. The app then uses that location to update the commute estimates and show listings near the area the user is focused on.

After that, users can enter housing preferences like budget, commute time, lease length, bedrooms, square feet, bathrooms, and amenities. They can also drag the ranking rules to choose what matters most to them. For example, one user might care most about cheaper rent, while another user might care more about commute or space.

The app uses real rental listing data from RentCast instead of fake sample listings. The listings are filtered and ranked based on the user's preferences, then shown in a way that is easier to compare.

The AI feature explains tradeoffs between listings. It does not just say the listing a user clicked is good. It compares the selected listing against the ranked options and explains why it may or may not be the best fit.

The ML feature is used for the housing style and smart pick feature. After the user compares enough listings, the app looks at their behavior and gives a simple housing style with a suggested listing to check next.

## Environment Variables

These keys are not committed to GitHub:

- `OPENAI_API_KEY`
- `RENTCAST_API_KEY`

The OpenAI key is used for AI explanations and location matching. The RentCast key is used when refreshing real rental listing data.

## What Still Needs Development

- Keep refreshing the rental listing data
- Improve commute estimates so they are more exact
- Keep improving the housing style and smart pick feature
- Keep improving the UI and overall user experience
