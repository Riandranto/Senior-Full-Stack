import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type User } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  // Vérification de l'authentification
  const { data: user, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      try {
        console.log('🔍 Checking authentication...');
        const res = await apiFetch(api.auth.me.path);
        
        if (res.status === 401) {
          console.log('👤 No active session');
          return null;
        }
        
        if (!res.ok) {
          console.log(`Auth check failed with status ${res.status}`);
          return null;
        }
        
        const userData = await res.json();
        console.log('✅ User authenticated:', userData);
        return userData;
      } catch (e) {
        console.error("Auth check failed:", e);
        return null;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Demande d'OTP
  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      console.log('📞 Requesting OTP for:', phone);
      const res = await apiFetch(api.auth.requestOtp.path, {
        method: api.auth.requestOtp.method,
        body: JSON.stringify({ phone }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.message || (lang === 'mg' 
          ? "Tsy afaka nandefa kaody"
          : "Échec de l'envoi du code"
        ));
      }
      
      return data;
    },
    onSuccess: (_, phone) => {
      toast({
        title: lang === 'mg' ? "Kaody nalefa!" : "Code envoyé!",
        description: lang === 'mg' 
          ? `Kaody 6 tarehimarika nalefa tany ${phone}`
          : `Code à 6 chiffres envoyé au ${phone}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
      });
    },
  });

  // Vérification OTP et connexion
  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; otp: string }) => {
      console.log('🔐 Attempting login for:', data.phone);
      
      const res = await apiFetch(api.auth.verifyOtp.path, {
        method: api.auth.verifyOtp.method,
        body: JSON.stringify(data),
      });
      
      console.log('📦 Login response status:', res.status);
      
      if (!res.ok) {
        let errorMessage = lang === 'mg' ? "Tsy afaka niditra" : "Échec de connexion";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }
      
      const result = await res.json();
      console.log('✅ Login response:', result);
      return result;
    },
    onSuccess: async (data) => {
      console.log('✅ Login successful, user:', data.user);
      
      // Stocker l'utilisateur dans localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Mettre à jour le cache React Query
      queryClient.setQueryData([api.auth.me.path], data.user);
      
      // Forcer un refetch immédiat
      await refetch();
      
      toast({
        title: lang === 'mg' ? "Tafiditra!" : "Connecté!",
        description: lang === 'mg' 
          ? "Tonga soa eto Farady"
          : "Bienvenue sur Farady",
      });
      
      // Redirection basée sur le rôle
      if (data.user.role === 'ADMIN') {
        window.location.href = '/admin';
      } else if (data.user.role === 'DRIVER') {
        window.location.href = '/driver';
      } else {
        window.location.href = '/passenger';
      }
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

  // Déconnexion
  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log('🚪 Logging out...');
      const res = await apiFetch(api.auth.logout.path, { 
        method: api.auth.logout.method,
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Logout failed");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      localStorage.removeItem('user');
      
      toast({
        title: lang === 'mg' ? "Tafivoaka" : "Déconnecté",
      });
      
      window.location.href = '/login';
    },
    onError: (error: Error) => {
      console.error('Logout error:', error);
      window.location.href = '/login';
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !user?.isBlocked,
    login: loginMutation.mutateAsync,
    requestOtp: requestOtpMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isRequestOtpPending: requestOtpMutation.isPending,
    refetch,
  };
}