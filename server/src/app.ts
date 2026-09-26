import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorMiddleware.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import recurringRoutes from './routes/recurringRoutes.js';
import emailAccountRoutes from './routes/emailAccountRoutes.js';
import detectedTransactionRoutes from './routes/detectedTransactionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

export function createApp(): Express {
  const app = express();

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Permit frontend dev loading
    crossOriginEmbedderPolicy: false,
  }));

  // CORS Configuration
  app.use(cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Logging & Body Parsers
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(':date[iso] :method :url :status :response-time ms - :res[content-length]'));
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Global rate limiter on API
  app.use('/api', apiLimiter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: 'SpendWise API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API v1 Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/categories', categoryRoutes);
  app.use('/api/v1/budgets', budgetRoutes);
  app.use('/api/v1/recurring', recurringRoutes);
  app.use('/api/v1/email-accounts', emailAccountRoutes);
  app.use('/api/v1/detected-transactions', detectedTransactionRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/notifications', notificationRoutes);

  // In production, serve the built Vite SPA frontend if available
  const clientDistPaths = [
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ];
  const distDir = clientDistPaths.find((p) => fs.existsSync(p));

  if (distDir) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // 404 handler for unmatched API routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Endpoint ${req.originalUrl} not found`,
      code: 'ROUTE_NOT_FOUND',
    });
  });

  // Centralized Error Middleware
  app.use(errorHandler);

  return app;
}
