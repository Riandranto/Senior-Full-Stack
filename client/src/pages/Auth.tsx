// client/src/pages/auth/Auth.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, Shield, Loader2, WifiOff, AtSign, Lock } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { apiFetch } from '@/lib/api';

// Animation du logo
const LogoAnimation = () => (
  <motion.div
    initial={{ scale: 0.8, rotate: -10 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 400, damping: 15 }}
    className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary/30"
  >
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8 text-primary-foreground"
      animate={{ rotate: [0, -3, 3, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
      <circle cx="7" cy="17" r="2"/>
      <path d="M9 17h6"/>
      <circle cx="17" cy="17" r="2"/>
    </motion.svg>
  </motion.div>
);

// Animation de fond
const BackgroundAnimation = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: 0.6, scale: 1 }}
      transition={{ duration: 1 }}
      className="absolute top-0 left-0 w-full h-64 bg-primary/20 rounded-b-[100%] blur-3xl"
    />
    <motion.div
      animate={{
        x: [0, 100, 0],
        y: [0, 50, 0],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "linear",
      }}
      className="absolute top-1/4 right-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"
    />
    <motion.div
      animate={{
        x: [0, -100, 0],
        y: [0, -50, 0],
      }}
      transition={{
        duration: 15,
        repeat: Infinity,
        ease: "linear",
      }}
      className="absolute bottom-1/4 left-1/4 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl"
    />
  </div>
);

// Animation du champ de saisie
const InputField = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = 'text',
  maxLength,
  icon: Icon,
  testId,
  error
}: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <label className="text-sm font-semibold mb-1.5 block text-foreground">{label}</label>
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Input 
          value={value} 
          onChange={onChange} 
          placeholder={placeholder}
          type={type}
          maxLength={maxLength}
          className={`h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary focus:ring-primary/20 transition-all ${Icon ? 'pl-10' : ''} ${error ? 'border-red-500' : ''}`}
          data-testid={testId}
        />
      </motion.div>
    </div>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </motion.div>
);

