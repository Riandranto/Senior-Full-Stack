import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, User, CheckCheck, Clock, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChat, ChatMessage } from '@/hooks/use-chat';
import { useTranslation } from '@/lib/i18n';
import { formatDistanceToNow } from 'date-fns';
import { fr, mg } from 'date-fns/locale';

interface ChatBoxProps {
  rideId: number;
  currentUserId: number;
  otherUserId: number;
  otherUserName: string;
  isOpen?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
}

export default function ChatBox({ 
  rideId, 
  currentUserId, 
  otherUserId,
  otherUserName,
  isOpen = true,
  onClose,
  onMinimize
}: ChatBoxProps) {
  const { t, lang } = useTranslation();
  const { messages, sendMessage, unreadCount, markAsRead, messagesEndRef, connected } = useChat(
    rideId, 
    currentUserId, 
    otherUserName
  );
  const [text, setText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const dateLocale = lang === 'mg' ? mg : fr;

  // Formater l'heure
  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: dateLocale });
    } catch {
      return '';
    }
  };

  // Gérer l'envoi du message
  const handleSend = useCallback(() => {
    if (text.trim()) {
      sendMessage(text.trim());
      setText('');
      
      // Marquer comme lu quand on envoie un message
      markAsRead();
    }
  }, [text, sendMessage, markAsRead]);

  // Gérer la touche Entrée
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Gérer l'indicateur de frappe
  const handleTyping = (value: string) => {
    setText(value);
    if (!isTyping) {
      setIsTyping(true);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  // Marquer comme lu quand le chat est ouvert
  useEffect(() => {
    if (isOpen && !isMinimized) {
      markAsRead();
    }
  }, [isOpen, isMinimized, markAsRead]);

  // Nettoyer le timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  // Version minimisée
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="relative bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:bg-primary/90 transition-all"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      transition={{ type: "spring", damping: 25 }}
      className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] z-50 bg-background rounded-2xl shadow-2xl border overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-white/20">
              <AvatarFallback className="bg-white/20 text-white">
                {otherUserName?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold">{otherUserName}</h3>
              <div className="flex items-center gap-1 text-xs text-primary-foreground/80">
                {connected ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>{lang === 'mg' ? 'Mifandray' : 'Connecté'}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>{lang === 'mg' ? 'Tsy mifandray' : 'Déconnecté'}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-white/20 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-96 p-4 bg-gradient-to-b from-background to-muted/20">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center p-8"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {lang === 'mg' 
                  ? 'Mandehana ny resaka amin\'ny mpamily'
                  : 'Commencez la conversation avec le conducteur'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: ChatMessage, idx: number) => (
                <motion.div
                  key={msg.id || idx}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${msg.isOwn ? 'order-2' : 'order-1'}`}>
                    <div className={`rounded-2xl px-4 py-2 ${
                      msg.isOwn 
                        ? 'bg-primary text-primary-foreground rounded-br-none' 
                        : 'bg-muted rounded-bl-none'
                    }`}>
                      <p className="text-sm break-words">{msg.message}</p>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${
                      msg.isOwn ? 'justify-end' : 'justify-start'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.isOwn && (
                        <CheckCheck className={`w-3 h-3 ${msg.isRead ? 'text-green-500' : 'text-muted-foreground'}`} />
                      )}
                    </div>
                  </div>
                  {!msg.isOwn && (
                    <div className="order-0 mr-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {otherUserName?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </motion.div>
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={lang === 'mg' ? 'Soraty ny hafatrao...' : 'Écrivez votre message...'}
            className="flex-1 rounded-full"
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || !connected}
            size="icon"
            className="rounded-full w-10 h-10"
          >
            {connected ? (
              <Send className="w-4 h-4" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
          </Button>
        </div>
        {!connected && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {lang === 'mg' 
              ? 'Miandry fampifandraisana...'
              : 'Connexion en cours...'}
          </p>
        )}
      </div>
    </motion.div>
  );
}