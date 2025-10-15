# 🎈 BloonGuessr

A GeoGuessr-style game using **WindBorne Systems** live weather balloon constellation data with **Nominatim** for reverse geocoding and **Unsplash** for photos.

I built this project as part of the WindBorne Junior Web Developer Applicaiton Process. I decided to turn it into a fun game.

## About

This project combines three data sources:
1. **WindBorne Systems API** - Real-time positions of their global weather balloon constellation
2. **Nominatim (OpenStreetMap)** - Free reverse geocoding to convert coordinates to location names
3. **Unsplash API** - Photos of locations worldwide

## How It Works

1. Fetches current balloon positions from WindBorne's live API
2. Randomly selects 5 balloons from the constellation
3. For each balloon:
   - Reverse geocodes coordinates to get location name (e.g., "Tokyo", "Pacific Ocean", "Iceland"). If no location, skip.
   - Searches Unsplash for photo of that location. If no photo, skip
   - Caches the photo for instant reuse
4. Players see the photo of the location where the balloon is
5. Players click on the map to guess the balloon's exact position
6. Score is calculated GeoGuessr-style (5000 points = perfect, exponential decay with distance)
7. 5 rounds total, with cumulative scoring

## Tech Stack

**Backend:**
- Node.js + Express
- TypeScript

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Leaflet.js for interactive maps

## Setup

1. **Get Unsplash API Key** (free):
   - Go to https://unsplash.com/developers
   - Register and create an app
   - Copy your Access Key

2. **Create `.env` file**:
```bash
PORT=3000
UNSPLASH_ACCESS_KEY=your_access_key_here
```

3. **Install dependencies**:
```bash
npm install
```

4. **Build TypeScript**:
```bash
npm run build
```

5. **Start server**:
```bash
npm start
```

6. **Open your browser** to `http://localhost:3000`
