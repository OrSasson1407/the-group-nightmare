import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketGateway } from './gateway/socket.js';
import { apiRouter } from './api/routes.js';
import { supabase } from './db/supabase.js';

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

  // Fix: health endpoint checks real DB connectivity
  app.get('/health', async (req, res) => {
    let dbStatus = 'ok';
    try {
      const { error } = await supabase.from('rooms').select('id').limit(1);
      if (error) dbStatus = 'degraded';
    } catch {
      dbStatus = 'unreachable';
    }
    const status = dbStatus === 'ok' ? 200 : 503;
    res.status(status).json({
      status: dbStatus === 'ok' ? 'Engine Active' : 'Degraded',
      db: dbStatus,
      timestamp: new Date().toISOString()
    });
  });

  setupSocketGateway(httpServer, CLIENT_ORIGIN);

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log('The Group Nightmare Solver Engine running on port ' + PORT);
  });
} catch (err) {
  console.error('=== FATAL STARTUP ERROR ===', err);
  process.exit(1);
}
