import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppLoading } from '../components/ui/States.jsx';
import { AUTH_STATES } from '../lib/services/authFlow.js';

/**
 * Route guards.
 *
 * GuardedRoute keeps unauthenticated visitors out (remembering where they
 * were heading), and routes incomplete profiles to /welcome. OnboardingRoute
 * is the mirror image: it only lets in signed-in users without a profile.
 */
export function GuardedRoute() {
  const { state, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || state === AUTH_STATES.initialising) {
    return <AppLoading />;
  }

  if (state === AUTH_STATES.signedOut) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  if (state === AUTH_STATES.needsProfile) {
    return <Navigate to="/welcome" replace />;
  }

  return <Outlet />;
}

export function OnboardingRoute() {
  const { state, isLoading } = useAuth();

  if (isLoading || state === AUTH_STATES.initialising) {
    return <AppLoading label="One moment…" />;
  }

  if (state === AUTH_STATES.signedOut) {
    return <Navigate to="/signin" replace />;
  }

  if (state === AUTH_STATES.ready) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

/** Signed-in users shouldn't see the auth screens again. */
export function PublicOnlyRoute() {
  const { state, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || state === AUTH_STATES.initialising) {
    return <AppLoading label="One moment…" />;
  }

  if (state === AUTH_STATES.needsProfile) {
    return <Navigate to="/welcome" replace />;
  }

  if (state === AUTH_STATES.ready) {
    return <Navigate to={location.state?.from?.pathname || '/app'} replace />;
  }

  return <Outlet />;
}
