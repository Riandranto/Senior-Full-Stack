// src/components/AdBanner.tsx - Version corrigée
import { useState, useEffect, memo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface Ad {
  id: number;
  title: string;
  titleFr: string;
  description: string | null;
  descriptionFr: string | null;
  imageUrl: string;
  linkUrl: string | null;
  type: string;
  position: string;
  priority: number;
  isActive: boolean;
}

interface AdBannerProps {
  position: 'HOME_TOP' | 'HOME_BOTTOM' | 'RIDE_SCREEN' | 'PROFILE';
  onClose?: () => void;
  autoCloseable?: boolean;
}

export const AdBanner = memo(function AdBanner({ position, onClose }: AdBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { user } = useAuth();
  const { lang } = useTranslation();
  const intervalRef = useRef<NodeJS.Timeout>();
  const fetchedRef = useRef(false);

  const { data: ads = [], isLoading, error } = useQuery<Ad[]>({
    queryKey: ['ads', position, user?.role || 'ALL'],
    queryFn: async () => {
      if (fetchedRef.current) return [];
      fetchedRef.current = true;
      const userRole = user?.role || 'ALL';
      const res = await apiFetch(`/api/ads?screen=${position}&userRole=${userRole}`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    enabled: isVisible,
  });

  // Rotation des publicités
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ads.length <= 1 || !isVisible) return;
    
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ads.length, isVisible]);

  // Gestion du clic sur une publicité
  const handleAdClick = useCallback(async (ad: Ad) => {
    if (ad.linkUrl) {
      try {
        await fetch(`/api/ads/${ad.id}/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screen: position }),
          credentials: 'include',
        });
        window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        console.error('Error recording ad click:', error);
      }
    }
  }, [position]);

  // Fermeture manuelle
  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (onClose) onClose();
  }, [onClose]);

  if (isLoading || ads.length === 0 || !isVisible || error) return null;

  const currentAd = ads[currentIndex];
  const title = lang === 'mg' ? currentAd.title : currentAd.titleFr;
  const description = lang === 'mg' ? currentAd.description : currentAd.descriptionFr;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="relative w-full rounded-2xl overflow-hidden shadow-lg mb-3"
        >
          <div
            className="relative w-full cursor-pointer"
            onClick={() => handleAdClick(currentAd)}
          >
            <img
              src={currentAd.imageUrl}
              alt={title}
              className="w-full h-32 md:h-40 object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-3">
              <h3 className="text-white font-bold text-sm md:text-base">{title}</h3>
              {description && (
                <p className="text-white/80 text-xs mt-1 line-clamp-2">{description}</p>
              )}
              {currentAd.linkUrl && (
                <div className="flex items-center gap-1 mt-2 text-white/70 text-xs">
                  <ExternalLink className="w-3 h-3" />
                  <span>En savoir plus</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors z-10"
            aria-label="Fermer la publicité"
          >
            <X className="w-3 h-3 text-white" />
          </button>
          {ads.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {ads.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentIndex ? 'w-4 bg-white' : 'bg-white/50'
                  }`}
                  aria-label={`Aller à la publicité ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});