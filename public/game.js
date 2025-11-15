// Game state
let gameState = {
  rounds: [],
  currentRound: 0,
  totalScore: 0,
  guessMarker: null,
  currentGuess: null
};

let map = null;
let resultMap = null;

// API base URL (change for production)
const API_BASE = window.location.origin;

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

function showError(message) {
  document.getElementById('error-message').textContent = message;
  showScreen('error-screen');
}

// Initialize the game (load backend data)
async function initGame() {
  showScreen('loading');
  
  try {
    const response = await fetch(`${API_BASE}/api/game/start`);
    
    if (!response.ok) {
      throw new Error('Failed to load game data');
    }
    
    const data = await response.json();
    
    if (!data.rounds || data.rounds.length === 0) {
      throw new Error('No game rounds available. The balloons might be in remote areas without photos.');
    }
    
    gameState.rounds = data.rounds;
    gameState.currentRound = 0;
    gameState.totalScore = 0;
    
    // Show rules screen after loading
    showScreen('rules-screen');
  } catch (error) {
    console.error('Error initializing game:', error);
    showError(error.message);
  }
}

// Initialize the guess map
function initMap() {
  if (map) {
    map.remove();
  }
  
  map = L.map('map', {
    preferCanvas: true,
    zoomControl: true,
    fadeAnimation: false, // Disable fade for faster rendering
    zoomAnimation: true,
    worldCopyJump: true, // Jump to real position when crossing date line
    maxBounds: [[-90, -180], [90, 180]], // Limit to one world copy
    maxBoundsViscosity: 0.5 // Allow some drag but bounce back
  }).setView([20, 0], 2);
  
  // Use OpenStreetMap tiles (most reliable)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 1,
    keepBuffer: 2, // Keep tiles in buffer for smoother panning
    updateWhenIdle: false, // Update tiles while panning
    updateWhenZooming: false,
    crossOrigin: true
  }).addTo(map);
  
  // Force map to invalidate size after a short delay
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
  
  // Add click handler for guessing
  map.on('click', function(e) {
    if (gameState.guessMarker) {
      map.removeLayer(gameState.guessMarker);
    }
    
    gameState.guessMarker = L.marker(e.latlng, {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);
    
    gameState.currentGuess = e.latlng;
    document.getElementById('guess-btn').disabled = false;
  });
}

// Start a round
function startRound() {
  const round = gameState.rounds[gameState.currentRound];
  
  document.getElementById('current-round').textContent = gameState.currentRound + 1;
  document.getElementById('current-score').textContent = gameState.totalScore;
  
  // Set photo
  const photoEl = document.getElementById('round-photo');
  photoEl.src = round.photoUrl;
  photoEl.classList.remove('zoomed');
  
  // Add click to zoom functionality
  photoEl.onclick = function() {
    this.classList.toggle('zoomed');
  };
  
  // Set attribution
  const attribution = round.photoAttribution || 'Photo from Unsplash';
  document.getElementById('photo-attribution').textContent = attribution;
  
  // Initialize map
  initMap();
  
  // Reset guess
  gameState.currentGuess = null;
  document.getElementById('guess-btn').disabled = true;
  
  showScreen('game-screen');
}

