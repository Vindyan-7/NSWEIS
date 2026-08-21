import { defineMiddleware } from 'astro:middleware';
import { getAuthSession } from './lib/auth/session';
import { getDashboardForRole, isRouteAllowedForRole } from './lib/permissions/roles';

const PUBLIC_ROUTES = ['/', '/login', '/privacy'];

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = new URL(context.request.url).pathname;

  // Retrieve user session & profile
  const { user, profile } = await getAuthSession(context);
  context.locals.user = user;
  context.locals.profile = profile;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Unauthenticated user attempting to access protected route
  if (!user && !isPublicRoute) {
    return context.redirect('/login');
  }

  // Authenticated user on login page redirect to role dashboard
  if (user && pathname === '/login') {
    const role = profile?.role || 'student';
    return context.redirect(getDashboardForRole(role));
  }

  // Authenticated user attempting to access route disallowed for their role
  if (user && !isPublicRoute) {
    const role = profile?.role || 'student';
    if (!isRouteAllowedForRole(pathname, role)) {
      return context.redirect(getDashboardForRole(role));
    }
  }

  return next();
});
