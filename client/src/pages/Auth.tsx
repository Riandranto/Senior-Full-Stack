import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Shield, Loader2 } from 'lucide-react';

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
  testId 
}: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <label className="text-sm font-semibold mb-1.5 block text-foreground">{label}</label>
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
        className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary focus:ring-primary/20 transition-all"
        data-testid={testId}
      />
    </motion.div>
  </motion.div>
);

export default function Auth() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  
  const { requestOtp, login, isLoginPending } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    try {
      await requestOtp(phone);
      setStep('otp');
      toast({ 
        title: "OTP Envoyé!", 
        description: "Vérifiez votre téléphone pour le code.",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    try {
      const res = await login({ phone, otp });
      // Animation de transition avant redirection
      await new Promise(resolve => setTimeout(resolve, 300));
      if (res.user.role === 'DRIVER') {
        setLocation('/driver');
      } else if (res.user.role === 'ADMIN') {
        setLocation('/admin');
      } else {
        setLocation('/passenger');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      <BackgroundAnimation />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <Card className="p-8 shadow-float border-0 bg-background/80 backdrop-blur-xl rounded-3xl">
          <div className="text-center mb-8">
            <LogoAnimation />
            
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-3xl font-bold font-display text-foreground"
            >
              {t('welcome')}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-muted-foreground mt-2"
            >
              {step === 'phone' ? 'Connectez-vous pour continuer' : 'Entrez le code reçu par SMS'}
            </motion.p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'phone' ? (
              <motion.form 
                key="phone-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleRequestOtp} 
                className="space-y-4"
              >
                <InputField 
                  label={t('login_phone')}
                  value={phone}
                  onChange={(e: any) => setPhone(e.target.value)}
                  placeholder="+261 34 00 000 00"
                  testId="input-phone"
                />
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                    data-testid="button-send-otp"
                  >
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1, repeat: Infinity, repeatDelay: 3 }}
                      className="mr-2"
                    >
                      →
                    </motion.span>
                    Continuer
                  </Button>
                </motion.div>
              </motion.form>
            ) : (
              <motion.form 
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleLogin} 
                className="space-y-4"
              >
                <InputField 
                  label={t('login_otp')}
                  value={otp}
                  onChange={(e: any) => setOtp(e.target.value)}
                  placeholder="123456"
                  type="text"
                  maxLength={6}
                  testId="input-otp"
                />
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    disabled={isLoginPending} 
                    type="submit" 
                    className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                    data-testid="button-verify-otp"
                  >
                    {isLoginPending ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 className="w-5 h-5" />
                        <span>Vérification...</span>
                      </motion.div>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {t('login_btn')}
                      </span>
                    )}
                  </Button>
                </motion.div>
                
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  ← Changer de numéro
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
          
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