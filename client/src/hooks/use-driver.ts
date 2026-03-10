import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Ride, type CreateOfferRequest, type DriverProfile } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";

export interface DriverDocument {
  id: number;
  type: string;
  url: string;
  uploadedAt: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// Profil conducteur avec documents
export function useDriverProfile() {
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useQuery<DriverProfile & { documents: DriverDocument[] }>({
    queryKey: [api.driver.getProfile.path],
    queryFn: async () => {
      const res = await fetch(api.driver.getProfile.path, { 
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          // Profil pas encore créé - c'est OK pour les nouveaux conducteurs
          return null;
        }
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch driver profile");
      }
      
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Upload de document sécurisé
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      // Validation du fichier côté client
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(lang === 'mg'
          ? "Lehibe loatra ny rakitra. 10MB ny fetra."
          : "Fichier trop volumineux. Limite: 10MB"
        );
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(lang === 'mg'
          ? "Karazana rakitra tsy mety. JPEG, PNG, PDF ihany."
          : "Type de fichier non autorisé. JPEG, PNG, PDF uniquement."
        );
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch(api.driver.uploadDocument.path, {
        method: api.driver.uploadDocument.method,
        body: formData,
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || (lang === 'mg'
          ? "Tsy afaka nampiditra antontan-taratasy"
          : "Échec du téléchargement"
        ));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.driver.getProfile.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/documents'] });
      
      toast({
        title: lang === 'mg' ? "Voaray ny antontan-taratasy" : "Document reçu",
        description: lang === 'mg' 
          ? "Hiandry fankatoavana"
          : "En attente de validation",
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
}

// Documents du conducteur
export function useDriverDocuments() {
  return useQuery<DriverDocument[]>({
    queryKey: ['/api/driver/documents'],
    queryFn: async () => {
      const res = await fetch('/api/driver/documents', {
        credentials: 'include'
      });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

// Statut en ligne/offline
export function useSetOnline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (online: boolean) => {
      const res = await fetch(api.driver.setOnline.path, {
        method: api.driver.setOnline.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online }),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update status");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.driver.getProfile.path], (old: any) => ({
        ...old,
        online: data.online
      }));
      
      toast({
        title: data.online 
          ? (lang === 'mg' ? "Miasa" : "En ligne")
          : (lang === 'mg' ? "Tsy miasa" : "Hors ligne"),
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
}

// Demandes de courses avec géolocalisation
export function useDriverRequests() {
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useQuery<any[]>({
    queryKey: [api.driver.getRequests.path],
    queryFn: async () => {
      const res = await fetch(api.driver.getRequests.path, { 
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) {
        if (res.status === 403) {
          // Profil non approuvé
          return { error: 'NOT_APPROVED' };
        }
        return [];
      }
      
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      // Si le conducteur n'est pas approuvé, ne pas rafraîchir
      if (data && typeof data === 'object' && 'error' in data) {
        return false;
      }
      return 5000; // 5 secondes
    },
  });
}

// Envoi d'offre avec validation
export function useSendOffer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateOfferRequest) => {
      // Validation
      if (data.priceAr < 1000) {
        throw new Error(lang === 'mg'
          ? "Vidiny kely loatra (1000 Ar ny farany ambany)"
          : "Prix trop bas (minimum 1000 Ar)"
        );
      }

      if (data.etaMinutes < 1 || data.etaMinutes > 120) {
        throw new Error(lang === 'mg'
          ? "Fotoana tsy mety (1-120 minitra)"
          : "Temps invalide (1-120 minutes)"
        );
      }

      const res = await fetch(api.driver.sendOffer.path, {
        method: api.driver.sendOffer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.message || (lang === 'mg'
          ? "Tsy afaka nandefa tolo-bidy"
          : "Échec de l'envoi de l'offre"
        ));
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalider les requêtes
      queryClient.invalidateQueries({ queryKey: [api.driver.getRequests.path] });
      
      toast({
        title: lang === 'mg' ? "Tolobidy nalefa!" : "Offre envoyée!",
        description: lang === 'mg'
          ? `${variables.priceAr} Ar - ${variables.etaMinutes} min`
          : `${variables.priceAr} Ar - ${variables.etaMinutes} min`,
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
}

// Mise à jour de la position GPS
export function useUpdateLocation() {
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (location: { lat: number; lng: number }) => {
      const res = await fetch(api.driver.updateLocation.path, {
        method: api.driver.updateLocation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to update location");
      }

      return res.json();
    },
    onError: () => {
      // Silently fail - pas de toast pour éviter le spam
      console.error("Location update failed");
    },
  });
}

  // 🔥 NOUVEAU: Hook pour récupérer la course active du conducteur
  export function useDriverActiveRide() {
    return useQuery({
      queryKey: ['/api/driver/active-ride'],
      queryFn: async () => {
        const res = await fetch('/api/driver/active-ride', {
          credentials: 'include',
        });
        
        if (res.status === 404) {
          return null; // Pas de course active
        }
        
        if (!res.ok) {
          throw new Error('Failed to fetch active ride');
        }
        
        return res.json();
      },
      refetchInterval: 10000, // Rafraîchir toutes les 10 secondes
    });
  }

  // 🔥 NOUVEAU: Hook pour mettre à jour le statut d'une course
  export function useUpdateRideStatus(rideId: number) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { lang } = useTranslation();

    return useMutation({
      mutationFn: async (status: string) => {
        const url = buildUrl(api.driver.updateRideStatus.path, { id: rideId });
        const res = await fetch(url, {
          method: api.driver.updateRideStatus.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
          credentials: "include",
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to update ride status");
        }

        return res.json();
      },
      onSuccess: (data) => {
        // Invalider le cache pour forcer un refetch
        queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
        queryClient.invalidateQueries({ queryKey: [api.driver.getRequests.path] });
        
        const messages: Record<string, { mg: string; fr: string }> = {
          DRIVER_EN_ROUTE: { mg: "Eny an-dalana!", fr: "En route!" },
          DRIVER_ARRIVED: { mg: "Tonga teo amin'ny toerana!", fr: "Arrivé au point de départ!" },
          IN_PROGRESS: { mg: "Manomboka ny dia", fr: "Course en cours" },
          COMPLETED: { mg: "Vita ny dia", fr: "Course terminée" },
        };

        if (messages[data.status]) {
          toast({
            title: lang === 'mg' ? messages[data.status].mg : messages[data.status].fr,
          });
        }
      },
    });
  }

  // 🔥 NOUVEAU: Hook pour prolonger l'ETA
  export function useExtendEta(rideId: number) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { lang } = useTranslation();

    return useMutation({
      mutationFn: async (additionalMinutes: number) => {
        const res = await fetch(`/api/rides/${rideId}/eta`, {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalMinutes }),
          credentials: "include",
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to extend ETA");
        }

        return res.json();
      },
      onSuccess: (_, additionalMinutes) => {
        queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
        
        toast({
          title: lang === 'mg' ? "Fotoana fanampiny" : "Temps supplémentaire",
          description: lang === 'mg' 
            ? `+${additionalMinutes} minitra fanampiny`
            : `+${additionalMinutes} minutes supplémentaires`,
        });
      },
    });
  }