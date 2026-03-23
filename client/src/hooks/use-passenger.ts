import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Ride, type Offer, type CreateRideRequest, type RateRideRequest } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

// Création de course avec validation
export function useCreateRide() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateRideRequest) => {
      // Validation basique
      if (!data.pickupLat || !data.pickupLng || !data.dropLat || !data.dropLng) {
        throw new Error(lang === 'mg'
          ? "Safidio ny toerana fiaingana sy fahatongavana"
          : "Choisissez le départ et la destination"
        );
      }

      const res = await apiFetch(api.passenger.createRide.path, {
        method: api.passenger.createRide.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Message spécifique pour hors zone
        if (result.message?.includes("faritra")) {
          throw new Error(lang === 'mg'
            ? "Tsy ao anatin'ny faritry Fort-Dauphin"
            : "Hors zone Fort-Dauphin"
          );
        }
        throw new Error(result.message || (lang === 'mg'
          ? "Tsy afaka namorona dia"
          : "Échec de création de la course"
        ));
      }

      return result;
    },
    onSuccess: (ride) => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.history.path] });
      
      toast({
        title: lang === 'mg' ? "Dia noforonina!" : "Course créée!",
        description: lang === 'mg'
          ? "Mitady mpamily..."
          : "Recherche de chauffeurs...",
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

// Détails d'une course avec polling intelligent
export function useRide(id: number | null) {
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useQuery<Ride & { driver?: any }>({
    queryKey: [api.passenger.getRide.path, id],
    queryFn: async () => {
      if (!id) return null;
      
      const url = buildUrl(api.passenger.getRide.path, { id });
      const res = await apiFetch(url, { 
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        const error = await res.json();
        throw new Error(error.message || "Failed to apiFetch ride");
      }
      
      return res.json();
    },
    enabled: !!id,
    // Polling intelligent basé sur le statut
    reapiFetchInterval: (query) => {
      const status = query.state.data?.status;
      
      if (!status) return false;
      
      switch (status) {
        case 'REQUESTED':
        case 'BIDDING':
          return 3000; // 3 secondes - recherche d'offres
        case 'ASSIGNED':
        case 'DRIVER_EN_ROUTE':
        case 'DRIVER_ARRIVED':
        case 'IN_PROGRESS':
          return 5000; // 5 secondes - suivi de course
        default:
          return false; // Arrêter le polling pour COMPLETED, CANCELED
      }
    },
    retry: 2,
    staleTime: 2000, // 2 secondes
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message,
      });
    },
  });
}

// Offres pour une course
export function useRideOffers(rideId: number | null) {
  return useQuery<any[]>({
    queryKey: [api.passenger.getOffers.path, rideId],
    queryFn: async () => {
      if (!rideId) return [];
      
      const url = buildUrl(api.passenger.getOffers.path, { id: rideId });
      const res = await apiFetch(url, { 
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) {
        // Silently fail - retourner tableau vide
        return [];
      }
      
      return res.json();
    },
    enabled: !!rideId,
    reapiFetchInterval: 3000, // 3 secondes
    staleTime: 2000,
  });
}

// Accepter une offre
export function useAcceptOffer(rideId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (offerId: number) => {
      const url = buildUrl(api.passenger.acceptOffer.path, { id: rideId });
      const res = await apiFetch(url, {
        method: api.passenger.acceptOffer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
        credentials: "include",
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Vérifier si l'offre a expiré
        if (result.message?.includes("expir")) {
          throw new Error(lang === 'mg'
            ? "Lany daty ilay tolo-bidy"
            : "Offre expirée"
          );
        }
        throw new Error(result.message || "Failed to accept offer");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.getRide.path, rideId] });
      queryClient.invalidateQueries({ queryKey: [api.passenger.getOffers.path, rideId] });
      
      toast({
        title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!",
        description: lang === 'mg'
          ? "Ho tonga ny mpamily"
          : "Le chauffeur arrive",
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

// Annuler une course
export function useCancelRide(rideId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (reason: string = "Nofoanana") => {
      const url = buildUrl(api.passenger.cancelRide.path, { id: rideId });
      const res = await apiFetch(url, {
        method: api.passenger.cancelRide.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to cancel ride");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.getRide.path, rideId] });
      queryClient.invalidateQueries({ queryKey: [api.passenger.history.path] });
      
      toast({
        title: lang === 'mg' ? "Nofoanana" : "Annulé",
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

// Noter une course
export function useRateRide(rideId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: RateRideRequest) => {
      // Validation
      if (data.rating < 1 || data.rating > 5) {
        throw new Error(lang === 'mg'
          ? "Naoty tsy mety (1-5)"
          : "Note invalide (1-5)"
        );
      }

      const url = buildUrl(api.passenger.rateRide.path, { id: rideId });
      const res = await apiFetch(url, {
        method: api.passenger.rateRide.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to rate ride");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.getRide.path, rideId] });
      
      toast({
        title: lang === 'mg' ? "Misaotra!" : "Merci!",
        description: lang === 'mg'
          ? "Voaray ny naoty nomenao"
          : "Note enregistrée",
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

// Historique des courses
export function useRideHistory() {
  return useQuery<Ride[]>({
    queryKey: [api.passenger.history.path],
    queryFn: async () => {
      const res = await apiFetch(api.passenger.history.path, {
        credentials: "include"
      });
      
      if (!res.ok) {
        return [];
      }
      
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Vue count (combien de conducteurs ont vu)
export function useRideViews(rideId: number | null) {
  return useQuery<{ viewCount: number }>({
    queryKey: ['/api/rides', rideId, 'views'],
    queryFn: async () => {
      if (!rideId) return { viewCount: 0 };
      
      const res = await apiFetch(`/api/rides/${rideId}/views`, { 
        credentials: 'include' 
      });
      
      if (!res.ok) {
        return { viewCount: 0 };
      }
      
      return res.json();
    },
    enabled: !!rideId,
    reapiFetchInterval: 10000, // 10 secondes
  });
}