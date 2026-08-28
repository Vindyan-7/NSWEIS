import { defineMiddleware } from 'astro:middleware';
import { getAuthSession } from './lib/auth/session';
import { getDashboardForRole, isRouteAllowedForRole } from './lib/permissions/roles';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/student/signup',
  '/privacy',
  '/privacy-policy',
  '/no-access',
  '/logout',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = new URL(context.request.url).pathname;

  const { user, profile } = await getAuthSession(context);
  context.locals.user = user;
  context.locals.profile = profile;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!user && !isPublicRoute) {
    return context.redirect('/login');
  }

  // SECURITY (AUDIT.md C1b): a signed-in user with no profile row has NO role.
  // We no longer fall back to 'student' — an unprovisioned account is shown a
  // dead end rather than being guessed into a tier.
  if (user && !profile && !isPublicRoute) {
    return context.redirect('/no-access');
  }

  if (user && pathname === '/login') {
    return context.redirect(getDashboardForRole(profile?.role));
  }

  if (user && profile && !isPublicRoute) {
    if (!isRouteAllowedForRole(pathname, profile.role)) {
      return context.redirect(getDashboardForRole(profile.role));
    }
  }

  return next();
});
