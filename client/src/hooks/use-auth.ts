import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type User } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  // Vérification de l'authentification avec retry limité
  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.auth.me.path, { 
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (res.status === 401) {
          // Pas authentifié - pas d'erreur, juste null
          return null;
        }
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Erreur d'authentification");
        }
        
        return res.json();
      } catch (e) {
        // En cas d'erreur réseau, on retourne null mais on log
        console.error("Auth check failed:", e);
        return null;
      }
    },
    retry: 1, // Réessayer une fois en cas d'erreur réseau
    staleTime: 5 * 60 * 1000, // 5 minutes avant de revalider
    refetchOnWindowFocus: false, // Éviter les refetch intempestifs
  });

  // Demande d'OTP avec validation du numéro
  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      // Validation du numéro malgache
      const phoneRegex = /^(0|\\+261)[0-9]{9}$/;
      if (!phoneRegex.test(phone)) {
        throw new Error(lang === 'mg' 
          ? "Laharana tsy mety. Ampidiro 0341234567 na +261341234567"
          : "Numéro invalide. Entrez 0341234567 ou +261341234567"
        );
      }

      const res = await fetch(api.auth.requestOtp.path, {
        method: api.auth.requestOtp.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
        credentials: "include",
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        // Messages d'erreur spécifiques
        if (res.status === 429) {
          throw new Error(lang === 'mg'
            ? "Bebe loatra ny fangatahana. Andraso kely."
            : "Trop de demandes. Veuillez patienter."
          );
        }
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

  // Vérification OTP avec gestion des tentatives
  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; otp: string }) => {
      // Validation OTP (6 chiffres)
      if (!/^\d{6}$/.test(data.otp)) {
        throw new Error(lang === 'mg'
          ? "Kaody tsy mety. 6 tarehimarika no ilaina."
          : "Code invalide. 6 chiffres requis."
        );
      }

      const res = await fetch(api.auth.verifyOtp.path, {
        method: api.auth.verifyOtp.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      const result = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        // Messages d'erreur spécifiques
        if (res.status === 429) {
          throw new Error(lang === 'mg'
            ? "Bebe loatra ny andrana. Andraso 15 minitra."
            : "Trop de tentatives. Attendez 15 minutes."
          );
        }
        if (res.status === 401) {
          throw new Error(lang === 'mg'
            ? "Kaody disy na lany daty"
            : "Code incorrect ou expiré"
          );
        }
        throw new Error(result.message || (lang === 'mg'
          ? "Tsy afaka niditra"
          : "Échec de connexion"
        ));
      }
      
      return result;
    },
    onSuccess: (data) => {
      // Mettre à jour le cache avec l'utilisateur
      queryClient.setQueryData([api.auth.me.path], data.user);
      
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
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
      });
    },
  });

  // Renvoi OTP (après expiration)
  const resendOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to resend OTP");
      }
      
      return res.json();
    },
    onSuccess: (_, phone) => {
      toast({
        title: lang === 'mg' ? "Kaody vaovao nalefa!" : "Nouveau code envoyé!",
      });
    },
  });

  // Déconnexion
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, { 
        method: api.auth.logout.method, 
        credentials: "include" 
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Logout failed");
      }
    },
    onSuccess: () => {
      // Nettoyer le cache
      queryClient.clear();
      
      toast({
        title: lang === 'mg' ? "Tafivoaka" : "Déconnecté",
      });
      
      // Rediriger vers login
      window.location.href = '/login';
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !user.isBlocked, // Vérifier si l'utilisateur n'est pas bloqué
    login: loginMutation.mutateAsync,
    requestOtp: requestOtpMutation.mutateAsync,
    resendOtp: resendOtpMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isRequestOtpPending: requestOtpMutation.isPending,
    refetch,
  };
}