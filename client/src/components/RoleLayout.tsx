import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, History, User, LogOut, Menu, HelpCircle, Bell, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import type { Notification } from '@shared/schema';

export function MobileLayout({ children, role }: { children: React.ReactNode, role: 'passenger' | 'driver' }) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showNotifs, setShowNotifs] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 10000,
  });

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: showNotifs,
  });

  const unreadCount = unreadData?.count || 0;

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
  };

  const navItems = role === 'passenger' ? [
    { href: '/passenger', icon: Home, label: t('request_ride') },
    { href: '/passenger/history', icon: History, label: t('history') },
    { href: '/passenger/profile', icon: User, label: t('profile') },
    { href: '/passenger/settings', icon: Settings, label: t('settings') || 'Settings' },
    { href: '/passenger/help', icon: HelpCircle, label: t('help') },
  ] : [
    { href: '/driver', icon: Home, label: t('online') },
    { href: '/driver/profile', icon: User, label: t('profile') },
    { href: '/driver/settings', icon: Settings, label: t('settings') || 'Settings' },
    { href: '/driver/help', icon: HelpCircle, label: t('help') },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background">
      <header className="flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-md border-b z-20 absolute top-0 w-full">
        <h1 className="text-xl font-bold font-display tracking-tight text-foreground" data-testid="app-title">
          Ride<span className="text-primary">Madagascar</span>
        </h1>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full relative"
              onClick={() => setShowNotifs(!showNotifs)}
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-unread-count">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {showNotifs && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifs(false)} />
                <div className="absolute right-0 top-12 w-[calc(100vw_-_24px)] sm:w-80 max-h-96 bg-background border rounded-2xl shadow-2xl z-40 overflow-hidden" data-testid="notifications-panel">
                  <div className="flex items-center justify-between p-3 border-b">
                    <span className="font-bold text-sm">Fampandrenesana</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary font-medium" data-testid="button-mark-all-read">
                        Voaky daholo
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">Tsy misy fampandrenesana</div>
                    ) : (
                      notifs.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-3 border-b last:border-0 cursor-pointer transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                          onClick={async () => {
                            if (!n.isRead) {
                              await fetch(`/api/notifications/${n.id}/read`, { method: 'POST', credentials: 'include' });
                              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
                            }
                            if (n.rideId) {
                              setShowNotifs(false);
                              setLocation(`/${role}/ride/${n.rideId}`);
                            }
                          }}
                          data-testid={`notification-${n.id}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{n.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {n.createdAt ? new Date(n.createdAt).toLocaleTimeString('fr-MG', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 sm:w-80 border-l-0">
              <div className="flex flex-col h-full py-6">
                <h2 className="text-lg font-bold mb-8 font-display">Menu</h2>
                <div className="flex-1 space-y-2">
                  {navItems.map((item) => {
                    const isActive = location === item.href;
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className={`flex items-center space-x-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`} data-testid={`nav-${item.href.split('/').pop()}`}>
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
                <Button variant="destructive" className="w-full justify-start space-x-3 rounded-xl" onClick={() => logout()} data-testid="button-logout">
                  <LogOut className="w-5 h-5" />
                  <span>Hiala (Logout)</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
