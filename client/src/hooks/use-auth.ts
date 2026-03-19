import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type User } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      console.log('🔍 Fetching user session...');
      const res = await fetch(api.auth.me.path, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      console.log('📡 Session response status:', res.status);
      
      if (!res.ok) {
        if (res.status === 401) {
          console.log('👤 No active session');
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      
      const userData = await res.json();
      console.log('✅ User session found:', userData);
      return userData;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; otp: string }) => {
      console.log('🔐 Login attempt for:', data.phone);
      const res = await fetch(api.auth.verifyOtp.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      const result = await res.json();
      console.log('📦 Login response:', result);
      console.log('📦 Session cookie:', document.cookie);

      if (!res.ok) {
        throw new Error(result.message);
      }

      return result;
    },
    onSuccess: (data) => {
      console.log('✅ Login successful, user:', data.user);
      queryClient.setQueryData([api.auth.me.path], data.user);
      toast({
        title: lang === 'mg' ? "Tonga soa!" : "Bienvenue!",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Login failed:', error);
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
      });
    },
  });

  return {
    user,
    isLoading,
    login: loginMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    logout: () => {
      // Logout implementation
    }
  };
}