export default function Auth() {
  // États pour la connexion par téléphone
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  
  // États pour la connexion par email
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState<'email' | 'otp'>('email');
  
  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');
  const [offlineCredentials, setOfflineCredentials] = useState<{phone: string, timestamp: number} | null>(null);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  
  const { user, login, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { t, lang } = useTranslation();
  const { toast } = useToast();
  const { isConnected } = useNetworkStatus();

  // Charger les identifiants sauvegardés au démarrage
  useEffect(() => {
    const saved = localStorage.getItem('offline_credentials');
    if (saved) {
      try {
        const creds = JSON.parse(saved);
        if (Date.now() - creds.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setOfflineCredentials(creds);
        } else {
          localStorage.removeItem('offline_credentials');
        }
      } catch(e) {}
    }
  }, []);

  // Rediriger si déjà connecté
  useEffect(() => {
    if (user) {
      if (user.role === 'DRIVER') {
        setLocation('/driver');
      } else if (user.role === 'ADMIN') {
        setLocation('/admin');
      } else {
        setLocation('/passenger');
      }
    }
  }, [user, setLocation]);

  const handleRequestPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    if (!isConnected) {
      toast({ 
        variant: "destructive", 
        title: "Pas de connexion", 
        description: "Vérifiez votre connexion Internet pour recevoir le code." 
      });
      return;
    }
    
    setIsRequestingOtp(true);
    setOtpError(null);
    
    try {
      const res = await apiFetch('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'envoi");
      }
      
      // Afficher l'OTP dans un toast (comme pour l'email)
      if (data.devOtp) {
        toast({ 
          title: "📱 Code de vérification", 
          description: `Votre code OTP est : ${data.devOtp}`,
          duration: 15000,
        });
        // Auto-remplir le champ OTP
        setPhoneOtp(data.devOtp);
      } else {
        toast({ 
          title: "Code envoyé!", 
          description: `Un code a été envoyé au ${phone}`,
        });
      }
      
      setPhoneStep('otp');
      
    } catch (err: any) {
      setOtpError(err.message);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOtp) return;
    
    if (!isConnected) {
      toast({ 
        variant: "destructive", 
        title: "Pas de connexion", 
        description: "Vérifiez votre connexion Internet pour vous connecter." 
      });
      return;
    }
    
    setIsVerifying(true);
    setOtpError(null);
    
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp: phoneOtp }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Code invalide");
      }
      
      localStorage.setItem('offline_credentials', JSON.stringify({
        phone: phone,
        timestamp: Date.now()
      }));
      sessionStorage.removeItem('offline_mode');
      
      await refetch();
      
      toast({ 
        title: "Connecté!", 
        description: "Bienvenue sur Farady" 
      });
      
      if (data.user.role === 'DRIVER') {
        setLocation('/driver');
      } else if (data.user.role === 'ADMIN') {
        setLocation('/admin');
      } else {
        setLocation('/passenger');
      }
    } catch (err: any) {
      setOtpError(err.message);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    if (!isConnected) {
      toast({ 
        variant: "destructive", 
        title: "Pas de connexion", 
        description: "Vérifiez votre connexion Internet pour recevoir le code." 
      });
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setOtpError("Email invalide");
      return;
    }
    
    setIsRequestingOtp(true);
    setOtpError(null);
    
    try {
      const res = await apiFetch('/api/auth/request-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email, language: lang }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'envoi");
      }
      
      if (data.devOtp) {
        toast({ 
          title: "📧 Code de vérification", 
          description: `Votre code OTP est : ${data.devOtp}`,
          duration: 15000,
        });
        setEmailOtp(data.devOtp);
      } else {
        toast({ 
          title: "Code envoyé!", 
          description: `Un code a été envoyé à ${email}`,
        });
      }
      
      setEmailStep('otp');
      
    } catch (err: any) {
      setOtpError(err.message);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp) return;
    
    if (!isConnected) {
      toast({ 
        variant: "destructive", 
        title: "Pas de connexion", 
        description: "Vérifiez votre connexion Internet pour vous connecter." 
      });
      return;
    }
    
    setIsVerifying(true);
    setOtpError(null);
    
    try {
      const res = await apiFetch('/api/auth/verify-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp: emailOtp }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Code invalide");
      }
      
      localStorage.setItem('offline_credentials', JSON.stringify({
        phone: data.user?.phone || email,
        timestamp: Date.now()
      }));
      sessionStorage.removeItem('offline_mode');
      
      await refetch();
      
      toast({ 
        title: "Connecté!", 
        description: "Bienvenue sur Farady" 
      });
      
      if (data.user.role === 'DRIVER') {
        setLocation('/driver');
      } else if (data.user.role === 'ADMIN') {
        setLocation('/admin');
      } else {
        setLocation('/passenger');
      }
    } catch (err: any) {
      setOtpError(err.message);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOfflineAccess = () => {
    if (offlineCredentials) {
      toast({
        title: "Mode hors-ligne",
        description: "Accès limité. Reconnectez-vous pour utiliser toutes les fonctionnalités."
      });
      sessionStorage.setItem('offline_mode', 'true');
      setLocation('/passenger');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      <BackgroundAnimation />
      
      {isConnected === false && (
        <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 text-sm z-20 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>Pas de connexion Internet - Mode dégradé</span>
        </div>
      )}
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <Card className="p-6 shadow-float border-0 bg-background/80 backdrop-blur-xl rounded-3xl">
          <div className="text-center mb-6">
            <LogoAnimation />
            
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-3xl font-bold font-display text-foreground"
            >
              Farady
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-muted-foreground mt-2"
            >
              Connectez-vous pour continuer
            </motion.p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'phone' | 'email')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl mb-6">
              <TabsTrigger value="phone" className="rounded-lg flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Téléphone
              </TabsTrigger>
              <TabsTrigger value="email" className="rounded-lg flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </TabsTrigger>
            </TabsList>

            {/* Connexion par téléphone */}
            <TabsContent value="phone">
              <AnimatePresence mode="wait">
                {phoneStep === 'phone' ? (
                  <motion.form 
                    key="phone-form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleRequestPhoneOtp} 
                    className="space-y-4"
                  >
                    <InputField 
                      label="Numéro de téléphone"
                      value={phone}
                      onChange={(e: any) => setPhone(e.target.value)}
                      placeholder="034 00 000 00"
                      icon={Phone}
                      testId="input-phone"
                      error={otpError}
                    />
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                        disabled={!isConnected || isRequestingOtp}
                      >
                        {isRequestingOtp ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <span className="mr-2">→</span>
                            Continuer
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.form>
                ) : (
                  <motion.form 
                    key="phone-otp-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handlePhoneLogin} 
                    className="space-y-4"
                  >
                    <InputField 
                      label="Code OTP"
                      value={phoneOtp}
                      onChange={(e: any) => setPhoneOtp(e.target.value)}
                      placeholder="123456"
                      type="text"
                      maxLength={6}
                      icon={Shield}
                      testId="input-otp"
                      error={otpError}
                    />
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        disabled={isVerifying || !isConnected} 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                      >
                        {isVerifying ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Se connecter
                          </span>
                        )}
                      </Button>
                    </motion.div>
                    
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      type="button"
                      onClick={() => {
                        setPhoneStep('phone');
                        setPhoneOtp('');
                        setOtpError(null);
                      }}
                      className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      ← Changer de numéro
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Connexion par email */}
            <TabsContent value="email">
              <AnimatePresence mode="wait">
                {emailStep === 'email' ? (
                  <motion.form 
                    key="email-form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleRequestEmailOtp} 
                    className="space-y-4"
                  >
                    <InputField 
                      label="Adresse email"
                      value={email}
                      onChange={(e: any) => setEmail(e.target.value)}
                      placeholder="exemple@email.com"
                      icon={AtSign}
                      testId="input-email"
                      error={otpError}
                    />
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                        disabled={!isConnected || isRequestingOtp}
                      >
                        {isRequestingOtp ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <span className="mr-2">→</span>
                            Continuer
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.form>
                ) : (
                  <motion.form 
                    key="email-otp-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleEmailLogin} 
                    className="space-y-4"
                  >
                    <InputField 
                      label="Code OTP"
                      value={emailOtp}
                      onChange={(e: any) => setEmailOtp(e.target.value)}
                      placeholder="123456"
                      type="text"
                      maxLength={6}
                      icon={Lock}
                      testId="input-email-otp"
                      error={otpError}
                    />
                    
                    <p className="text-xs text-muted-foreground text-center">
                      Un code de vérification a été envoyé à votre adresse email
                    </p>
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        disabled={isVerifying || !isConnected} 
                        type="submit" 
                        className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                      >
                        {isVerifying ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Se connecter
                          </span>
                        )}
                      </Button>
                    </motion.div>
                    
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      type="button"
                      onClick={() => {
                        setEmailStep('email');
                        setEmailOtp('');
                        setOtpError(null);
                      }}
                      className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      ← Changer d'email
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
          
          {/* Bouton d'accès hors-ligne */}
          {isConnected === false && offlineCredentials && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 pt-4 border-t"
            >
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOfflineAccess}
              >
                <WifiOff className="w-4 h-4 mr-2" />
                📱 Accès hors-ligne
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Dernière connexion : {new Date(offlineCredentials.timestamp).toLocaleDateString()}
              </p>
            </motion.div>
          )}
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center"
          >
            <p className="text-[10px] text-muted-foreground">
              En continuant, vous acceptez nos conditions d'utilisation
            </p>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}