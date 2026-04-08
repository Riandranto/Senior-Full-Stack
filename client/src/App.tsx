import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./lib/i18n";
import { useAuth } from "./hooks/use-auth";
import { useState, useEffect } from "react";

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

// Composants publicitaires
import { FullscreenAd } from "@/components/FullscreenAd";

// Composant de chargement
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();
  const offlineMode = sessionStorage.getItem('offline_mode') === 'true';

  // Mode hors-ligne : bypass l'authentification
  if (offlineMode) {
    console.log('🔓 Offline mode: bypassing auth');
    return <Component />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    console.log('🔒 No user, redirecting to login');
    return <Redirect to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    console.log(`🔒 Role ${user.role} not allowed, redirecting`);
    if (user.role === 'DRIVER') return <Redirect to="/driver" />;
    if (user.role === 'ADMIN') return <Redirect to="/admin" />;
    return <Redirect to="/passenger" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const offlineMode = sessionStorage.getItem('offline_mode') === 'true';

  // En mode hors-ligne, on force le rôle passager par défaut
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
        <Route path="/">
          <Redirect to="/passenger" />
        </Route>
        <Route>
          <Redirect to="/passenger" />
        </Route>
      </Switch>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Switch>
      <Route path="/">
        {user ? (
          <Redirect to={
            user.role === 'DRIVER' ? '/driver' : 
            user.role === 'ADMIN' ? '/admin' : 
            '/passenger'
          } />
        ) : (
          <Redirect to="/login" />
        )}
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
  const offlineMode = sessionStorage.getItem('offline_mode') === 'true';

  // Gestion de l'affichage des publicités plein écran (désactivé en mode hors-ligne)
  useEffect(() => {
    if (offlineMode) return;
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
  }, [user, isLoading, offlineMode]);

  const handleCloseFullscreenAd = () => {
    setShowFullscreenAd(false);
  };

  return (
    <>
      <Router />
      {showFullscreenAd && !isLoading && user && !offlineMode && (
        <FullscreenAd onClose={handleCloseFullscreenAd} delay={500} />
      )}
    </>
  );
}

function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </I18nProvider>
  );
}

export default App;