import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLoading } from '../components/ui/States.jsx';
import { GuardedRoute, OnboardingRoute, PublicOnlyRoute } from './ProtectedRoutes.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { LandingPage } from '../pages/LandingPage.jsx';
import { SignInPage } from '../pages/SignInPage.jsx';
import { SignUpPage } from '../pages/SignUpPage.jsx';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx';
import { WelcomePage } from '../pages/WelcomePage.jsx';

// Heavier app surfaces are split into their own chunks.
// ChatWorkspace exports a named component; adapt it for React.lazy.
const ChatWorkspace = lazy(() =>
  import('../pages/ChatWorkspace.jsx').then((module) => ({ default: module.ChatWorkspace })),
);
const SettingsPage = lazy(() => import('../pages/SettingsPage.jsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage.jsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));

/** Route table for the whole product. */
export function AppRoutes() {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<OnboardingRoute />}>
          <Route path="/welcome" element={<WelcomePage />} />
        </Route>

        <Route element={<GuardedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<ChatWorkspace />} />
            <Route path="c/:conversationId" element={<ChatWorkspace />} />
            <Route path="people" element={<ChatWorkspace />} />
            <Route path="u/:username" element={<ProfilePage />} />
            <Route path="settings/*" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
