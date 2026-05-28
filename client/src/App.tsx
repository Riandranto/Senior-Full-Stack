// src/App.tsx
import { Switch, Route, Redirect, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./lib/i18n";
import { useAuth } from "./hooks/use-auth";
import { useOfflineSync } from "./hooks/use-offline-sync";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { capacitorStorage } from "./lib/capacitor-storage";
import { useState, useEffect, Component, ErrorInfo, ReactNode, useRef, useCallback } from "react";
import { WebSocketProvider } from '@/context/WebSocketContext';
import { WebSocketEventManager } from '@/components/WebSocketEventManager';
import { FullscreenAd } from "@/components/FullscreenAd";

// Pages
import AuthPage from "./pages/Auth";
import PassengerHome from "./pages/passenger/Home";
import PassengerRide from "./pages/passenger/Ride";
import PassengerHistory from "./pages/passenger/History";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import DriverHome from "./pages/driver/Home";
import AdminDashboard from "./pages/admin/Dashboard";
import Help from "./pages/Help";
import BookingsPage from './pages/passenger/Bookings';

import { OfflineBanner } from "@/components/OfflineBanner";

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Une erreur est survenue</h1>
          <p className="text-muted-foreground mb-6">{this.state.error?.message || "Erreur inconnue"}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-xl">Rafraîchir la page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function useLastRoute() {
  const STORAGE_KEY = 'farady_last_route';
  const [lastRoute, setLastRoute] = useState<string>('/passenger');
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setLastRoute(saved);
  }, []);
  const updateLastRoute = useCallback((route: string) => {
    if (route && typeof route === 'string' && route !== '/login' && route !== '/auth' && !route.includes('offline') && route !== '/') {
      localStorage.setItem(STORAGE_KEY, route);
    }
  }, []);
  useEffect(() => {
    updateLastRoute(lastRoute);
  }, [lastRoute, updateLastRoute]);
  return { lastRoute, updateLastRoute };
}

function RouteTracker({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { updateLastRoute } = useLastRoute();
  useEffect(() => {
    updateLastRoute(location);
  }, [location, updateLastRoute]);
  return <>{children}</>;
}

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();
  const [offlineMode, setOfflineMode] = useState(false);
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    capacitorStorage.isOfflineMode().then(setOfflineMode);
  }, []);

  if (offlineMode) return <Component />;
  if (isLoading) return <LoadingSpinner />;
  if (!user && isConnected) return <Redirect to="/login" />;
  if (!user && !isConnected) return <Redirect to="/login" />;
  if (!allowedRoles.includes(user!.role)) {
    if (user!.role === 'DRIVER') return <Redirect to="/driver" />;
    if (user!.role === 'ADMIN') return <Redirect to="/admin" />;
    return <Redirect to="/passenger" />;
  }
  return <Component />;
}

