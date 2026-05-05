import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type User } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { normalizePhone } from "@/lib/phone-normalizer";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  // Vérification de l'authentification
  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      try {
        const res = await apiFetch(api.auth.me.path);
        if (res.status === 401) return null;
        if (!res.ok) return null;
        const userData = await res.json();
        return userData;
      } catch (e) {
        return null;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Demande d'OTP – avec normalisation
  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const { valid, normalized, error } = normalizePhone(phone);
      if (!valid) {
        throw new Error(error || (lang === 'mg' ? "Tsy lavorary ny nomerao" : "Numéro invalide"));
      }
      console.log('📞 Demande OTP normalisée:', normalized);

      const res = await apiFetch(api.auth.requestOtp.path, {
        method: api.auth.requestOtp.method,
        body: JSON.stringify({ phone: normalized }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || (lang === 'mg' ? "Tsy afaka nandefa kaody" : "Échec de l'envoi du code"));
      }
      return data;
    },
    onSuccess: (_, phone) => {
      const { normalized } = normalizePhone(phone);
      toast({
        title: lang === 'mg' ? "Kaody nalefa!" : "Code envoyé!",
        description: lang === 'mg' ? `Kaody 6 tarehimarika nalefa tany ${normalized}` : `Code à 6 chiffres envoyé au ${normalized}`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message });
    },
  });

  // Connexion – normalisation
  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; otp: string }) => {
      const { valid, normalized, error } = normalizePhone(data.phone);
      if (!valid) {
        throw new Error(error || (lang === 'mg' ? "Nomerao tsy ara-dalàna" : "Numéro invalide"));
      }
      console.log('🔐 Connexion avec numéro normalisé:', normalized);

      const res = await apiFetch(api.auth.verifyOtp.path, {
        method: api.auth.verifyOtp.method,
        body: JSON.stringify({ phone: normalized, otp: data.otp }),
      });

      if (!res.ok) {
        let errorMessage = lang === 'mg' ? "Tsy afaka niditra" : "Échec de connexion";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const result = await res.json();
      localStorage.setItem('user', JSON.stringify(result.user));
      queryClient.setQueryData([api.auth.me.path], result.user);
      await refetch();

      toast({
        title: lang === 'mg' ? "Tafiditra!" : "Connecté!",
        description: lang === 'mg' ? "Tonga soa eto Farady" : "Bienvenue sur Farady",
      });

      // Redirection
      if (result.user.role === 'ADMIN') window.location.href = '/admin';
      else if (result.user.role === 'DRIVER') window.location.href = '/driver';
      else window.location.href = '/passenger';

      return result;
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message });
    },
  });

  // Déconnexion
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(api.auth.logout.path, { method: api.auth.logout.method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Logout failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      localStorage.removeItem('user');
      toast({ title: lang === 'mg' ? "Tafivoaka" : "Déconnecté" });
      window.location.href = '/login';
    },
    onError: () => {
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