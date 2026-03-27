// src/hooks/use-chat.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';

export interface ChatMessage {
  id?: string;
  from: number;
  fromName: string;
  message: string;
  rideId: number;
  timestamp: string;
  isRead?: boolean;
  isOwn?: boolean;
}

export function useChat(rideId: number, currentUserId: number, otherUserName?: string) {
  const { sendMessage, subscribe, connected } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessagesLength = useRef(0);
  const lastMessageTimeRef = useRef<number>(0);

  // Charger l'historique des messages - CORRIGÉ
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/history/${rideId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const history = await res.json();
        console.log('📜 Chat history loaded:', history.length, 'messages');
        
        const formattedMessages = history.map((msg: any) => ({ 
          ...msg, 
          isOwn: msg.from === currentUserId,
          fromName: msg.from === currentUserId ? 'Moi' : (otherUserName || 'Chauffeur')
        }));
        
        setMessages(prev => {
          // Vérifier si les messages ont changé
          if (prev.length === formattedMessages.length && 
              prev.every((m, i) => m.id === formattedMessages[i].id)) {
            return prev;
          }
          return formattedMessages;
        });
        
        setUnreadCount(history.filter((msg: any) => !msg.isRead && msg.from !== currentUserId).length);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [rideId, currentUserId, otherUserName]);

  // Scroll automatique vers le bas
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Envoyer un message - CORRIGÉ
  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim()) {
      return false;
    }
    
    if (!connected) {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy mifandray" : "Déconnecté",
        description: lang === 'mg' 
          ? "Tsy afaka mandefa hafatra"
          : "Impossible d'envoyer le message",
      });
      return false;
    }

    if (isSending) {
      return false;
    }

    setIsSending(true);
    
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    const tempMessage: ChatMessage = {
      id: tempId,
      from: currentUserId,
      fromName: 'Moi',
      message: message.trim(),
      rideId,
      timestamp: now,
      isOwn: true
    };

    // Ajouter le message immédiatement
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    // Envoyer via WebSocket
    const success = sendMessage({
      type: 'CHAT_MESSAGE',
      payload: {
        rideId,
        message: message.trim(),
        fromName: otherUserName || 'Utilisateur',
        from: currentUserId,
        toUserId: 0,
        timestamp: now
      }
    });

    if (!success) {
      // Supprimer le message temporaire en cas d'échec
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: lang === 'mg' 
          ? "Tsy afaka nandefa hafatra"
          : "Impossible d'envoyer le message",
      });
    } else {
      // Marquer comme non lu pour l'autre utilisateur
      setUnreadCount(prev => prev + 1);
    }
    
    setTimeout(() => setIsSending(false), 500);
    return success;
  }, [currentUserId, rideId, connected, sendMessage, scrollToBottom, otherUserName, toast, lang, isSending]);

  // Écouter les messages entrants via WebSocket - CORRIGÉ
  useEffect(() => {
    const unsubscribe = subscribe('CHAT_MESSAGE', (payload: any) => {
      console.log('📨 Chat message received:', payload);
      
      if (payload.rideId === rideId) {
        const isOwn = payload.from === currentUserId;
        
        // Éviter les doublons
        const messageId = payload.id || `${payload.from}-${payload.timestamp}`;
        const exists = messages.some(m => 
          m.id === messageId || 
          (m.from === payload.from && 
           m.message === payload.message && 
           Math.abs(new Date(m.timestamp).getTime() - new Date(payload.timestamp || Date.now()).getTime()) < 2000)
        );
        
        if (exists) {
          console.log('Message already exists, skipping');
          return;
        }
        
        const newMessage: ChatMessage = {
          id: messageId,
          from: payload.from,
          fromName: isOwn ? 'Moi' : (payload.fromName || otherUserName || 'Chauffeur'),
          message: payload.message,
          rideId: payload.rideId,
          timestamp: payload.timestamp || new Date().toISOString(),
          isOwn,
          isRead: isOwn
        };

        setMessages(prev => {
          // Vérifier encore une fois avant d'ajouter
          if (prev.some(m => m.id === messageId)) {
            return prev;
          }
          
          if (!isOwn) {
            setUnreadCount(prevCount => prevCount + 1);
          }
          
          return [...prev, newMessage];
        });
        
        scrollToBottom();
        
        // Invalider le cache
        queryClient.invalidateQueries({ queryKey: ['/api/chat/history', rideId] });
      }
    });
    
    return () => unsubscribe();
  }, [rideId, currentUserId, otherUserName, messages, subscribe, scrollToBottom, queryClient]);

  // Charger l'historique au montage
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Polling toutes les 2 secondes pour les mises à jour (fallback)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadHistory();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [loadHistory]);

  // Scroll automatique quand les messages changent
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      scrollToBottom();
    }
    previousMessagesLength.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Marquer les messages comme lus
  const markAsRead = useCallback(async () => {
    if (unreadCount > 0) {
      try {
        await fetch(`/api/chat/mark-read/${rideId}`, {
          method: 'POST',
          credentials: 'include'
        });
        setUnreadCount(0);
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    }
  }, [rideId, unreadCount]);

  return {
    messages,
    sendMessage: sendChatMessage,
    unreadCount,
    markAsRead,
    messagesEndRef,
    connected,
    isSending,
    loadHistory
  };
}