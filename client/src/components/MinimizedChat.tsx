// src/components/MinimizedChat.tsx
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimizedChatProps {
  unreadCount: number;
  onOpen: () => void;
  onClose?: () => void;
  isVisible?: boolean;
}

export function MinimizedChat({ unreadCount, onOpen, onClose, isVisible = true }: MinimizedChatProps) {
  if (!isVisible) return null;
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed bottom-20 right-4 z-50"
    >
      <div className="relative">
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
        <Button
          onClick={onOpen}
          className="w-12 h-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    </motion.div>
  );
}