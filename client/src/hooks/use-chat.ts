// src/hooks/use-chat.ts - Version complète et fonctionnelle

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useTranslation } from '@/lib/i18n';

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

export function useChat(rideId: number, currentUserId: number, otherUserName?: string, otherUserId?: number) {
  const { sendMessage, subscribe, connected } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessagesLength = useRef(0);
  const lastRefreshRef = useRef<number>(Date.now());

  // Charger l'historique des messages
  const loadHistory = useCallback(async () => {
    if (!rideId) return;
    
    try {
      const res = await fetch(`/api/chat/history/${rideId}`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const history = await res.json();
        
        const formattedMessages = history.map((msg: any) => ({ 
          id: msg.id,
          from: msg.from,
          fromName: msg.from === currentUserId ? 'Moi' : (otherUserName || msg.fromName || 'Chauffeur'),
          message: msg.message,
          rideId: msg.rideId,
          timestamp: msg.timestamp,
          isOwn: msg.from === currentUserId,
          isRead: msg.isRead
        }));
        
        setMessages(formattedMessages);
        const unread = history.filter((msg: any) => !msg.isRead && msg.from !== currentUserId).length;
        setUnreadCount(unread);
        lastRefreshRef.current = Date.now();
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

  // Envoyer un message
  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim()) return false;
    if (isSending) return false;
    
    // Message temporaire pour l'UI
    const tempId = Date.now();
    const tempMessage: ChatMessage = {
      id: tempId,
      from: currentUserId,
      fromName: 'Moi',
      message: message.trim(),
      rideId,
      timestamp: new Date().toISOString(),
      isOwn: true
    };
    
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();
    
    setIsSending(true);
    
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId,
          message: message.trim(),
          toUserId: otherUserId || 0,
          fromName: otherUserName
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const savedMessage = await response.json();
      
      // Remplacer le message temporaire par le vrai
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...savedMessage, fromName: 'Moi', isOwn: true } : m
      ));
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      // Supprimer le message temporaire en cas d'erreur
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
          // Notification toast pour les nouveaux messages
          if (document.visibilityState !== 'visible') {
            toast({
              title: lang === 'mg' ? "Hafatra vaovao" : "Nouveau message",
              description: `${newMessage.fromName}: ${newMessage.message.substring(0, 50)}${newMessage.message.length > 50 ? '...' : ''}`,
            });
          }
        }
        
        scrollToBottom();
      }
    });
    
    return () => unsubscribe();
  }, [rideId, currentUserId, otherUserName, messages, subscribe, scrollToBottom, toast, lang]);

  // Charger l'historique au montage
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Polling pour les messages (fallback si WebSocket est down)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshRef.current > 3000) {
        loadHistory();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadHistory]);

  // Scroll automatique quand les messages changent
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      scrollToBottom();
    }
    previousMessagesLength.current = messages.length;
  }, [messages.length, scrollToBottom]);

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