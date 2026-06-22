import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { getClientIp } from '../utils';

interface RateEntry {
  count: number;
  resetAt: number;
}

const apiRequestCounts = new Map<string, RateEntry>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function apiRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { rateLimitMax, rateLimitWindowMs } = settingsService.getCached();
  const key = getClientIp(req);
  const now = Date.now();

  let entry = apiRequestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + rateLimitWindowMs };
    apiRequestCounts.set(key, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', String(rateLimitMax));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rateLimitMax - entry.count)));

  if (entry.count > rateLimitMax) {
    res.status(429).json({ success: false, error: 'Too many requests, please try again later' });
    return;
  }

  next();
}

export function checkAuthLockout(req: Request, res: Response, next: NextFunction): void {
  const key = getClientIp(req);
  const entry = loginAttempts.get(key);

  if (entry && Date.now() < entry.lockedUntil) {
    const retryAfter = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      success: false,
      error: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    });
    return;
  }

  if (entry && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(key);
  }

  next();
}

export function recordFailedLogin(ip: string): void {
  const { authMaxAttempts, authLockoutDurationMs } = settingsService.getCached();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count++;

  if (entry.count >= authMaxAttempts) {
    entry.lockedUntil = Date.now() + authLockoutDurationMs;
  }

  loginAttempts.set(ip, entry);
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export function getLoginAttemptInfo(ip: string): { count: number; locked: boolean; lockedUntil?: number } {
  const entry = loginAttempts.get(ip);
  if (!entry) return { count: 0, locked: false };
  return {
    count: entry.count,
    locked: Date.now() < entry.lockedUntil,
    lockedUntil: entry.lockedUntil > Date.now() ? entry.lockedUntil : undefined,
  };
}
