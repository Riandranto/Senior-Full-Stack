// src/hooks/use-chat.ts - Version corrigée

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

export interface ChatMessage {
  id?: number;
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

  // Charger l'historique des messages - AMÉLIORÉ
  const loadHistory = useCallback(async () => {
    try {
      console.log('📜 Loading chat history for ride:', rideId);
      const res = await apiFetch(`/api/chat/history/${rideId}`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const history = await res.json();
        console.log('📜 Chat history loaded:', history.length, 'messages');
        
        const formattedMessages = history.map((msg: any) => ({ 
          id: msg.id,
          from: msg.from,
          fromName: msg.from === currentUserId ? 'Moi' : (otherUserName || msg.fromName || 'Chauffeur'),
          message: msg.message,
          rideId: msg.rideId,
          timestamp: msg.timestamp,
          isOwn: msg.from === currentUserId
        }));
        
        setMessages(formattedMessages);
        setUnreadCount(history.filter((msg: any) => !msg.isRead && msg.from !== currentUserId).length);
      } else {
        console.warn('Failed to load chat history:', res.status);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [rideId, currentUserId, otherUserName]);

  // Scroll automatique
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Envoyer un message - AVEC SAUVEGARDE API
  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim()) return false;
    if (isSending) return false;
  
    setIsSending(true);
    
    try {
      // 1. Sauvegarder via API REST
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId,
          message: message.trim(),
          toUserId: otherUserId,
          fromName: otherUserName
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const savedMessage = await response.json();
      
      // 2. Ajouter au state local
      const newMessage: ChatMessage = {
        id: savedMessage.id,
        from: currentUserId,
        fromName: 'Moi',
        message: message.trim(),
        rideId,
        timestamp: savedMessage.createdAt || new Date().toISOString(),
        isOwn: true
      };
      
      setMessages(prev => [...prev, newMessage]);
      scrollToBottom();
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: lang === 'mg' 
          ? "Tsy afaka nandefa hafatra"
          : "Impossible d'envoyer le message",
      });
      return false;
    } finally {
      setIsSending(false);
    }
  }, [currentUserId, rideId, otherUserId, otherUserName, scrollToBottom, toast, lang, isSending]);

  // Écouter les messages entrants
  useEffect(() => {
    const unsubscribe = subscribe('CHAT_MESSAGE', (payload: any) => {
      console.log('📨 Chat message received:', payload);
      
      if (payload.rideId === rideId) {
        const isOwn = payload.from === currentUserId;
        
        // Vérifier les doublons
        const exists = messages.some(m => 
          m.id === payload.id || 
          (m.from === payload.from && 
           m.message === payload.message && 
           Math.abs(new Date(m.timestamp).getTime() - new Date(payload.timestamp).getTime()) < 2000)
        );
        
        if (exists) return;
        
        const newMessage: ChatMessage = {
          id: payload.id,
          from: payload.from,
          fromName: isOwn ? 'Moi' : (payload.fromName || otherUserName || 'Chauffeur'),
          message: payload.message,
          rideId: payload.rideId,
          timestamp: payload.timestamp,
          isOwn
        };

        setMessages(prev => [...prev, newMessage]);
        
        if (!isOwn) {
          setUnreadCount(prev => prev + 1);
        }
        
        scrollToBottom();
      }
    });
    
    return () => unsubscribe();
  }, [rideId, currentUserId, otherUserName, messages, subscribe, scrollToBottom]);

  // Charger l'historique au montage
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Polling toutes les 3 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadHistory();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [loadHistory]);

  // Scroll automatique
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      scrollToBottom();
    }
    previousMessagesLength.current = messages.length;
  }, [messages.length, scrollToBottom]);

  const markAsRead = useCallback(async () => {
    if (unreadCount > 0) {
      try {
        await apiFetch(`/api/chat/mark-read/${rideId}`, {
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