// components/ChatBox.tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, X, User, ChevronUp, ChevronDown, Phone, MessageCircle } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { useTranslation } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatBoxProps {
  rideId: number;
  currentUserId: number;
  otherUserId: number;
  otherUserName: string;
  otherUserPhone?: string;
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onNewMessage?: () => void;
  minimized?: boolean;
}

export default function ChatBox({
  rideId,
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserPhone,
  isOpen,
  onClose,
  onMinimize,
  onNewMessage,
  minimized = false,
}: ChatBoxProps) {
  const { t, lang } = useTranslation();
  const [message, setMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const { messages, sendMessage, connected, isSending, messagesEndRef, unreadCount } = useChat(
    rideId, 
    currentUserId, 
    otherUserName,
    otherUserId
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Mettre à jour le compteur de messages non lus localement
  useEffect(() => {
    if (unreadCount > 0 && isMinimized) {
      setLocalUnreadCount(prev => prev + unreadCount);
      onNewMessage?.();
    }
  }, [unreadCount, isMinimized, onNewMessage]);

  // Réinitialiser le compteur quand le chat est ouvert
  useEffect(() => {
    if (!isMinimized && isOpen) {
      setLocalUnreadCount(0);
    }
  }, [isMinimized, isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSend = () => {
    if (message.trim() && !isSending && connected) {
      sendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    onMinimize?.();
  };

  const handleRestore = () => {
    setIsMinimized(false);
    setLocalUnreadCount(0);
  };

  if (!isOpen) return null;

  // Mode minimisé - afficher uniquement une icône
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-20 right-4 z-50"
      >
        <div className="relative">
          {localUnreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
            >
              {localUnreadCount > 9 ? '9+' : localUnreadCount}
            </motion.div>
          )}
          <Button
            onClick={handleRestore}
            className="w-12 h-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // Mode normal - afficher le chat complet
  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed bottom-20 right-4 left-4 z-50 md:left-auto md:right-4 md:w-96"
    >
      <Card className="rounded-2xl shadow-2xl border bg-background/95 backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{otherUserName}</h3>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <p className="text-[10px] text-muted-foreground">
                  {connected ? 
                    (lang === 'mg' ? 'Mifandray' : 'Connecté') : 
                    (lang === 'mg' ? 'Tsy mifandray' : 'Déconnecté')
                  }
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {otherUserPhone && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = `tel:${otherUserPhone}`}
                className="rounded-full w-7 h-7"
                title={lang === 'mg' ? 'Antsoy' : 'Appeler'}
              >
                <Phone className="w-4 h-4 text-green-600" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMinimize}
              className="rounded-full w-7 h-7"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full w-7 h-7 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-3 space-y-2 bg-background">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              {lang === 'mg' 
                ? 'Tsy mbola misy hafatra. Atombohy ny resaka!'
                : 'Aucun message. Commencez la conversation!'
              }
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id || `msg-${msg.timestamp}-${msg.from}`}
                className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    msg.isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary/80 text-foreground rounded-bl-none'
                  }`}
                >
                  {!msg.isOwn && (
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                      {msg.fromName}
                    </p>
                  )}
                  <p className="text-sm break-words">{msg.message}</p>
                  <p className={`text-[10px] mt-0.5 ${msg.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t flex gap-2 bg-background">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={lang === 'mg' ? 'Soraty ny hafatrao...' : 'Écrivez votre message...'}
            className="flex-1 rounded-full text-sm h-9"
            disabled={!connected}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !connected || isSending}
            className="rounded-full w-9 h-9 p-0 shrink-0"
            size="sm"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}