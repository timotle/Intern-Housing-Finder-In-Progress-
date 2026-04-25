# Intern Housing Finder - DEADLINE For Updates is 4/28 

**Overview**  
This is a full-stack web application I built to help students and interns find and compare housing options when relocating for internships. Instead of searching across multiple websites, users can filter listings and get AI-generated recommendations based on their preferences.

**Features**  
- Filter housing by price, commute distance, lease term, and number of occupants  
- Compare multiple listings side by side  
- Generate AI-powered recommendations for best-fit housing  
- Provide pros and cons for each listing  
- Explain tradeoffs between different housing options  
- Simple navigation and clean user interface
- Provide a match score based on the users preferences
  
**Languages/Tools/Frameworks**  
- TypeScript  
- React  
- Node.js  
- Express  
- HTML/CSS  
- OpenAI API
- Pytorch(IN PROGRESS)

**How It Works**  
Users input their housing preferences such as budget, commute distance, and lease duration. The application filters available listings based on these constraints. An AI component analyzes the filtered results and generates structured insights, including tradeoffs and personalized recommendations, a resulting match score based on the preferences, helping users understand which option best fits their needs.

**What Still Needs Development**
- sample listings need to be replaced by using GOOGLE MAP API 
- UI needs to be worked on
- Pytorch/ML needs to be implemented(experimental)

**Setup Instructions**  
To run this project locally, follow these steps:

1. Clone the repository  
   Open a terminal and run:  
   git clone https://github.com/timotle/Intern-Housing-Finder-In-Progress.git  
   cd Intern-Housing-Finder-In-Progress  

2. Install dependencies  

   Frontend:  
   cd client  
   npm install  

   Backend:  
   cd ../server  
   npm install  

3. Set up environment variables  

   This project uses the OpenAI API for AI recommendations, but the API key is not included for security reasons.  

   Create a `.env` file inside the `/server` folder and add:  
   OPENAI_API_KEY=your_api_key_here  

   -To use the AI features, you will need your own ChatGPT/OpenAI account. From there, go to your settings, generate an API key,
   and copy and paste it into the `.env` file.  

   -API usage may require billing.  

   -Once added, the recommendation system will work as expected. Without it, the filtering and comparison features will still run normally.  

5. Run the backend  
   cd server  
   npm start  

6. Run the frontend (open a new terminal)  
   cd client  
   npm start  

7. Open the app  
   Go to http://localhost:3000  

**Notes**  
- Make sure both frontend and backend are running at the same time  
