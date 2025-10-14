import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

dotenv.config();

interface BalloonData {
  lat: number;
  lon: number;
  alt?: number;
  id: string; // Balloon index from API (0, 1, 2, etc.)
}

interface GameRound {
  balloonLat: number;
  balloonLon: number;
  balloonId: string;
  photoUrl: string;
  photoAttribution?: string;
  locationName: string;
  photoLat: number;
  photoLon: number;
  distanceKm: number; // Distance from photo to balloon
}

interface CachedPhoto {
  balloonId: string;
  photoUrl: string;
  photoAttribution: string;
  locationName: string;
  timestamp: number; // Unix timestamp in milliseconds
}

interface PhotoCache {
  [balloonId: string]: CachedPhoto;
}

const CACHE_FILE = path.join(__dirname, '../../cache/photos.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Ensure cache directory exists
function ensureCacheDir() {
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

// Load cache from file
function loadCache(): PhotoCache {
  try {
    ensureCacheDir();
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return {};
}

// Save cache to file
function saveCache(cache: PhotoCache) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// Balloon ID is now passed from the API (0, 1, 2, etc.)

// Check if cached photo is still valid (less than 24 hours old)
function isCacheValid(cached: CachedPhoto): boolean {
  const now = Date.now();
  return (now - cached.timestamp) < CACHE_DURATION;
}

// Fetch balloon data from WindBorne API
export async function fetchBalloonData(): Promise<BalloonData[]> {
  // Try fetching from 00.json through 23.json (24 hours of data)
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = hour.toString().padStart(2, '0');
    const url = `https://a.windbornesystems.com/treasure/${hourStr}.json`;
    
    try {
      console.log(`Attempting to fetch balloon data from ${hourStr}.json...`);
      const response = await axios.get(url);
      const data = response.data;
      
      // The API format is: { "0": [lat, lon, alt], "1": [lat, lon, alt], ... }
      // or it might be an array: [[lat, lon, alt], [lat, lon, alt], ...]
      let balloons: BalloonData[] = [];
      
      if (typeof data === 'object' && !Array.isArray(data)) {
        // Object with numbered keys
        for (const key in data) {
          const item = data[key];
          const balloon = extractCoordinates(item, key);
          if (balloon) {
            balloons.push(balloon);
          }
        }
      } else if (Array.isArray(data)) {
        // Array format
        balloons = data.map((item, index) => extractCoordinates(item, index.toString())).filter(Boolean) as BalloonData[];
      }
      
      if (balloons.length > 0) {
        console.log(`✓ Successfully fetched ${balloons.length} balloons from ${hourStr}.json`);
        return balloons;
      } else {
        console.log(`✗ No valid balloon data in ${hourStr}.json, trying next...`);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`✗ ${hourStr}.json not found (404), trying next...`);
      } else {
        console.log(`✗ Error fetching ${hourStr}.json:`, error.message);
      }
      // Continue to next hour
    }
  }
  
  // If we've exhausted all hours (00-23), return empty array
  console.error('Failed to fetch balloon data from any hour (00-23)');
  return [];
}

// Extract coordinates from various possible formats
function extractCoordinates(item: any, id: string): BalloonData | null {
  if (!item) return null;
  
  // Handle array format: [lat, lon, alt]
  if (Array.isArray(item)) {
    const lat = item[0];
    const lon = item[1];
    const alt = item[2];
    
    if (typeof lat === 'number' && typeof lon === 'number' && 
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        id,
        lat,
        lon,
        alt: typeof alt === 'number' ? alt : undefined
      };
    }
  }
  
  // Handle object format (fallback)
  if (typeof item === 'object') {
    const lat = item.lat || item.latitude || item.Lat || item.Latitude;
    const lon = item.lon || item.lng || item.longitude || item.Lon || item.Longitude;
    
    if (typeof lat === 'number' && typeof lon === 'number' && 
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        id: item.id || item.ID || item.balloon_id || id,
        lat,
        lon,
        alt: item.alt || item.altitude || item.Alt || item.Altitude
      };
    }
  }
  
  return null;
}

// Reverse geocode to get location name from coordinates (using Nominatim - free!)
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json',
        zoom: 5, // City/region level
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'BalloonPhotoGuesser/1.0'
      },
      timeout: 5000
    });
    
    const address = response.data?.address;
    if (!address) return null;
    
    // Try to get a good location name
    const locationName = 
      address.city || 
      address.town || 
      address.state || 
      address.country || 
      address.ocean ||
      address.sea ||
      'Unknown Location';
    
    return locationName;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Fetch photo from Unsplash for a location
async function fetchUnsplashPhoto(locationName: string, lat: number, lon: number): Promise<{ url: string; attribution: string } | null> {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      console.error('UNSPLASH_ACCESS_KEY not set in .env');
      return null;
    }
    
    // Search Unsplash for photos of this location
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: locationName,
        per_page: 10,
        orientation: 'landscape'
      },
      headers: {
        'Authorization': `Client-ID ${accessKey}`
      },
      timeout: 5000
    });
    
    const results = response.data?.results;
    if (!results || results.length === 0) {
      console.log(`No Unsplash photos found for "${locationName}"`);
      return null;
    }
    
    // Pick a random photo from results
    const photo = results[Math.floor(Math.random() * results.length)];
    
    return {
      url: photo.urls.regular, // Good quality, not too large
      attribution: `Photo by ${photo.user.name} on Unsplash`
    };
  } catch (error) {
    console.error('Unsplash API error:', error);
    return null;
  }
}

