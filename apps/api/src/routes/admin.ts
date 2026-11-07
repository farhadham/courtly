import { Router } from 'express';

/**
 * Mount point for the admin routes. The router is intentionally empty until
 * the court-management phase; the mount exists now so authentication and role
 * enforcement are wired in exactly one place.
 */
export function createAdminRouter(): Router {
  return Router();
}
