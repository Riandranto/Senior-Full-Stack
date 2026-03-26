import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './use-websocket';

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
  const { sendMessage, lastMessage, connected } = useWebSocket();
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
        setMessages(history.map((msg: any) => ({ ...msg, isOwn: msg.from === currentUserId })));
        setUnreadCount(history.filter((msg: any) => !msg.isRead && msg.from !== currentUserId).length);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [rideId, currentUserId]);

  // Scroll automatique vers le bas
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Envoyer un message
  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim() || !connected) return;

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

    sendMessage({
      type: 'chat',
      payload: {
        toUserId: 0, // Sera déterminé par le backend
        message: message.trim(),
        rideId,
        fromName: 'Moi'
      }
    });

    // Simuler l'envoi réussi après un court délai
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId ? { ...msg, id: undefined } : msg
        )
      );
    }, 500);
  }, [currentUserId, rideId, connected, sendMessage, scrollToBottom]);

  // Écouter les messages entrants
  useEffect(() => {
    if (lastMessage?.type === 'CHAT_MESSAGE') {
      const payload = lastMessage.payload;
      if (payload.rideId === rideId) {
        const isOwn = payload.from === currentUserId;
        const newMessage: ChatMessage = {
          from: payload.from,
          fromName: payload.fromName || (isOwn ? 'Moi' : otherUserName || 'Utilisateur'),
          message: payload.message,
          rideId: payload.rideId,
          timestamp: payload.timestamp || new Date().toISOString(),
          isOwn,
          isRead: isOwn
        };

        setMessages(prev => {
          // Vérifier si le message existe déjà
          const exists = prev.some(m => 
            m.from === newMessage.from && 
            m.message === newMessage.message && 
            Math.abs(new Date(m.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 1000
          );
          if (exists) return prev;
          
          if (!isOwn) {
            setUnreadCount(prevCount => prevCount + 1);
          }
          return [...prev, newMessage];
        });
        scrollToBottom();
      }
    }
  }, [lastMessage, rideId, currentUserId, otherUserName, scrollToBottom]);

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