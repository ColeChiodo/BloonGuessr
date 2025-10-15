import express from 'express';
import cors from 'cors';
import path from 'path';
import { balloonRouter } from './routes/balloon';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', balloonRouter);

// Start server
app.listen(PORT, () => {
  console.log(`🎈 Balloon Photo Guesser server running on http://localhost:${PORT}`);
  console.log(`This project is made by Cole Chiodo.`)
});

