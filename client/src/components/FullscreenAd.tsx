// src/components/FullscreenAd.tsx - Version finale corrigée
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

// Variables globales pour éviter les appels multiples dans toute l'application
let globalFetchCompleted = false;
let globalFetchInProgress = false;
let globalAdShown = false;

interface FullscreenAdProps {
  onClose: () => void;
  delay?: number;
}

export const FullscreenAd = memo(function FullscreenAd({ onClose, delay = 0 }: FullscreenAdProps) {
  const [ad, setAd] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();
  const { lang } = useTranslation();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const hasAttemptedRef = useRef(false);

  const handleClose = useCallback(() => {
    if (!isMountedRef.current) return;
    setVisible(false);
    // Ne pas appeler onClose immédiatement pour éviter les cycles
    setTimeout(() => {
      if (isMountedRef.current && onClose) {
        onClose();
      }
    }, 100);
  }, [onClose]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Vérification globale - si déjà affiché ou déjà fetché, ne rien faire
    if (globalFetchCompleted || globalAdShown) {
      handleClose();
      return;
    }
    
    // Vérifier sessionStorage
    if (sessionStorage.getItem('farady_fullscreen_ad_shown') === 'true') {
      globalAdShown = true;
      globalFetchCompleted = true;
      handleClose();
      return;
    }

    // Si déjà tenté, ne pas réessayer
    if (hasAttemptedRef.current) {
      handleClose();
      return;
    }

    // Nettoyer le timeout précédent
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      // Double vérification avant de commencer
      if (!isMountedRef.current) return;
      if (globalFetchCompleted || globalFetchInProgress) return;
      if (hasAttemptedRef.current) return;
      
      hasAttemptedRef.current = true;
      globalFetchInProgress = true;
      
      (async () => {
        try {
          const userRole = user?.role || 'ALL';
          console.log('[FullscreenAd] Fetching ad for role:', userRole);
          
          const res = await apiFetch(`/api/ads?position=FULLSCREEN&userRole=${userRole}`, {
            credentials: 'include',
          });
          
          if (!isMountedRef.current) {
            globalFetchInProgress = false;
            return;
          }
          
          if (res.ok) {
            const ads = await res.json();
            console.log('[FullscreenAd] Got ads:', ads?.length || 0);
            if (ads && ads.length > 0) {
              setAd(ads[0]);
              setVisible(true);
              globalFetchCompleted = true;
              globalAdShown = true;
              sessionStorage.setItem('farady_fullscreen_ad_shown', 'true');
              return;
            }
          }
          // Pas de pub ou erreur - fermer et ne plus réessayer
          globalFetchCompleted = true;
          handleClose();
        } catch (err) {
          console.error('[FullscreenAd] Error:', err);
          globalFetchCompleted = true;
          if (isMountedRef.current) handleClose();
        } finally {
          globalFetchInProgress = false;
        }
      })();
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [delay, user?.role, handleClose]);

  const handleAdClick = useCallback(async (adItem: any) => {
    if (adItem?.linkUrl) {
      try {
        await fetch(`/api/ads/${adItem.id}/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screen: 'FULLSCREEN' }),
          credentials: 'include',
        });
        window.open(adItem.linkUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        console.error('Error recording ad click:', error);
      }
    }
  }, []);

  if (!visible || !ad) return null;

  const title = lang === 'mg' ? ad.title : ad.titleFr;
  const description = lang === 'mg' ? ad.description : ad.descriptionFr;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
        >
          <div className="relative w-[90vw] h-[90vh] max-w-none bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <img 
              src={ad.imageUrl} 
              alt={title} 
              className="w-full h-full object-contain bg-black/5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white">
              <h2 className="text-xl font-bold mb-2">{title}</h2>
              {description && <p className="text-sm opacity-90 mb-4">{description}</p>}
              {ad.linkUrl && (
                <button
                  onClick={() => handleAdClick(ad)}
                  className="px-6 py-2 bg-primary rounded-full font-bold text-sm shadow-lg"
                >
                  En savoir plus
                </button>
              )}
            </div>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 z-10"
              aria-label="Fermer"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});