import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./lib/i18n";
import { useAuth } from "./hooks/use-auth";

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

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
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
  console.log('🔄 Router - user:', user, 'isLoading:', isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;