import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface RefreshIndicatorProps {
  isRefreshing: boolean;
  text?: string;
}

export const RefreshIndicator = ({ isRefreshing, text = 'Mise à jour...' }: RefreshIndicatorProps) => (
  <AnimatePresence>
    {isRefreshing && (
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-primary/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </motion.div>
          <span className="text-white text-xs font-medium">{text}</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);