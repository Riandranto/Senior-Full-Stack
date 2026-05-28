// client/src/hooks/use-driver.ts - Version corrigée
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Ride, type CreateOfferRequest, type DriverProfile } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { useRef, useCallback } from "react";

export function useDriverProfile() {
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useQuery<DriverProfile & { documents: any[] }>({
    queryKey: [api.driver.getProfile.path],
    queryFn: async () => {
      const res = await apiFetch(api.driver.getProfile.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch driver profile");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useSetOnline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (online: boolean) => {
      const res = await apiFetch(api.driver.setOnline.path, {
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
      queryClient.setQueryData([api.driver.getProfile.path], (old: any) => ({ ...old, online: data.online }));
      toast({ title: data.online ? (lang === 'mg' ? "Miasa" : "En ligne") : (lang === 'mg' ? "Tsy miasa" : "Hors ligne") });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message });
    },
  });
}

export function useDriverRequests() {
  return useQuery<any[]>({
    queryKey: [api.driver.getRequests.path],
    queryFn: async () => {
      const res = await apiFetch(api.driver.getRequests.path, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: false,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSendOffer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateOfferRequest) => {
      if (data.priceAr < 1000) throw new Error(lang === 'mg' ? "Vidiny kely loatra (1000 Ar ny farany ambany)" : "Prix trop bas (minimum 1000 Ar)");
      const res = await apiFetch(api.driver.sendOffer.path, {
        method: api.driver.sendOffer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Échec de l'envoi de l'offre");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.driver.getRequests.path] });
      toast({ title: lang === 'mg' ? "Tolobidy nalefa!" : "Offre envoyée!" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message });
    },
  });
}

export function useUpdateLocation() {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSentLocation = useRef({ lat: 0, lng: 0 });
  const lastSendTime = useRef(0);

  const mutate = useCallback(async (location: { lat: number; lng: number }) => {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return;
    
    const now = Date.now();
    const latDiff = Math.abs(location.lat - lastSentLocation.current.lat);
    const lngDiff = Math.abs(location.lng - lastSentLocation.current.lng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
    
    if (distance < 200 && (now - lastSendTime.current) < 15000) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(api.driver.updateLocation.path, {
          method: api.driver.updateLocation.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(location),
          credentials: "include",
        });
        if (res.ok) {
          lastSentLocation.current = location;
          lastSendTime.current = Date.now();
        }
      } catch (error) {
        // ignore
      } finally {
        timeoutRef.current = undefined;
      }
    }, 1000);
  }, []);

  return { mutate };
}

export function useDriverActiveRide() {
  return useQuery({
    queryKey: ['/api/driver/active-ride'],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/driver/active-ride', { credentials: 'include' });
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return res.json();
      } catch (error) {
        return null;
      }
    },
    refetchInterval: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateRideStatus(rideId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (status: string) => {
      const res = await apiFetch(`/api/rides/${rideId}/status`, {
        method: 'PATCH',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update ride status");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
      queryClient.invalidateQueries({ queryKey: ['/api/driver/requests'] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message });
    },
  });
}

export function useExtendEta(rideId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useTranslation();

  return useMutation({
    mutationFn: async (additionalMinutes: number) => {
      const res = await apiFetch(`/api/rides/${rideId}/eta`, {
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
    onSuccess: (data, additionalMinutes) => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/active-ride'] });
      toast({
        title: lang === 'mg' ? "Fotoana fanampiny" : "Temps supplémentaire",
        description: `+${additionalMinutes} min`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: lang === 'mg' ? "Tsy nety" : "Erreur", description: error.message });
    },
  });
}