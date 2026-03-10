import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { useTranslation } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Globe, Moon, Sun, Bell, BellOff, Info, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function SettingsPage() {
  const { t, lang, setLang } = useTranslation();
  const { user } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('farady_theme') === 'dark' ||
      document.documentElement.classList.contains('dark');
  });
  const [notifsEnabled, setNotifsEnabled] = useState(() => {
    return localStorage.getItem('farady_notifs') !== 'off';
  });
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('farady_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('farady_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('farady_notifs', notifsEnabled ? 'on' : 'off');
  }, [notifsEnabled]);

  if (!user) return null;

  const role = user.role.toLowerCase() as 'passenger' | 'driver';

  return (
    <MobileLayout role={role}>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="p-4 pt-20 pb-8 space-y-4">
          <h1 className="text-2xl font-bold font-display" data-testid="text-settings-title">
            {t('settings')}
          </h1>

          <Card className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-language">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t('language')}</p>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'mg' ? 'Malagasy' : 'Français'}
                  </p>
                </div>
              </div>
              <div className="flex bg-secondary p-1 rounded-xl">
                <button 
                  onClick={() => setLang('mg')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'mg' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  data-testid="button-lang-mg"
                >
                  MG
                </button>
                <button 
                  onClick={() => setLang('fr')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'fr' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  data-testid="button-lang-fr"
                >
                  FR
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-dark-mode">
            <button 
              className="flex items-center justify-between w-full"
              onClick={() => setDarkMode(!darkMode)}
              data-testid="button-toggle-dark"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-indigo-500/10' : 'bg-amber-500/10'}`}>
                  {darkMode ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{t('dark_mode')}</p>
                  <p className="text-xs text-muted-foreground">
                    {darkMode 
                      ? (lang === 'mg' ? 'Maizina' : 'Activé') 
                      : (lang === 'mg' ? 'Mazava' : 'Désactivé')
                    }
                  </p>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full relative transition-colors ${darkMode ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white dark:bg-foreground rounded-full shadow transition-all ${darkMode ? 'right-0.5' : 'left-0.5'}`} />
              </div>
            </button>
          </Card>

          <Card className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-notifications">
            <button 
              className="flex items-center justify-between w-full"
              onClick={() => setNotifsEnabled(!notifsEnabled)}
              data-testid="button-toggle-notifs"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${notifsEnabled ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {notifsEnabled ? <Bell className="w-5 h-5 text-green-500" /> : <BellOff className="w-5 h-5 text-red-400" />}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{t('notifications_label')}</p>
                  <p className="text-xs text-muted-foreground">
                    {notifsEnabled 
                      ? (lang === 'mg' ? 'Miasa' : 'Activé') 
                      : (lang === 'mg' ? 'Tsy miasa' : 'Désactivé')
                    }
                  </p>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full relative transition-colors ${notifsEnabled ? 'bg-green-500' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${notifsEnabled ? 'right-0.5' : 'left-0.5'}`} />
              </div>
            </button>
          </Card>

          <Card className="p-4 rounded-2xl border-0 shadow-soft bg-card/50 backdrop-blur-sm" data-testid="section-about">
            <button 
              className="flex items-center justify-between w-full"
              onClick={() => setShowAbout(true)}
              data-testid="button-about"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Info className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{t('about_app')}</p>
                  <p className="text-xs text-muted-foreground">Farady v1.0.0</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </Card>

          <div className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Farady — Fort-Dauphin, Madagascar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              © 2026 RideMadagascar
            </p>
          </div>
        </div>
      </div>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{t('about_app')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-display font-bold text-primary">F</span>
              </div>
              <h3 className="font-bold text-lg font-display">Farady</h3>
              <p className="text-sm text-muted-foreground">v1.0.0</p>
            </div>
            <p className="text-sm text-muted-foreground text-center leading-relaxed" data-testid="text-about-description">
              {t('about_app_desc')}
            </p>
            <div className="border-t pt-3 text-center">
              <p className="text-xs text-muted-foreground">Fort-Dauphin / Tolagnaro</p>
              <p className="text-xs text-muted-foreground">Madagascar 🇲🇬</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
