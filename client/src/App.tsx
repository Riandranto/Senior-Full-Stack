// src/App.tsx
import { Switch, Route, Redirect, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./lib/i18n";
import { useAuth } from "./hooks/use-auth";
import { useOfflineSync } from "./hooks/use-offline-sync";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { capacitorStorage } from "./lib/capacitor-storage";
import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Capacitor } from '@capacitor/core';

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

import { FullscreenAd } from "@/components/FullscreenAd";
import { OfflineBanner } from "@/components/OfflineBanner";

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Error Boundary pour capturer les erreurs de rendu
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
    // Optionnel : envoyer l'erreur à un service de monitoring
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Une erreur est survenue</h1>
          <p className="text-muted-foreground mb-6">{this.state.error?.message || "Erreur inconnue"}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-xl"
          >
            Rafraîchir la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Hook pour stocker la dernière route active
function useLastRoute() {
  const STORAGE_KEY = 'farady_last_route';
  const [lastRoute, setLastRoute] = useState<string>('/passenger');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setLastRoute(saved);
  }, []);

  const updateLastRoute = (route: string) => {
    if (route !== '/login' && route !== '/auth' && !route.includes('offline')) {
      setLastRoute(route);
      localStorage.setItem(STORAGE_KEY, route);
    }
  };

  return { lastRoute, updateLastRoute };
}

// Composant pour traquer les changements de route
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

  if (offlineMode) {
    console.log('🔓 Offline mode: bypassing auth');
    return <Component />;
  }

  if (isLoading) return <LoadingSpinner />;

  if (!user && isConnected) {
    console.log('🔒 No user, redirecting to login');
    return <Redirect to="/login" />;
  }

  if (!user && !isConnected) {
    return <Redirect to="/login" />;
  }

  if (!allowedRoles.includes(user!.role)) {
    if (user!.role === 'DRIVER') return <Redirect to="/driver" />;
    if (user!.role === 'ADMIN') return <Redirect to="/admin" />;
    return <Redirect to="/passenger" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading, refetch } = useAuth();
  const [offlineMode, setOfflineMode] = useState(false);
  const { isConnected } = useNetworkStatus();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { lastRoute } = useLastRoute();

  // Reconnexion automatique
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleReconnect = async () => {
      if (!isConnected) return;
      if (!user && !isLoading && window.location.pathname !== '/login') {
        setIsReconnecting(true);
        try {
          const result = await refetch();
          if (result.data) {
            window.location.href = lastRoute;
          }
        } catch (err) {
          console.error('Reconnection auth failed', err);
        } finally {
          setTimeout(() => setIsReconnecting(false), 500);
        }
      }
    };
    timeoutId = setTimeout(handleReconnect, 1000);
    return () => clearTimeout(timeoutId);
  }, [isConnected, user, isLoading, refetch, lastRoute]);

  useEffect(() => {
    capacitorStorage.isOfflineMode().then(setOfflineMode);
  }, []);

  if (offlineMode) {
    return (
      <Switch>
        <Route path="/passenger">
          {() => <ProtectedRoute component={PassengerHome} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/passenger/history">
          {() => <ProtectedRoute component={PassengerHistory} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/passenger/ride/:id">
          {() => <ProtectedRoute component={PassengerRide} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/passenger/profile">
          {() => <ProtectedRoute component={Profile} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/passenger/settings">
          {() => <ProtectedRoute component={Settings} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/passenger/help">
          {() => <ProtectedRoute component={Help} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/passenger/bookings">
          {() => <ProtectedRoute component={BookingsPage} allowedRoles={['PASSENGER']} />}
        </Route>
        <Route path="/"><Redirect to="/passenger" /></Route>
        <Route><Redirect to="/passenger" /></Route>
      </Switch>
    );
  }

  if (isLoading || isReconnecting) return <LoadingSpinner />;

  return (
    <Switch>
      <Route path="/">
        {user ? (
          <Redirect to={
            user.role === 'DRIVER' ? '/driver' : 
            user.role === 'ADMIN' ? '/admin' : '/passenger'
          } />
        ) : <Redirect to="/login" />}
      </Route>
      
      <Route path="/login" component={AuthPage} />
      
      <Route path="/passenger">
        {() => <ProtectedRoute component={PassengerHome} allowedRoles={['PASSENGER']} />}
      </Route>
      <Route path="/passenger/history">
        {() => <ProtectedRoute component={PassengerHistory} allowedRoles={['PASSENGER']} />}
      </Route>
      <Route path="/passenger/ride/:id">
        {() => <ProtectedRoute component={PassengerRide} allowedRoles={['PASSENGER']} />}
      </Route>
      <Route path="/passenger/profile">
        {() => <ProtectedRoute component={Profile} allowedRoles={['PASSENGER']} />}
      </Route>
      <Route path="/passenger/settings">
        {() => <ProtectedRoute component={Settings} allowedRoles={['PASSENGER']} />}
      </Route>
      <Route path="/passenger/help">
        {() => <ProtectedRoute component={Help} allowedRoles={['PASSENGER']} />}
      </Route>
      <Route path="/passenger/bookings">
        {() => <ProtectedRoute component={BookingsPage} allowedRoles={['PASSENGER']} />}
      </Route>

      <Route path="/driver">
        {() => <ProtectedRoute component={DriverHome} allowedRoles={['DRIVER']} />}
      </Route>
      <Route path="/driver/profile">
        {() => <ProtectedRoute component={Profile} allowedRoles={['DRIVER']} />}
      </Route>
      <Route path="/driver/settings">
        {() => <ProtectedRoute component={Settings} allowedRoles={['DRIVER']} />}
      </Route>
      <Route path="/driver/help">
        {() => <ProtectedRoute component={Help} allowedRoles={['DRIVER']} />}
      </Route>

      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} allowedRoles={['ADMIN']} />}
      </Route>

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
          <AppContent />
        </TooltipProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;