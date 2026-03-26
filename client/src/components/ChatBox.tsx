// components/ChatBox.tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, X, User } from 'lucide-react';
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
  const { messages, sendMessage, connected, isSending } = useChat(rideId, currentUserId, otherUserName);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (message.trim() && !isSending) {
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
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      <Card className="rounded-t-3xl shadow-2xl border-0 bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{otherUserName}</h3>
              <p className="text-xs text-muted-foreground">
                {connected ? 
                  (lang === 'mg' ? 'Mifandray' : 'Connecté') : 
                  (lang === 'mg' ? 'Tsy mifandray' : 'Déconnecté')
                }
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {lang === 'mg' 
                ? 'Tsy mbola misy hafatra. Atombohy ny resaka!'
                : 'Aucun message. Commencez la conversation!'
              }
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    msg.isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-foreground'
                  }`}
                >
                  <p className="text-sm break-words">{msg.message}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={lang === 'mg' ? 'Soraty ny hafatrao...' : 'Écrivez votre message...'}
            className="flex-1 rounded-full"
            disabled={!connected}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !connected || isSending}
            className="rounded-full w-10 h-10 p-0"
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