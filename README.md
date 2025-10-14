# 🎈 BloonGuessr

A GeoGuessr-style game using WindBorne Systems' live weather balloon constellation data combined with Wikipedia/Wikimedia Commons geotagged photos.

## About

This project combines three data sources:
1. **WindBorne Systems API** - Real-time positions of their global weather balloon constellation
2. **Nominatim (OpenStreetMap)** - Free reverse geocoding to convert coordinates to location names
3. **Unsplash API** - Photos of locations worldwide

### Why Unsplash + Reverse Geocoding?

I chose this combination because:
- **Unsplash API** provides beautiful, high-quality photos of locations worldwide
- **Nominatim** (OpenStreetMap) provides free reverse geocoding to convert balloon coordinates → location names
- **Persistent caching** stores photos in JSON file, survives server restarts, auto-refreshes every 24 hours
- Works for **any balloon location** - even remote oceans ("Pacific Ocean", "Atlantic Ocean", etc.)
- Photos are inspiring and educational - showing real places around the world

**How it works**:
1. Balloon coordinates → Generate balloon ID from coordinates
2. Check cache file (`cache/photos.json`) for existing photo
3. If cached and < 24h old → use it (instant!)
4. If expired or missing → Reverse geocode to get location name
5. Search Unsplash for beautiful photos of that location
6. Save to cache file with timestamp for future use

## How It Works

1. Fetches current balloon positions from WindBorne's live API
2. Randomly selects 5 balloons from the constellation
3. For each balloon:
   - Reverse geocodes coordinates to get location name (e.g., "Tokyo", "Pacific Ocean", "Iceland")
   - Searches Unsplash for beautiful photos of that location
   - Caches the photo for instant reuse
4. Players see the photo of the location where the balloon is
5. Players click on the map to guess the balloon's exact position
6. Score is calculated GeoGuessr-style (5000 points = perfect, exponential decay with distance)
7. 5 rounds total, with cumulative scoring

**Key Feature**: Works for ANY balloon location globally - cities, countries, oceans, deserts - all have photos!

## Tech Stack

**Backend:**
- Node.js + Express
- TypeScript
- Axios for API requests

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Leaflet.js for interactive maps
- Responsive design

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
