// components/ChatBox.tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, X, User, ChevronUp, ChevronDown } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { useTranslation } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatBoxProps {
  rideId: number;
  currentUserId: number;
  otherUserId: number;
  otherUserName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatBox({
  rideId,
  currentUserId,
  otherUserId,
  otherUserName,
  isOpen,
  onClose,
}: ChatBoxProps) {
  const { t, lang } = useTranslation();
  const [message, setMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const { messages, sendMessage, connected, isSending, loadHistory } = useChat(rideId, currentUserId, otherUserName);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Recharger l'historique périodiquement
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      loadHistory();
    }, 5000); // Rafraîchir toutes les 5 secondes
    
    return () => clearInterval(interval);
  }, [isOpen, loadHistory]);

  const handleSend = () => {
    if (message.trim() && !isSending && connected) {
      const success = sendMessage(message);
      if (success) {
        setMessage('');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
              className="rounded-full w-7 h-7"
            >
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

        {/* Messages - seulement si non minimisé */}
        {!isMinimized && (
          <>
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
          </>
        )}
      </Card>
    </motion.div>
  );
}