// Get or fetch photo for a balloon location (with file-based caching)
async function getPhotoForLocation(balloonId: string, lat: number, lon: number): Promise<{ url: string; attribution: string; locationName: string; lat: number; lon: number; distance: number } | null> {
  const cache = loadCache();
  
  // Check if we have a cached photo
  const cached = cache[balloonId];
  
  if (cached) {
    // Check if cache is still valid (less than 24 hours old)
    if (isCacheValid(cached)) {
      console.log(`Using cached photo for ${cached.locationName} (cached ${Math.round((Date.now() - cached.timestamp) / 3600000)}h ago)`);
      return {
        url: cached.photoUrl,
        attribution: cached.photoAttribution,
        locationName: cached.locationName,
        lat: lat,
        lon: lon,
        distance: 0
      };
    } else {
      console.log(`Cache expired for ${cached.locationName} (${Math.round((Date.now() - cached.timestamp) / 3600000)}h old), fetching new photo...`);
    }
  }
  
  // Not in cache or cache expired - fetch new photo
  console.log(`Fetching photo for balloon ${balloonId} at (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
  
  // Step 1: Reverse geocode to get location name
  const locationName = await reverseGeocode(lat, lon);
  if (!locationName) {
    console.log('Could not determine location name');
    return null;
  }
  
  console.log(`Location name: ${locationName}`);
  
  // Step 2: Fetch Unsplash photo for that location
  const photo = await fetchUnsplashPhoto(locationName, lat, lon);
  if (!photo) {
    return null;
  }
  
  // Step 3: Save to cache file
  const cachedPhoto: CachedPhoto = {
    balloonId,
    photoUrl: photo.url,
    photoAttribution: photo.attribution,
    locationName,
    timestamp: Date.now()
  };
  
  cache[balloonId] = cachedPhoto;
  saveCache(cache);
  console.log(`Saved photo for ${locationName} to cache`);
  
  return {
    url: photo.url,
    attribution: photo.attribution,
    locationName: locationName,
    lat: lat,
    lon: lon,
    distance: 0 // Photo represents the location
  };
}

// Cryptographically secure random integer between 0 (inclusive) and max (exclusive)
function secureRandomInt(max: number): number {
  const range = max;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const bytes = randomBytes(bytesNeeded);
  let randomValue = 0;
  for (let i = 0; i < bytesNeeded; i++) {
    randomValue = randomValue * 256 + bytes[i];
  }
  return Math.floor((randomValue / maxValue) * range);
}

// Fisher-Yates shuffle algorithm for truly random ordering
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Create game rounds with photos
export async function createGameRound(numRounds: number): Promise<GameRound[]> {
  const balloons = await fetchBalloonData();
  
  if (balloons.length === 0) {
    throw new Error('No balloon data available. The WindBorne API might be down.');
  }
  
  console.log(`Creating ${numRounds} game rounds from ${balloons.length} balloons...`);
  
  // Shuffle the entire balloon array for true randomness
  const shuffledBalloons = shuffleArray(balloons);
  
  // Take the first numRounds balloons from the shuffled array
  const selectedBalloons = shuffledBalloons.slice(0, Math.min(numRounds * 3, shuffledBalloons.length)); // Get extra in case some fail
  
  console.log(`Selected ${selectedBalloons.length} random balloons (shuffled), finding nearest photos...`);
  
  const rounds: GameRound[] = [];
  
  for (let i = 0; i < selectedBalloons.length && rounds.length < numRounds; i++) {
    const balloon = selectedBalloons[i];
    console.log(`Attempt ${i+1}: Finding photo for balloon ${balloon.id} at (${balloon.lat.toFixed(2)}, ${balloon.lon.toFixed(2)})`);
    
    const photo = await getPhotoForLocation(balloon.id, balloon.lat, balloon.lon);
    
    if (photo) {
      rounds.push({
        balloonId: balloon.id,
        balloonLat: balloon.lat,
        balloonLon: balloon.lon,
        photoUrl: photo.url,
        photoAttribution: photo.attribution,
        locationName: photo.locationName,
        photoLat: photo.lat,
        photoLon: photo.lon,
        distanceKm: Math.round(photo.distance)
      });
      console.log(`✓ Round ${rounds.length}/${numRounds} created`);
    } else {
      console.log(`✗ Could not find photo for this balloon, skipping...`);
    }
  }
  
  if (rounds.length === 0) {
    throw new Error('Could not find any photos for the selected balloons. Please try again!');
  }
  
  console.log(`Successfully created ${rounds.length} rounds!`);
  return rounds;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Calculate score based on distance (GeoGuessr style)
export function calculateScore(actualLat: number, actualLon: number, guessLat: number, guessLon: number): number {
  const distance = calculateDistance(actualLat, actualLon, guessLat, guessLon);
  
  // Very forgiving scoring:
  // 5000 points for guesses within 500km (photos represent general regions)
  // Exponential decay after that
  // ~1000 points at 1500km
  // ~200 points at 3000km
  // 0 points at ~8000km+ away
  
  const maxScore = 5000;
  const perfectRadius = 500; // Full points within 500km
  
  if (distance <= perfectRadius) {
    return maxScore;
  }
  
  // Adjusted distance for scoring (subtract the perfect radius)
  const adjustedDistance = distance - perfectRadius;
  
  // Very forgiving exponential decay (very slow curve)
  const score = Math.round(maxScore * Math.exp(-adjustedDistance / 2500));
  
  return Math.max(0, score);
}

