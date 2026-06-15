import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketGateway } from './gateway/socket.js';
import { apiRouter } from './api/routes.js';

dotenv.config();

try {
  const app = express();
  const httpServer = createServer(app);

  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  app.use(cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));
  app.use(express.json());

  app.use('/api', apiRouter);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Engine Active', timestamp: new Date().toISOString() });
  });

  setupSocketGateway(httpServer, CLIENT_ORIGIN);

  const PORT = process.env.PORT || 4000;

  httpServer.listen(PORT, () => {
    console.log('🚀 The Group Nightmare Solver Engine running on port ' + PORT);
  });
} catch (err) {
  console.error('=== FATAL STARTUP ERROR ===');
  console.error(err);
  if (err instanceof Error) {
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
  } else {
    console.error('Thrown non-error object:', JSON.stringify(err, null, 2));
  }
  process.exit(1);
}