// Submit guess
async function submitGuess() {
  if (!gameState.currentGuess) return;
  
  const round = gameState.rounds[gameState.currentRound];
  
  try {
    const response = await fetch(`${API_BASE}/api/game/guess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actualLat: round.balloonLat,
        actualLon: round.balloonLon,
        guessLat: gameState.currentGuess.lat,
        guessLon: gameState.currentGuess.lng
      })
    });
    
    const result = await response.json();
    
    // Update score
    gameState.totalScore += result.score;
    
    // Show result
    showResult(result.score, round.balloonLat, round.balloonLon, result.weather.temperature);
  } catch (error) {
    console.error('Error submitting guess:', error);
    showError('Failed to submit guess. Please try again.');
  }
}

// Show result of the round
function showResult(score, actualLat, actualLon, temperature) {
  const round = gameState.rounds[gameState.currentRound];
  
  document.getElementById('round-score').textContent = score;
  
  // Calculate distance
  const distance = calculateDistance(
    gameState.currentGuess.lat,
    gameState.currentGuess.lng,
    actualLat,
    actualLon
  );
  
  document.getElementById('distance').textContent = distance.toFixed(0);
  
  // Display location information
  document.getElementById('result-location-name').textContent = round.locationName || 'Unknown';
  document.getElementById('result-balloon-coords').textContent = 
    `${actualLat.toFixed(2)}°, ${actualLon.toFixed(2)}°`;
  document.getElementById('result-balloon-id').textContent = round.balloonId || 'Unknown';
  document.getElementById('result-balloon-temp').textContent = temperature || 'Unknown';
  
  // Create result map
  if (resultMap) {
    resultMap.remove();
  }
  
  resultMap = L.map('result-map', {
    preferCanvas: true,
    zoomControl: true,
    fadeAnimation: false
  }).setView([actualLat, actualLon], 4);
  
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 1,
    keepBuffer: 2,
    crossOrigin: true
  }).addTo(resultMap);
  
  setTimeout(() => {
    resultMap.invalidateSize();
  }, 100);
  
  // Add actual balloon location marker (green)
  L.marker([actualLat, actualLon], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(resultMap).bindPopup('🎈 Actual balloon location');
  
  // Add guess marker (red)
  L.marker([gameState.currentGuess.lat, gameState.currentGuess.lng], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(resultMap).bindPopup('Your guess');
  
  // Draw line between guess and actual balloon location
  L.polyline([
    [actualLat, actualLon],
    [gameState.currentGuess.lat, gameState.currentGuess.lng]
  ], {
    color: 'red',
    weight: 3,
    opacity: 0.7,
    dashArray: '10, 10'
  }).addTo(resultMap);
  
  // Normalize guess longitude for proper bounds calculation
  const guessLon = normalizeLongitude(gameState.currentGuess.lng);
  const actualLonNorm = normalizeLongitude(actualLon);
  
  // Check if we need to handle wrapping around the date line
  let lon1 = actualLonNorm;
  let lon2 = guessLon;
  
  // If the difference is > 180°, we're wrapping around, so adjust one of them
  if (Math.abs(lon2 - lon1) > 180) {
    if (lon2 < lon1) {
      lon2 += 360;
    } else {
      lon1 += 360;
    }
  }
  
  // Fit bounds to show both markers
  const bounds = L.latLngBounds([
    [actualLat, lon1],
    [gameState.currentGuess.lat, lon2]
  ]);
  
  // Zoom out to show full view
  resultMap.fitBounds(bounds, { 
    padding: [100, 100],
    maxZoom: 3 // Zoom out more to see full context
  });
  
  showScreen('result-screen');
}

// Next round or finish game
function nextRound() {
  gameState.currentRound++;
  
  if (gameState.currentRound >= gameState.rounds.length) {
    showFinalScreen();
  } else {
    startRound();
  }
}

// Show final screen
function showFinalScreen() {
  document.getElementById('final-score').textContent = gameState.totalScore;
  
  // Calculate rating
  let rating = '';
  if (gameState.totalScore >= 24000) rating = '🏆 Master Navigator!';
  else if (gameState.totalScore >= 20000) rating = '🌟 Excellent!';
  else if (gameState.totalScore >= 15000) rating = '👍 Great Job!';
  else if (gameState.totalScore >= 10000) rating = '👌 Not Bad!';
  else if (gameState.totalScore >= 5000) rating = '🤔 Keep Practicing!';
  else rating = '😅 Better Luck Next Time!';
  
  document.getElementById('final-rating').textContent = rating;
  
  showScreen('final-screen');
}

// Normalize longitude to -180 to 180 range
function normalizeLongitude(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

// Calculate distance between two points (Haversine formula)
// Accounts for earth wrapping - finds shortest distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Normalize longitudes to -180 to 180 range
  lon1 = normalizeLongitude(lon1);
  lon2 = normalizeLongitude(lon2);
  
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  
  // Calculate longitude difference, taking shortest path around earth
  let dLon = lon2 - lon1;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  dLon = toRad(dLon);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Event listeners
document.getElementById('landing-btn').addEventListener('click', initGame);
document.getElementById('start-game-btn').addEventListener('click', startRound);
document.getElementById('guess-btn').addEventListener('click', submitGuess);
document.getElementById('next-round-btn').addEventListener('click', nextRound);
document.getElementById('play-again-btn').addEventListener('click', () => {
  showScreen('landing-screen');
});
document.getElementById('retry-btn').addEventListener('click', initGame);

