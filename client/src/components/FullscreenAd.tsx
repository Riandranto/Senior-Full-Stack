import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';

interface FullscreenAdProps {
  onClose: () => void;
  delay?: number; // Délai avant affichage (ms)
}

export function FullscreenAd({ onClose, delay = 0 }: FullscreenAdProps) {
  const [ad, setAd] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();
  const { lang } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFullscreenAd();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const fetchFullscreenAd = async () => {
    try {
      const userRole = user?.role || 'ALL';
      const res = await fetch(`/api/ads?position=FULLSCREEN&userRole=${userRole}`, {
        credentials: 'include',
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      if (data.length > 0) {
        setAd(data[0]);
        setIsVisible(true);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to fetch fullscreen ad:', error);
      onClose();
    }
  };

  const handleAdClick = async () => {
    if (ad?.linkUrl) {
      await fetch(`/api/ads/${ad.id}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen: 'FULLSCREEN' }),
        credentials: 'include',
      });
      
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  const title = lang === 'mg' ? ad?.title : ad?.titleFr;
  const description = lang === 'mg' ? ad?.description : ad?.descriptionFr;

  return (
    <AnimatePresence>
      {isVisible && ad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={handleAdClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-lg w-full bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={ad.imageUrl} 
              alt={title}
              className="w-full h-auto max-h-[70vh] object-contain"
            />
            
            <div className="p-6 text-center">
              <h2 className="text-xl font-bold font-display mb-2">{title}</h2>
              {description && (
                <p className="text-muted-foreground text-sm mb-4">{description}</p>
              )}
              {ad.linkUrl && (
                <button
                  onClick={handleAdClick}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold text-sm"
                >
                  En savoir plus
                </button>
              )}
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}