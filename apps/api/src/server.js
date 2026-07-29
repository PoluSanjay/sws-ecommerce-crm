import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import adminCatalogRouter from './routes/admin-catalog.js';
import adminCoreRouter from './routes/admin-core.js';
import authRouter from './routes/auth.js';
import catalogRouter from './routes/catalog.js';
import customerRouter from './routes/customer.js';
import technicianRouter from './routes/technician.js';
import { ensureCoreRoles, socketUser } from './security.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
const app = express();
const server = http.createServer(app);
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(value => value.trim());
const io = new Server(server, { cors: { origin: clientOrigins, credentials: true } });
app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 400, standardHeaders: true, legacyHeaders: false }));
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', immutable: true }));

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.session = await socketUser(token);
    next();
  } catch { next(new Error('Invalid session')); }
});
io.on('connection', socket => {
  socket.join('user:' + socket.session.user._id.toString());
  socket.session.roles.forEach(role => socket.join(role));
});

app.get('/api/health', (req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/auth', authRouter);
app.use('/api', catalogRouter);
app.use('/api', customerRouter);
app.use('/api/admin', adminCatalogRouter);
app.use('/api/admin', adminCoreRouter);
app.use('/api/technician', technicianRouter);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', issues: error.issues });
  if (error.code === 11000) return res.status(409).json({ error: 'That value is already in use' });
  if (error.name === 'MulterError') return res.status(400).json({ error: error.message });
  if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid record id' });
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Unexpected server error' });
});

const port = Number(process.env.PORT || 4000);
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sujala_water_solutions')
  .then(async () => {
    await ensureCoreRoles();
    server.listen(port, () => console.log('SWS API listening on port ' + port));
  })
  .catch(error => { console.error('MongoDB connection failed', error); process.exit(1); });
