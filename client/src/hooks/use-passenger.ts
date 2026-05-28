// client/src/hooks/use-passenger.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Ride, type Offer, type CreateRideRequest, type RateRideRequest } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

export function useCreateRide() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateRideRequest) => {
      if (!data.pickupLat || !data.pickupLng || !data.dropLat || !data.dropLng) {
        throw new Error(lang === 'mg'
          ? "Safidio ny toerana fiaingana sy fahatongavana"
          : "Choisissez le départ et la destination");
      }
      const res = await apiFetch(api.passenger.createRide.path, {
        method: api.passenger.createRide.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (result.message?.includes("faritra")) {
          throw new Error(lang === 'mg'
            ? "Tsy ao anatin'ny faritry ny serivisy"
            : "Hors zone de service");
        }
        throw new Error(result.message || (lang === 'mg'
          ? "Tsy afaka namorona dia"
          : "Échec de création de la course"));
      }
      return result;
    },
    onSuccess: (ride) => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.history.path] });
      toast({
        title: lang === 'mg' ? "Dia noforonina!" : "Course créée!",
        description: lang === 'mg' ? "Mitady mpamily..." : "Recherche de chauffeurs...",
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

// ✅ CORRECTION ICI AUSSI
export function useRideOffers(rideId: number | null) {
  return useQuery<any[]>({
    queryKey: [api.passenger.getOffers.path, rideId],
    queryFn: async () => {
      if (!rideId) return [];
      const url = buildUrl(api.passenger.getOffers.path, { id: rideId });
      const res = await apiFetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!rideId,
    refetchInterval: false, // DÉSACTIVÉ
    staleTime: 30 * 1000, // 30 secondes
    refetchOnWindowFocus: false,
  });
}

export function useRide(id: number | null) {
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useQuery<Ride & { driver?: any }>({
    queryKey: [api.passenger.getRide.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.passenger.getRide.path, { id });
      const res = await apiFetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ride");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: false, // DÉSACTIVÉ - utiliser WebSocket
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

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
        if (result.message?.includes("expir")) {
          throw new Error(lang === 'mg' ? "Lany daty ilay tolo-bidy" : "Offre expirée");
        }
        throw new Error(result.message || "Failed to accept offer");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.getRide.path, rideId] });
      queryClient.invalidateQueries({ queryKey: [api.passenger.getOffers.path, rideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
      toast({
        title: lang === 'mg' ? "Tolobidy voaray!" : "Offre acceptée!",
        description: lang === 'mg' ? "Ho tonga ny mpamily" : "Le chauffeur arrive",
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
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to cancel ride");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.getRide.path, rideId] });
      queryClient.invalidateQueries({ queryKey: [api.passenger.history.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/rides/active'] });
      toast({
        title: lang === 'mg' ? "Nofoanana ny dia" : "Course annulée",
        description: lang === 'mg' ? "Voafafa soa aman-tsara ny dia" : "La course a été annulée avec succès",
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

export function useRateRide(rideId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: RateRideRequest) => {
      if (data.rating < 1 || data.rating > 5) {
        throw new Error(lang === 'mg' ? "Naoty tsy mety (1-5)" : "Note invalide (1-5)");
      }
      const url = buildUrl(api.passenger.rateRide.path, { id: rideId });
      const res = await apiFetch(url, {
        method: api.passenger.rateRide.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to rate ride");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.passenger.getRide.path, rideId] });
      queryClient.invalidateQueries({ queryKey: [api.passenger.history.path] });
      toast({
        title: lang === 'mg' ? "Misaotra!" : "Merci!",
        description: lang === 'mg' ? "Voaray ny naoty nomenao" : "Note enregistrée",
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

export function useRideHistory() {
  return useQuery<Ride[]>({
    queryKey: [api.passenger.history.path],
    queryFn: async () => {
      const res = await apiFetch(api.passenger.history.path, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRideViews(rideId: number | null) {
  return useQuery<{ viewCount: number }>({
    queryKey: ['/api/rides', rideId, 'views'],
    queryFn: async () => {
      if (!rideId) return { viewCount: 0 };
      const res = await apiFetch(`/api/rides/${rideId}/views`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 429) return { viewCount: 0 };
        return { viewCount: 0 };
      }
      return res.json();
    },
    enabled: !!rideId,
    refetchInterval: (query) => {
      if (document.visibilityState !== 'visible') return false;
      return 30000;
    },
    refetchIntervalInBackground: false,
    staleTime: 20000,
  });
}

// ✅ CORRECTION ICI AUSSI
export function usePassengerActiveRide() {
  return useQuery({
    queryKey: ['/api/rides/active'],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/rides/active', { credentials: 'include' });
        if (res.status === 404) return null;
        if (res.status === 400) {
          console.warn('Bad request for /api/rides/active, returning null');
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      } catch (error) {
        console.error('Error fetching active ride:', error);
        return null;
      }
    },
    refetchInterval: (query) => {
      if (document.visibilityState !== 'visible') return false;
      const data = query.state.data;
      if (data && data.id) return false; // WebSocket priority
      return 30000;
    },
    refetchIntervalInBackground: false,
    staleTime: 20000,
    retry: 1,
    retryDelay: 10000,
  });
}