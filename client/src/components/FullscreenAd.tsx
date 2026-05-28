import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

const SESSION_KEY = 'farady_fullscreen_ad_shown';

export const FullscreenAd = memo(function FullscreenAd({ onClose, delay = 0 }) {
  const [ad, setAd] = useState(null);
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();
  const { lang } = useTranslation();
  const fetchedRef = useRef(false);
  const closedRef = useRef(false);

  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  const handleAdClick = useCallback(async (ad) => {
    if (ad?.linkUrl) {
      await fetch(`/api/ads/${ad.id}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen: 'FULLSCREEN' }),
        credentials: 'include',
      });
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      handleClose();
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const userRole = user?.role || 'ALL';
        const res = await apiFetch(`/api/ads?position=FULLSCREEN&userRole=${userRole}`);
        if (res.ok) {
          const ads = await res.json();
          if (ads && ads.length) {
            setAd(ads[0]);
            setVisible(true);
            sessionStorage.setItem(SESSION_KEY, 'true');
          } else {
            handleClose();
          }
        } else {
          handleClose();
        }
      } catch (err) {
        console.error(err);
        handleClose();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, user?.role, handleClose]);

  if (!visible || !ad) return null;

  const title = lang === 'mg' ? ad.title : ad.titleFr;
  const description = lang === 'mg' ? ad.description : ad.descriptionFr;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        onClick={() => handleAdClick(ad)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-[90vw] h-[90vh] max-w-none bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <img src={ad.imageUrl} alt={title} className="w-full h-full object-contain bg-black/5" />
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
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});