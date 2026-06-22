import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import { env } from './config/env';
import { errorHandler } from './middleware';

import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import groupsRoutes from './routes/groups.routes';
import profileRoutes from './routes/profile.routes';
import endpointsRoutes from './routes/endpoints.routes';
import dashboardRoutes from './routes/dashboard.routes';
import dynamicRoutes from './routes/dynamic.routes';
import settingsRoutes from './routes/settings.routes';
import { apiRateLimitMiddleware } from './middleware/rateLimit';

export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  const corsOrigins = env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

  app.use(cors({
    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0] || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  }));

  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(apiRateLimitMiddleware);

  const csrfProtection = csrf({ cookie: { httpOnly: true, secure: env.nodeEnv === 'production' } });

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ success: true, csrfToken: req.csrfToken() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/endpoints', endpointsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use('/api', dynamicRoutes);

  app.use(errorHandler);

  return app;
}