function Router() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [offlineMode, setOfflineMode] = useState(false);
  const { isConnected } = useNetworkStatus();
  const initialRedirectDone = useRef(false);
  const previousUserRef = useRef(user);

  useEffect(() => {
    capacitorStorage.isOfflineMode().then(setOfflineMode);
  }, []);

  // Redirection initiale UNIQUEMENT une fois
  useEffect(() => {
    if (isLoading) return;
    if (offlineMode) return;
    if (!user && isConnected) return;
    if (user && !offlineMode && !initialRedirectDone.current) {
      const path = window.location.pathname;
      if (user.role === 'DRIVER' && !path.startsWith('/driver')) {
        setLocation('/driver');
      } else if (user.role === 'ADMIN' && !path.startsWith('/admin')) {
        setLocation('/admin');
      } else if (user.role === 'PASSENGER' && !path.startsWith('/passenger')) {
        setLocation('/passenger');
      }
      initialRedirectDone.current = true;
    }
    // Réinitialiser le flag si l'utilisateur change (ex: déconnexion)
    if (user !== previousUserRef.current) {
      if (!user) {
        initialRedirectDone.current = false;
      }
      previousUserRef.current = user;
    }
  }, [user, isLoading, offlineMode, isConnected, setLocation]);

  if (offlineMode) {
    return (
      <Switch>
        <Route path="/passenger" component={PassengerHome} />
        <Route path="/passenger/history" component={PassengerHistory} />
        <Route path="/passenger/ride/:id" component={PassengerRide} />
        <Route path="/passenger/profile" component={Profile} />
        <Route path="/passenger/settings" component={Settings} />
        <Route path="/passenger/help" component={Help} />
        <Route path="/passenger/bookings" component={BookingsPage} />
        <Route path="/"><Redirect to="/passenger" /></Route>
        <Route><Redirect to="/passenger" /></Route>
      </Switch>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <Switch>
      <Route path="/">
        {user ? (
          <Redirect to={user.role === 'DRIVER' ? '/driver' : user.role === 'ADMIN' ? '/admin' : '/passenger'} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route path="/login" component={AuthPage} />
      <Route path="/passenger" component={() => <ProtectedRoute component={PassengerHome} allowedRoles={['PASSENGER']} />} />
      <Route path="/passenger/history" component={() => <ProtectedRoute component={PassengerHistory} allowedRoles={['PASSENGER']} />} />
      <Route path="/passenger/ride/:id" component={() => <ProtectedRoute component={PassengerRide} allowedRoles={['PASSENGER']} />} />
      <Route path="/passenger/profile" component={() => <ProtectedRoute component={Profile} allowedRoles={['PASSENGER']} />} />
      <Route path="/passenger/settings" component={() => <ProtectedRoute component={Settings} allowedRoles={['PASSENGER']} />} />
      <Route path="/passenger/help" component={() => <ProtectedRoute component={Help} allowedRoles={['PASSENGER']} />} />
      <Route path="/passenger/bookings" component={() => <ProtectedRoute component={BookingsPage} allowedRoles={['PASSENGER']} />} />
      <Route path="/driver" component={() => <ProtectedRoute component={DriverHome} allowedRoles={['DRIVER']} />} />
      <Route path="/driver/profile" component={() => <ProtectedRoute component={Profile} allowedRoles={['DRIVER']} />} />
      <Route path="/driver/settings" component={() => <ProtectedRoute component={Settings} allowedRoles={['DRIVER']} />} />
      <Route path="/driver/help" component={() => <ProtectedRoute component={Help} allowedRoles={['DRIVER']} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} allowedRoles={['ADMIN']} />} />
      <Route>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
          <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
          <p className="text-xl text-muted-foreground">This road leads nowhere.</p>
        </div>
      </Route>
    </Switch>
  );
}

function AppContent() {
  const [showFullscreenAd, setShowFullscreenAd] = useState(false);
  const { user, isLoading } = useAuth();
  const { isOfflineMode, isSyncing, pendingSyncCount, syncNow, saveDataForOffline } = useOfflineSync();

  useEffect(() => {
    if (user && !isLoading && !isOfflineMode) saveDataForOffline();
  }, [user, isLoading, isOfflineMode, saveDataForOffline]);

  useEffect(() => {
    if (isOfflineMode) return;
    if (!user || isLoading) return;

    const adShown = sessionStorage.getItem('fullscreen_ad_shown');
    const lastAdDate = localStorage.getItem('last_fullscreen_ad_date');
    const today = new Date().toDateString();
    const shouldShowAd = !adShown && lastAdDate !== today;

    if (shouldShowAd) {
      const delay = user.role === 'DRIVER' ? 3000 : 2000;
      const timer = setTimeout(() => {
        setShowFullscreenAd(true);
        sessionStorage.setItem('fullscreen_ad_shown', 'true');
        localStorage.setItem('last_fullscreen_ad_date', today);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, isOfflineMode]);

  const handleCloseFullscreenAd = () => setShowFullscreenAd(false);

  return (
    <>
      <RouteTracker>
        {isOfflineMode && <OfflineBanner onSync={syncNow} isSyncing={isSyncing} pendingCount={pendingSyncCount} />}
        <Router />
      </RouteTracker>
      {showFullscreenAd && !isLoading && user && !isOfflineMode && (
        <FullscreenAd onClose={handleCloseFullscreenAd} delay={500} />
      )}
    </>
  );
}

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.MODE === 'development') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      });
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) registration.unregister();
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <WebSocketProvider>
            <WebSocketEventManager />
            <AppContent />
          </WebSocketProvider>
        </TooltipProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;