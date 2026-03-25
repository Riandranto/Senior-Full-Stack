import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';

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
}

export function AdBanner({ position, onClose }: AdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { lang } = useTranslation();

  const fetchAds = useCallback(async () => {
    try {
      const userRole = user?.role || 'ALL';
      const res = await fetch(`/api/ads?screen=${position}&userRole=${userRole}`, {
        credentials: 'include',
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      setAds(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch ads:', error);
      setIsLoading(false);
    }
  }, [position, user?.role]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Carousel automatique
  useEffect(() => {
    if (ads.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [ads.length]);

  const handleAdClick = async (ad: Ad) => {
    if (ad.linkUrl) {
      try {
        // Enregistrer le clic
        await fetch(`/api/ads/${ad.id}/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screen: position }),
          credentials: 'include',
        });
        
        // Ouvrir le lien dans un nouvel onglet
        window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        console.error('Error recording ad click:', error);
      }
    }
  };

  if (isLoading || ads.length === 0 || !isVisible) return null;

  const currentAd = ads[currentIndex];
  const title = lang === 'mg' ? currentAd.title : currentAd.titleFr;
  const description = lang === 'mg' ? currentAd.description : currentAd.descriptionFr;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative w-full rounded-2xl overflow-hidden shadow-lg mb-3"
      >
        {/* Image de fond */}
        <div 
          className="relative w-full cursor-pointer"
          onClick={() => handleAdClick(currentAd)}
        >
          <img 
            src={currentAd.imageUrl} 
            alt={title}
            className="w-full h-32 md:h-40 object-cover"
          />
          
          {/* Overlay avec texte */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-3">
            <h3 className="text-white font-bold text-sm md:text-base">
              {title}
            </h3>
            {description && (
              <p className="text-white/80 text-xs mt-1 line-clamp-2">
                {description}
              </p>
            )}
            {currentAd.linkUrl && (
              <div className="flex items-center gap-1 mt-2 text-white/70 text-xs">
                <ExternalLink className="w-3 h-3" />
                <span>En savoir plus</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Bouton fermer */}
        {onClose && (
          <button
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
            className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
        
        {/* Indicateurs de carousel */}
        {ads.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentIndex 
                    ? 'w-4 bg-white' 
                    : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}