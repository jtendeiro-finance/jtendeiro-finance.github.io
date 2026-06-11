import { useEffect } from 'react';
import {
  createHashRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { useAuth } from './store/useAuth';
import { useProfile } from './store/useProfile';
import { useTransactions } from './store/useTransactions';
import { useInvoices } from './store/useInvoices';
import { useObligations } from './store/useObligations';
import { useChat } from './store/useChat';
import { AppShell } from './components/layout/AppShell';
import { Spinner } from './components/ui/Spinner';
import { ToastViewport } from './components/ui/Toast';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import InvoicesPage from './pages/InvoicesPage';
import ForecastPage from './pages/ForecastPage';
import FiscalCalendarPage from './pages/FiscalCalendarPage';
import CfoPage from './pages/CfoPage';
import SettingsPage from './pages/SettingsPage';

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

/** Subscreve os dados do utilizador autenticado e limpa-os ao sair. */
function useUserData(uid: string | null) {
  const loadProfile = useProfile((s) => s.load);
  useEffect(() => {
    if (!uid) {
      useProfile.getState().clearLocal();
      useTransactions.getState().clearLocal();
      useInvoices.getState().clearLocal();
      useObligations.getState().clearLocal();
      useChat.getState().clearLocal();
      return;
    }
    void loadProfile(uid);
    const unsubs = [
      useTransactions.getState().subscribe(uid),
      useInvoices.getState().subscribe(uid),
      useObligations.getState().subscribe(uid),
      useChat.getState().subscribe(uid),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, loadProfile]);
}

function RequireAuth() {
  const { user, loading } = useAuth();
  useUserData(user?.uid ?? null);
  const location = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

function RequireProfile() {
  const { profile, loaded } = useProfile();
  if (!loaded) return <FullScreenSpinner />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <RequireProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/movimentos', element: <TransactionsPage /> },
              { path: '/faturas', element: <InvoicesPage /> },
              { path: '/previsao', element: <ForecastPage /> },
              { path: '/calendario', element: <FiscalCalendarPage /> },
              { path: '/cfo', element: <CfoPage /> },
              { path: '/definicoes', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => init(), [init]);
  return (
    <>
      <RouterProvider router={router} />
      <ToastViewport />
    </>
  );
}
