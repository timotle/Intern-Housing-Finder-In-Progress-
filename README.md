# Intern Housing Finder

## Overview

This is a full-stack web app I built to help students and interns compare housing options when moving for internships. Instead of checking a bunch of different websites, users can filter listings, compare options, and get AI explanations for the tradeoffs.

## Features

- Filter housing by price, commute time, lease term, bedrooms, and amenities
- Rank listings with a match score
- Drag and reorder ranking rules based on what the user cares about most
- View 4 listings at a time so the page does not feel overwhelming
- Compare listings with bar graph and line graph views
- Get AI explanations for housing tradeoffs
- Simple UI made for students and interns

## Languages/Tools/Frameworks

- TypeScript
- React
- Node.js
- Express
- HTML/CSS
- OpenAI API
- PyTorch/ML (in progress)

## How It Works

Users enter their housing preferences, like budget, commute time, lease length, bedrooms, and amenities. The app filters the listings and ranks them with a match score. Users can also drag the ranking rules to choose what matters most to them, like cheaper rent, shorter commute, or more bedrooms.

The AI part explains tradeoffs between housing options in a way that is easier to understand.

## What Still Needs Development

- Replace sample listings with real listing/map data using the Google Maps API
- Keep improving the UI
- Add PyTorch/ML experiments later

## Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/timotle/Intern-Housing-Finder-In-Progress-.git
   cd Intern-Housing-Finder-In-Progress-
   ```

2. Install frontend dependencies:

   ```bash
   npm install
   ```

3. Install backend dependencies:

   ```bash
   cd server
   npm install
   ```

4. Add your OpenAI API key:

   Create a `.env` file inside the `server` folder and add:

   ```env
   OPENAI_API_KEY=your_api_key_here
   ```

   The AI explanation feature needs an OpenAI API key. Without it, the filtering, ranking, and charts can still work.

5. Run the backend:

   ```bash
   cd server
   npm start
   ```

6. Run the frontend in a new terminal:

   ```bash
   npm run dev
   ```

7. Open the app:

   Go to `http://localhost:5173`

## Notes

Make sure the frontend and backend are both running at the same time.
