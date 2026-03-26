import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import { useQueryClient } from '@tanstack/react-query';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessagesLength = useRef(0);

  // Charger l'historique des messages
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/history/${rideId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const history = await res.json();
        const formattedMessages = history.map((msg: any) => ({ 
          ...msg, 
          isOwn: msg.from === currentUserId 
        }));
        setMessages(formattedMessages);
        setUnreadCount(history.filter((msg: any) => !msg.isRead && msg.from !== currentUserId).length);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [rideId, currentUserId]);

  // Scroll automatique vers le bas
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Envoyer un message
  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim()) {
      console.warn('Message vide, non envoyé');
      return false;
    }
    
    if (!connected) {
      console.warn('WebSocket non connecté, impossible d\'envoyer le message');
      return false;
    }

    console.log('📤 Sending chat message:', { rideId, message });
    
    const tempId = Date.now().toString();
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

    const success = sendMessage({
      type: 'chat',
      payload: {
        rideId,
        message: message.trim(),
        fromName: otherUserName || 'Utilisateur'
      }
    });

    if (!success) {
      console.error('Échec d\'envoi du message');
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      return false;
    }

    return true;
  }, [currentUserId, rideId, connected, sendMessage, scrollToBottom, otherUserName]);

  // Écouter les messages entrants via WebSocket
  useEffect(() => {
    const unsubscribe = subscribe('CHAT_MESSAGE', (payload: any) => {
      console.log('📨 Chat message received:', payload);
      
      if (payload.rideId === rideId) {
        const isOwn = payload.from === currentUserId;
        
        // Vérifier si le message existe déjà
        const exists = messages.some(m => 
          m.from === payload.from && 
          m.message === payload.message && 
          Math.abs(new Date(m.timestamp).getTime() - new Date(payload.timestamp || Date.now()).getTime()) < 1000
        );
        
        if (exists) return;
        
        const newMessage: ChatMessage = {
          id: payload.id || Date.now().toString(),
          from: payload.from,
          fromName: payload.fromName || (isOwn ? 'Moi' : otherUserName || 'Chauffeur'),
          message: payload.message,
          rideId: payload.rideId,
          timestamp: payload.timestamp || new Date().toISOString(),
          isOwn,
          isRead: isOwn
        };

        setMessages(prev => {
          if (!isOwn) {
            setUnreadCount(prevCount => prevCount + 1);
          }
          return [...prev, newMessage];
        });
        
        scrollToBottom();
        
        // Recharger l'historique pour être sûr
        if (!isOwn) {
          loadHistory();
        }
      }
    });
    
    return () => unsubscribe();
  }, [rideId, currentUserId, otherUserName, messages, subscribe, scrollToBottom, loadHistory]);

  // Charger l'historique au montage
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Scroll automatique quand de nouveaux messages arrivent
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
        
        sendMessage({
          type: 'mark_read',
          payload: { rideId }
        });
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    }
  }, [rideId, unreadCount, sendMessage]);

  return {
    messages,
    sendMessage: sendChatMessage,
    isTyping,
    unreadCount,
    markAsRead,
    messagesEndRef,
    connected
  };
}