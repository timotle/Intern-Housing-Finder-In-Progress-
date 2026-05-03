# Intern Housing Finder

## Overview

This is a full-stack web application I built to help students and interns find and compare housing options when relocating for internships. Instead of searching across multiple websites, users can filter listings and get AI-generated recommendations based on their preferences.

## Features

- Filter housing by price, commute distance, lease term, and number of occupants
- Compare multiple listings side by side
- Generate AI-powered recommendations for best-fit housing
- Provide pros and cons for each listing
- Explain tradeoffs between different housing options
- Simple navigation and clean user interface
- Provide a match score based on the user's preferences

## Languages/Tools/Frameworks

- TypeScript
- React
- Node.js
- Express
- HTML/CSS
- OpenAI API
- PyTorch (in progress)

## How It Works

Users input their housing preferences such as budget, commute distance, and lease duration. The application filters available listings based on these constraints. An AI component analyzes the filtered results and generates structured insights, including tradeoffs and personalized recommendations. The app also calculates a match score based on the user's preferences, helping users understand which option best fits their needs.

## What Still Needs Development

- Sample listings need to be replaced by using the Google Maps API
- UI needs to be worked on
- PyTorch/ML needs to be implemented experimentally

## Setup Instructions

To run this project locally, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/timotle/Intern-Housing-Finder-In-Progress.git
   cd Intern-Housing-Finder-In-Progress
   ```

2. Install dependencies:

   Frontend:

   ```bash
   npm install
   ```

   Backend:

   ```bash
   cd server
   npm install
   ```

3. Set up environment variables:

   This project uses the OpenAI API for AI recommendations, but the API key is not included for security reasons.

   Create a `.env` file inside the `/server` folder and add:

   ```env
   OPENAI_API_KEY=your_api_key_here
   ```

   To use the AI features, you will need your own ChatGPT/OpenAI account. From there, go to your settings, generate an API key, and copy and paste it into the `.env` file.

   API usage may require billing.

   Once added, the recommendation system will work as expected. Without it, the filtering and comparison features will still run normally.

4. Run the backend:

   ```bash
   cd server
   npm start
   ```

5. Run the frontend in a new terminal:

   ```bash
   npm run dev
   ```

6. Open the app:

   Go to `http://localhost:5173`

## Notes

Make sure both frontend and backend are running at the same time.
