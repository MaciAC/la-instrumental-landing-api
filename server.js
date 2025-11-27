const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { validate: validateEmail } = require('email-validator');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 1337;
const HOST = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = CORS_ORIGIN.split(',').map(o => o.trim());
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Length'],
  credentials: false,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000, 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100, 10),
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => NODE_ENV === 'development',
});

app.use('/v1/', limiter);
app.use(express.json({ limit: '1mb' }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (username !== 'admin' || !ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log(username,password);
    const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function ensureAdhesionsTable() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS adhesions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          comment TEXT,
          newsletter BOOLEAN NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Adhesions table ready');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error ensuring adhesions table:', err);
  }
}

app.post('/v1/adhesions', async (req, res) => {
  try {
    const { name, email, comment, receiveInfo } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    if (name.trim().length > 255) {
      return res.status(400).json({ error: 'Name must be 255 characters or less' });
    }

    if (!validateEmail(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (email.trim().length > 255) {
      return res.status(400).json({ error: 'Email must be 255 characters or less' });
    }

    if (comment && typeof comment !== 'string') {
      return res.status(400).json({ error: 'Comment must be a string' });
    }

    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'Comment must be 1000 characters or less' });
    }
    if (typeof receiveInfo !== 'boolean') {
      return res.status(400).json({ error: 'receiveInfo must be a boolean value' });
    }
    

    const sanitizedName = name.trim();
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedComment = comment ? comment.trim() : null;
    const sanitizedNewsletter = receiveInfo;

    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO adhesions (name, email, comment, newsletter) VALUES ($1, $2, $3, $4) RETURNING id, name, email, comment, newsletter, created_at',
        [sanitizedName, sanitizedEmail, sanitizedComment, sanitizedNewsletter]
      );
      res.status(201).json({ data: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error saving adhesion:', err);
    res.status(500).json({ error: 'Failed to save adhesion' });
  }
});

app.get('/v1/adhesions', authenticateAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      const countResult = await client.query('SELECT COUNT(*) as total FROM adhesions');
      const total = parseInt(countResult.rows[0].total, 10);

      const result = await client.query(
        'SELECT id, name, email, comment, newsletter, created_at FROM adhesions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      const totalPages = Math.ceil(total / limit);
      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching adhesions:', err);
    res.status(500).json({ error: 'Failed to fetch adhesions' });
  }
});

app.get('/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await ensureAdhesionsTable();
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
