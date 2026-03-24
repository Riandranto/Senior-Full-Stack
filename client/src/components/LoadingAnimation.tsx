import { motion } from 'framer-motion';
import { Car } from 'lucide-react';

export const LoadingAnimation = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="flex flex-col items-center justify-center h-full"
  >
    <motion.div
      animate={{ 
        y: [0, -10, 0],
        rotate: [0, 5, -5, 0]
      }}
      transition={{ 
        y: { duration: 1, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
      }}
    >
      <Car className="w-16 h-16 text-primary" />
    </motion.div>
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-4 text-sm text-muted-foreground font-medium"
    >
      Chargement en cours...
    </motion.p>
  </motion.div>
);

export const RefreshIndicator = ({ isRefreshing }: { isRefreshing: boolean }) => (
  <AnimatePresence>
    {isRefreshing && (
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-primary/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </motion.div>
          <span className="text-white text-xs font-medium">Mise à jour...</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);