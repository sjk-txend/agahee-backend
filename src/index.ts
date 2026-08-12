import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';

import { app } from './app.js';
import { connectDB } from './config/db.js';
import { registerSocketHandlers } from './sockets/index.js';

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL, credentials: true } });

registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;

async function start(): Promise<void> {
  await connectDB();
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start();