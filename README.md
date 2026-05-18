# 🏠 Housing Finder

## 🌐 Live App

You can try the project here:

https://intern-housing-finder-in-progress.vercel.app/

If the live site is not loading fresh listings, it is probably because the RentCast API key is not active in Vercel anymore. To use the full project, run it locally with your own RentCast API key.

## 📌 Project Overview

Housing Finder is a web app I built to help students and interns compare housing options when they are moving for internships. The goal is to make the housing search less overwhelming by putting listings, filters, rankings, visuals, and AI explanations in one place.

Instead of just showing a long list of apartments, the app helps users compare what actually matters: price, commute, lease length, bedrooms, square feet, bathrooms, and amenities.

## ✨ Features

- 📍 Choose an internship or commute area before looking at results
- 🔎 Filter housing by price, commute time, lease term, bedrooms, square feet, baths, and amenities
- 🧠 Drag ranking rules to decide what matters most
- 🏘️ View 4 listings at a time so the page is easier to use
- 📊 Compare listings with a bar graph or line graph
- 🗺️ See listing locations on a map
- 🤖 Get AI explanations that explain tradeoffs between housing options
- 🎯 Reveal a housing style after comparing enough listings
- 💡 Use a smart pick feature to suggest another listing to check

## 🛠️ Tech Stack

- Frontend: TypeScript, React, HTML/CSS
- Backend: Node.js, Express
- APIs: OpenAI API, RentCast API
- Deployment: Vercel
- ML: PyTorch/ML

## ⚙️ How It Works

📍 **Step 1: Pick the commute area**

Users first choose where their internship or commute area is. They can use a preset area or type in a location. The app then uses that location to update the commute estimates and show listings near the area the user is focused on.

🧾 **Step 2: Add housing preferences**

Users can enter preferences like budget, commute time, lease length, bedrooms, square feet, bathrooms, and amenities.

🧠 **Step 3: Rank what matters most**

Users can drag the ranking rules to choose what matters most to them. For example, one user might care most about cheaper rent, while another user might care more about commute or space.

🏠 **Step 4: Compare results**

The app uses real rental listing data from RentCast instead of fake sample listings. The listings are filtered and ranked based on the user's preferences, then shown in a way that is easier to compare.

🤖 **AI explanations**

The AI feature explains tradeoffs between listings. It does not just say the listing a user clicked is good. It compares the selected listing against the ranked options and explains why it may or may not be the best fit.

🎯 **Housing style and smart pick**

The ML feature is used for the housing style and smart pick feature. After the user compares enough listings, the app looks at their behavior and gives a simple housing style with a suggested listing to check next.

## 💻 Local Setup

To run the full project locally, you need your own API keys. My keys are not included in GitHub.

1. 📥 Clone the repository:

```bash
git clone https://github.com/timotle/Intern-Housing-Finder-In-Progress-.git
cd Intern-Housing-Finder-In-Progress-
```

2. 📦 Install the frontend dependencies:

```bash
npm install
```

3. 🧩 Install the backend dependencies:

```bash
cd server
npm install
cd ..
```

4. 🔐 Create a `.env` file in the main project folder and add your keys:

```env
OPENAI_API_KEY=your_openai_key_here
RENTCAST_API_KEY=your_rentcast_key_here
```

The OpenAI key is used for AI explanations and location matching. The RentCast key is used for real rental listings.

For RentCast, create your own RentCast account, sign up for the free plan, go to the API Dashboard, create an API key, and paste it into the `.env` file as `RENTCAST_API_KEY`.

Without a RentCast API key, the app can still open, but fresh real listing search will not work correctly. It may only show cached listing data.

5. 🖥️ Start the backend in one terminal:

```bash
cd server
npm start
```

6. ⚡ Start the frontend in another terminal:

```bash
npm run dev
```

7. 🚀 Open the app:

```text
http://localhost:5173
```

Make sure both the backend and frontend are running at the same time.

## 🚧 What Still Needs Development

- 🔄 Keep refreshing the rental listing data
- 🧭 Improve commute estimates so they are more exact
- 🧠 Keep improving the housing style and smart pick feature
- 🎨 Keep improving the UI and overall user experience
