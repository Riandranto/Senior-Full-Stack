// src/components/OfflineBanner.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Database, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

interface OfflineBannerProps {
  onSync: () => void;
  isSyncing: boolean;
  pendingCount: number;
}

export function OfflineBanner({ onSync, isSyncing, pendingCount }: OfflineBannerProps) {
  const [visible, setVisible] = useState(true);
  const { lang } = useTranslation();

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 shadow-lg"
      >
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-white">
              <WifiOff className="w-5 h-5" />
              <span className="text-sm font-medium">
                {lang === 'mg' ? 'Tsy misy Internet' : 'Hors ligne'}
              </span>
              {pendingCount > 0 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {pendingCount} {lang === 'mg' ? 'miandry' : 'en attente'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs bg-white text-amber-600 hover:bg-white/90"
                  onClick={onSync}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  {lang === 'mg' ? 'Synchroniser' : 'Synchroniser'}
                </Button>
              )}
              <button
                onClick={() => setVisible(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Barre de progression des données hors-ligne */}
          <div className="mt-1 flex items-center gap-2">
            <Database className="w-3 h-3 text-white/70" />
            <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: pendingCount > 0 ? '100%' : '0%' }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <span className="text-[10px] text-white/70">
              {pendingCount === 0 
                ? (lang === 'mg' ? 'Voasynchroniser' : 'Synchronisé')
                : `${pendingCount} ${lang === 'mg' ? 'data miandry' : 'données en attente'}`
              }
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}