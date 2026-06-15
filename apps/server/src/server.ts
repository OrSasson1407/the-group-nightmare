import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketGateway } from './gateway/socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Enforce CORS for the React client
app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Basic health check for Docker/CI environments
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Engine Active', timestamp: new Date().toISOString() });
});

// Initialize real-time WebSockets gateway
setupSocketGateway(httpServer, CLIENT_ORIGIN);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(🚀 The Group Nightmare Solver Engine running on port  + PORT);
});
