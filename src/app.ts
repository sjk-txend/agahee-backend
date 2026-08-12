import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Builds and configures the Express app WITHOUT starting a server or
// connecting to a database. This is what makes it testable — supertest
// wraps this directly and spins up its own ephemeral server per test.
export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(notFound);
app.use(errorHandler);