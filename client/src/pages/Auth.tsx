import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

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
      toast({ title: "OTP Sent!", description: "Check your phone for the code." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    try {
      const res = await login({ phone, otp });
      if (res.user.role === 'DRIVER') {
        setLocation('/driver');
      } else if (res.user.role === 'ADMIN') {
        setLocation('/admin');
      } else {
        setLocation('/passenger');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-full h-64 bg-primary/20 rounded-b-[100%] blur-3xl -translate-y-1/2"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <Card className="p-8 shadow-float border-0 bg-background/80 backdrop-blur-xl rounded-3xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary/30 rotate-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary-foreground -rotate-3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground">{t('welcome')}</h1>
            <p className="text-muted-foreground mt-2">Login to ride or drive</p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-foreground">{t('login_phone')}</label>
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="+261 34 00 000 00" 
                  className="h-12 rounded-xl bg-secondary/50 border-transparent focus:border-primary focus:ring-primary/20"
                  data-testid="input-phone"
                />
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all" data-testid="button-send-otp">
                Next
              </Button>
            </form>
          ) : (
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleLogin} 
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-foreground">{t('login_otp')}</label>
                <Input 
                  value={otp} 
                  onChange={(e) => setOtp(e.target.value)} 
                  placeholder="123456" 
                  className="h-12 rounded-xl text-center text-2xl tracking-widest bg-secondary/50 border-transparent focus:border-primary focus:ring-primary/20"
                  maxLength={6}
                  data-testid="input-otp"
                />
              </div>
              <Button disabled={isLoginPending} type="submit" className="w-full h-12 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all" data-testid="button-verify-otp">
                {isLoginPending ? "..." : t('login_btn')}
              </Button>
            </motion.form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
