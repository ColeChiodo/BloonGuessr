import { Router } from 'express';
import { fetchBalloonData, createGameRound, calculateScore, getWeatherData } from '../services/gameService';
import { get } from 'http';

export const balloonRouter = Router();

// Start a new game - returns 5 random balloons with photos
balloonRouter.get('/game/start', async (req, res) => {
  try {
    const rounds = await createGameRound(5);
    res.json({ rounds });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Submit a guess and get the score
balloonRouter.post('/game/guess', async (req, res) => {
  try {
    const { actualLat, actualLon, guessLat, guessLon } = req.body;
    
    if (!actualLat || !actualLon || !guessLat || !guessLon) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }

    const score = calculateScore(actualLat, actualLon, guessLat, guessLon);
    const weather = await getWeatherData(actualLat, actualLon);
    
    res.json({ 
      score,
      actualLocation: { lat: actualLat, lon: actualLon },
      weather
    });
  } catch (error) {
    console.error('Error calculating score:', error);
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

