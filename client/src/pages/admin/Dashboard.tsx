import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, buildUrl } from '@shared/routes';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GEOCENTER } from '@shared/schema';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Car, MapPin, TrendingUp, Activity, Shield, Settings, Star,
  CheckCircle, XCircle, Ban, Eye, Phone, Navigation, Clock, Route,
  Search, LogOut, ChevronLeft, ChevronRight, DollarSign, AlertTriangle,
  FileText, Bike, CircleDot, UserCheck, UserX, Loader2, Image, File,
  RefreshCw
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-MG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatAr(amount: number | null) {
  if (!amount) return '0 Ar';
  return amount.toLocaleString('fr-MG') + ' Ar';
}

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  BIDDING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  ASSIGNED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  DRIVER_EN_ROUTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  DRIVER_ARRIVED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  IN_PROGRESS: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const driverStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  SUSPENDED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const PAGE_SIZE = 20;

// Animation de chargement
const LoadingSpinner = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="flex flex-col items-center justify-center p-8"
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <Loader2 className="w-8 h-8 text-primary" />
    </motion.div>
    <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
  </motion.div>
);

// Indicateur de rafraîchissement
const RefreshIndicator = ({ isRefreshing }: { isRefreshing: boolean }) => (
  <AnimatePresence>
    {isRefreshing && (
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-primary/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </motion.div>
          <span className="text-white text-xs font-medium">Mise à jour...</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

function Pagination({ current, total, onChange, count }: { current: number; total: number; onChange: (p: number) => void; count: number }) {
  if (total <= 1) return null;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between p-3 border-t border-border/30 bg-muted/10"
    >
      <span className="text-xs text-muted-foreground">{count} résultat{count > 1 ? 's' : ''}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={current <= 1} onClick={() => onChange(current - 1)} data-testid="button-prev-page">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs font-medium px-2" data-testid="text-page-info">{current} / {total}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={current >= total} onClick={() => onChange(current + 1)} data-testid="button-next-page">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function AdminMap({ activeRides, driverLocations }: { activeRides: any[]; driverLocations: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [GEOCENTER.lat, GEOCENTER.lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    const driverIcon = L.divIcon({
      className: '',
      html: '<div style="background:#22c55e;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const pickupIcon = L.divIcon({
      className: '',
      html: '<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    driverLocations.forEach((loc: any) => {
      if (!loc.lat || !loc.lng) return;
      const marker = L.marker([parseFloat(loc.lat), parseFloat(loc.lng)], { icon: driverIcon });
      marker.bindPopup(`<b>${loc.name || 'Chauffeur'}</b><br/>${loc.vehicleType || ''}<br/>${loc.online ? 'En ligne' : 'Hors ligne'}`);
      markersRef.current!.addLayer(marker);
    });

    activeRides.forEach((ride: any) => {
      if (!ride.pickupLat || !ride.pickupLng) return;
      const marker = L.marker([parseFloat(ride.pickupLat), parseFloat(ride.pickupLng)], { icon: pickupIcon });
      marker.bindPopup(`<b>Course #${ride.id}</b><br/>${ride.pickupAddress || ''}<br/>${ride.status.replace(/_/g, ' ')}`);
      markersRef.current!.addLayer(marker);
    });
  }, [activeRides, driverLocations]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      ref={mapRef} 
      className="h-[350px] w-full" 
      data-testid="admin-map" 
    />
  );
}

function StatCard({ icon, label, value, color, bg, sub, delay = 0 }: { icon: any; label: string; value: any; color: string; bg: string; sub?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className="p-4 md:p-5 rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center ${color} mb-3`}>{icon}</div>
        <motion.div 
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, delay: delay + 0.2 }}
          className="text-2xl md:text-3xl font-bold font-display" 
          data-testid={`stat-${label.toLowerCase().replace(/ /g, '-')}`}
        >
          {value}
        </motion.div>
        <div className="text-xs text-muted-foreground font-medium mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
      </Card>
    </motion.div>
  );
}

function MiniStat({ label, value, icon, delay = 0 }: { label: string; value: number; icon: any; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="p-3 rounded-xl border-0 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
        {icon}
        <div>
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: delay + 0.1 }}
            className="font-bold text-sm"
          >
            {value}
          </motion.div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </Card>
    </motion.div>
  );
}

function RideDetailView({ ride }: { ride: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <motion.span 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[ride.status] || ''}`}
        >
          {ride.status.replace(/_/g, ' ')}
        </motion.span>
        {ride.vehicleType && <Badge variant="outline" className="text-xs">{ride.vehicleType}</Badge>}
      </div>

      <div className="space-y-2">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-xl"
        >
          <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Départ</div>
            <div className="text-sm font-medium">{ride.pickupAddress}</div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl"
        >
          <Navigation className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Arrivée</div>
            <div className="text-sm font-medium">{ride.dropAddress}</div>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground">Distance</div>
          <div className="font-bold text-sm">{ride.distanceKm ? `${parseFloat(ride.distanceKm).toFixed(1)} km` : '—'}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground">ETA</div>
          <div className="font-bold text-sm">{ride.etaMinutes ? `${ride.etaMinutes} min` : '—'}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground">Prix</div>
          <div className="font-bold text-sm text-primary">{ride.selectedPriceAr ? formatAr(ride.selectedPriceAr) : '—'}</div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-3 bg-muted/20 rounded-xl"
        >
          <div className="text-[10px] text-muted-foreground mb-1">Passager</div>
          <div className="font-medium text-sm">{ride.passenger?.name || '—'}</div>
          <div className="text-xs text-muted-foreground">{ride.passenger?.phone}</div>
        </motion.div>
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-3 bg-muted/20 rounded-xl"
        >
          <div className="text-[10px] text-muted-foreground mb-1">Chauffeur</div>
          <div className="font-medium text-sm">{ride.driver?.name || '—'}</div>
          <div className="text-xs text-muted-foreground">{ride.driver?.phone || ''}</div>
        </motion.div>
      </div>

      {ride.offers && ride.offers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="text-xs font-bold text-muted-foreground mb-2">Offres ({ride.offers.length})</div>
          <div className="space-y-1">
            {ride.offers.map((o: any, idx: number) => (
              <motion.div 
                key={o.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + idx * 0.05 }}
                className="flex justify-between items-center p-2 bg-muted/20 rounded-lg text-xs"
              >
                <span>Offre #{o.id}</span>
                <span className="font-bold">{formatAr(o.priceAr)}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${o.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : o.status === 'EXPIRED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{o.status}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {ride.cancelReason && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl"
        >
          <div className="text-xs text-red-600 font-bold mb-1">Annulation</div>
          <div className="text-sm">{ride.cancelReason} <span className="text-xs text-muted-foreground">({ride.cancelBy})</span></div>
        </motion.div>
      )}

      <div className="text-xs text-muted-foreground">
        Créée le {formatDate(ride.createdAt)} — MAJ {formatDate(ride.updatedAt)}
      </div>
    </motion.div>
  );
}

function DriverDetailView({ driver }: { driver: any }) {
  const [docTab, setDocTab] = useState<string>('info');
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  const docs = driver.documents || [];
  const docTypes: Record<string, string> = { CIN: 'CIN (Carte d\'identité)', PERMIS: 'Permis de conduire', VEHICLE: 'Carte grise', PHOTO: 'Photo de profil' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-4">
        <motion.div 
          initial={{ scale: 0.8, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center"
        >
          <Users className="w-8 h-8 text-muted-foreground" />
        </motion.div>
        <div>
          <h3 className="font-bold text-lg">{driver.name}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {driver.phone}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${driverStatusColors[driver.profile?.status] || ''}`}>{driver.profile?.status}</span>
        {driver.profile?.online && <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1"><CircleDot className="w-2.5 h-2.5" /> En ligne</span>}
      </div>

      <div className="flex gap-1 border-b border-border/30">
        <button
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${docTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setDocTab('info')}
          data-testid="tab-driver-info"
        >
          Informations
        </button>
        <button
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1 ${docTab === 'docs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setDocTab('docs')}
          data-testid="tab-driver-docs"
        >
          <FileText className="w-3 h-3" /> Documents {docs.length > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">{docs.length}</Badge>}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {docTab === 'info' && (
          <motion.div
            key="info"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/20 rounded-xl text-center">
                <div className="text-xs text-muted-foreground">Véhicule</div>
                <div className="font-bold text-sm flex items-center justify-center gap-1 mt-1">
                  {driver.profile?.vehicleType === 'BAJAJ' ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                  {driver.profile?.vehicleType}
                </div>
                {driver.profile?.vehicleNumber && <div className="text-xs text-muted-foreground mt-0.5">{driver.profile.vehicleNumber}</div>}
              </div>
              <div className="p-3 bg-muted/20 rounded-xl text-center">
                <div className="text-xs text-muted-foreground">Permis</div>
                <div className="font-bold text-sm mt-1">{driver.profile?.licenseNumber || '—'}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 text-center">
                <Star className="w-4 h-4 text-amber-400 mx-auto" />
                <div className="font-bold text-sm mt-1">{driver.profile?.ratingAvg || '0'}</div>
                <div className="text-[10px] text-muted-foreground">Note</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <div className="font-bold text-sm">{driver.profile?.ratingCount || 0}</div>
                <div className="text-[10px] text-muted-foreground">Avis</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <div className="font-bold text-sm">{driver.completedRides || 0}</div>
                <div className="text-[10px] text-muted-foreground">Courses</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                <div className="font-bold text-sm text-primary">{formatAr(driver.totalEarnings || 0)}</div>
                <div className="text-[10px] text-muted-foreground">Gains</div>
              </div>
            </div>

            {driver.profile?.zone && (
              <div className="text-xs text-muted-foreground">Zone: {driver.profile.zone}</div>
            )}
          </motion.div>
        )}

        {docTab === 'docs' && (
          <motion.div
            key="docs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {docs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm bg-muted/10 rounded-xl">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Aucun document soumis
              </div>
            ) : (
              docs.map((doc: any, idx: number) => (
                <motion.div 
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-3 bg-muted/20 rounded-xl"
                  data-testid={`doc-${doc.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      {doc.url && (doc.url.endsWith('.jpg') || doc.url.endsWith('.jpeg') || doc.url.endsWith('.png') || doc.url.endsWith('.webp'))
                        ? <Image className="w-5 h-5 text-primary" />
                        : <File className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{docTypes[doc.type] || doc.type}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDate(doc.uploadedAt)}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg"
                    onClick={() => setPreviewDoc(doc)}
                    data-testid={`button-view-doc-${doc.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" /> Voir
                  </Button>
                </motion.div>
              ))
            )}

            {previewDoc && (
              <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                <DialogContent className="max-w-2xl rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{docTypes[previewDoc.type] || previewDoc.type}</DialogTitle>
                  </DialogHeader>
                  <div className="flex items-center justify-center min-h-[300px] bg-muted/20 rounded-xl overflow-hidden">
                    {previewDoc.url ? (
                      <DocImage url={previewDoc.url} type={previewDoc.type} />
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm">Aucun fichier disponible</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DocImage({ url, type }: { url: string; type: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        <p>Impossible de charger le document</p>
        <p className="text-xs mt-1 break-all">{url}</p>
      </div>
    );
  }
  return (
    <motion.img
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      src={url}
      alt={type}
      className="max-w-full max-h-[500px] object-contain rounded-lg"
      onError={() => setFailed(true)}
      data-testid="img-doc-preview"
    />
  );
}

function ConfigForm({ config, onSave, isPending }: { config: any; onSave: (data: any) => void; isPending: boolean }) {
  const [radius, setRadius] = useState(config.searchRadiusKm || '5');
  const [expiry, setExpiry] = useState(config.offerExpirySeconds || 90);
  const [commission, setCommission] = useState(config.commissionPercent || '0');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-2xl border-0 shadow-sm space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Zone de recherche</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Rayon de recherche (km)</label>
            <Input type="number" value={radius} onChange={e => setRadius(e.target.value)} className="rounded-xl" data-testid="input-radius" />
            <p className="text-[10px] text-muted-foreground mt-1">Distance max pour trouver des chauffeurs autour du passager</p>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 rounded-2xl border-0 shadow-sm space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Offres</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Expiration des offres (secondes)</label>
            <Input type="number" value={expiry} onChange={e => setExpiry(parseInt(e.target.value))} className="rounded-xl" data-testid="input-expiry" />
            <p className="text-[10px] text-muted-foreground mt-1">Temps avant qu'une offre de chauffeur expire automatiquement</p>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-6 rounded-2xl border-0 shadow-sm space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /> Commission</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Commission plateforme (%)</label>
            <Input type="number" value={commission} onChange={e => setCommission(e.target.value)} className="rounded-xl" data-testid="input-commission" />
            <p className="text-[10px] text-muted-foreground mt-1">Pourcentage prélevé sur chaque course terminée</p>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-end"
      >
        <Button
          className="w-full md:w-auto rounded-xl font-bold h-11 px-8"
          disabled={isPending}
          onClick={() => onSave({ searchRadiusKm: parseFloat(radius), offerExpirySeconds: expiry, commissionPercent: parseFloat(commission) })}
          data-testid="button-save-config"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Enregistrer les paramètres
        </Button>
      </motion.div>
    </div>
  );
}

function LocationsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editPlace, setEditPlace] = useState<any>(null);
  const [form, setForm] = useState({ name: '', nameFr: '', lat: '', lng: '' });

  const { data: places = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/places'],
    queryFn: async () => (await fetch('/api/admin/places', { credentials: 'include' })).json(),
  });

  const createPlace = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/places'] });
      setShowAdd(false);
      setForm({ name: '', nameFr: '', lat: '', lng: '' });
      toast({ title: 'Lieu ajouté' });
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  const updatePlace = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/admin/places/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/places'] });
      setEditPlace(null);
      setForm({ name: '', nameFr: '', lat: '', lng: '' });
      toast({ title: 'Lieu mis à jour' });
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  const deletePlace = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/places/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/places'] });
      toast({ title: 'Lieu supprimé' });
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={() => { setShowAdd(true); setForm({ name: '', nameFr: '', lat: '', lng: '' }); }}
            className="rounded-xl"
            data-testid="button-add-place"
          >
            <MapPin className="w-4 h-4 mr-2" /> Ajouter un lieu
          </Button>
        </motion.div>
      </div>

      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3 font-semibold">Nom (MG)</th>
                <th className="p-3 font-semibold">Nom (FR)</th>
                <th className="p-3 font-semibold hidden md:table-cell">Latitude</th>
                <th className="p-3 font-semibold hidden md:table-cell">Longitude</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {places.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">Aucun lieu personnalisé</td></tr>
              ) : (
                places.map((p: any, idx: number) => (
                  <motion.tr 
                    key={p.id} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-muted/20" 
                    data-testid={`place-row-${p.id}`}
                  >
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.nameFr}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{parseFloat(p.lat).toFixed(4)}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{parseFloat(p.lng).toFixed(4)}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg"
                        onClick={() => {
                          setEditPlace(p);
                          setForm({ name: p.name, nameFr: p.nameFr, lat: String(p.lat), lng: String(p.lng) });
                        }}
                        data-testid={`button-edit-place-${p.id}`}
                      >
                        <Settings className="w-3 h-3 mr-1" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs rounded-lg"
                        onClick={() => { if (confirm('Supprimer ce lieu ?')) deletePlace.mutate(p.id); }}
                        data-testid={`button-delete-place-${p.id}`}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Suppr.
                      </Button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showAdd || !!editPlace} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditPlace(null); } }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editPlace ? 'Modifier le lieu' : 'Ajouter un lieu'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nom (Malagasy)</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Bazary Be" className="rounded-xl" data-testid="input-place-name" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nom (Français)</label>
              <Input value={form.nameFr} onChange={e => setForm({ ...form, nameFr: e.target.value })} placeholder="Grand Marché" className="rounded-xl" data-testid="input-place-namefr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Latitude</label>
                <Input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="-25.0320" className="rounded-xl" data-testid="input-place-lat" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Longitude</label>
                <Input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="46.9895" className="rounded-xl" data-testid="input-place-lng" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full rounded-xl"
              disabled={!form.name || !form.nameFr || !form.lat || !form.lng || createPlace.isPending || updatePlace.isPending}
              onClick={() => {
                if (editPlace) {
                  updatePlace.mutate({ id: editPlace.id, ...form });
                } else {
                  createPlace.mutate(form);
                }
              }}
              data-testid="button-save-place"
            >
              {(createPlace.isPending || updatePlace.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editPlace ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchUsers, setSearchUsers] = useState('');
  const [searchRides, setSearchRides] = useState('');
  const [searchDrivers, setSearchDrivers] = useState('');
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRideId, setCancelRideId] = useState<number | null>(null);
  const [rideStatusFilter, setRideStatusFilter] = useState('ALL');
  const [driverStatusFilter, setDriverStatusFilter] = useState('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [ridesPage, setRidesPage] = useState(1);
  const [driversPage, setDriversPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => (await fetch('/api/admin/stats', { credentials: 'include' })).json(),
    refetchInterval: 10000,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: [api.admin.getUsers.path],
    queryFn: async () => (await fetch(api.admin.getUsers.path, { credentials: 'include' })).json(),
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: [api.admin.getDrivers.path],
    queryFn: async () => (await fetch(api.admin.getDrivers.path, { credentials: 'include' })).json(),
  });

  const { data: rides = [], isLoading: ridesLoading } = useQuery({
    queryKey: [api.admin.getRides.path],
    queryFn: async () => (await fetch(api.admin.getRides.path, { credentials: 'include' })).json(),
    refetchInterval: 5000,
  });

  const { data: config } = useQuery({
    queryKey: [api.admin.getConfig.path],
    queryFn: async () => (await fetch(api.admin.getConfig.path, { credentials: 'include' })).json(),
  });

  const { data: driverLocations = [] } = useQuery({
    queryKey: ['/api/admin/driver-locations'],
    queryFn: async () => (await fetch('/api/admin/driver-locations', { credentials: 'include' })).json(),
    refetchInterval: 10000,
  });

  const updateDriverStatus = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const url = buildUrl(api.admin.updateDriverStatus.path, { id });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.getDrivers.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({ title: 'Statut mis à jour' });
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 500);
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible de mettre à jour le statut', variant: 'destructive' }),
  });

  const blockUser = useMutation({
    mutationFn: async ({ id, blocked }: { id: number; blocked: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocked }), credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.getUsers.path] });
      toast({ title: 'Utilisateur mis à jour' });
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 500);
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible de modifier l\'utilisateur', variant: 'destructive' }),
  });

  const adminCancelRide = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/admin/rides/${id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }), credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.getRides.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setShowCancelDialog(false);
      setCancelReason('');
      toast({ title: 'Course annulée' });
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 500);
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible d\'annuler la course', variant: 'destructive' }),
  });

  const updateConfig = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.admin.updateConfig.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.getConfig.path] });
      toast({ title: 'Configuration mise à jour' });
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible de sauvegarder la configuration', variant: 'destructive' }),
  });

  const filteredRides = useMemo(() => {
    let result = rides;
    if (rideStatusFilter !== 'ALL') result = result.filter((r: any) => r.status === rideStatusFilter);
    if (searchRides) {
      const q = searchRides.toLowerCase();
      result = result.filter((r: any) =>
        r.passenger?.name?.toLowerCase().includes(q) ||
        r.passenger?.phone?.includes(q) ||
        r.pickupAddress?.toLowerCase().includes(q) ||
        r.dropAddress?.toLowerCase().includes(q) ||
        String(r.id).includes(q)
      );
    }
    return result;
  }, [rides, rideStatusFilter, searchRides]);

  const filteredDrivers = useMemo(() => {
    let result = drivers;
    if (driverStatusFilter !== 'ALL') result = result.filter((d: any) => d.profile?.status === driverStatusFilter);
    if (searchDrivers) {
      const q = searchDrivers.toLowerCase();
      result = result.filter((d: any) =>
        d.name?.toLowerCase().includes(q) ||
        d.phone?.includes(q) ||
        d.profile?.vehicleType?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [drivers, driverStatusFilter, searchDrivers]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (userRoleFilter !== 'ALL') result = result.filter((u: any) => u.role === userRoleFilter);
    if (searchUsers) {
      const q = searchUsers.toLowerCase();
      result = result.filter((u: any) =>
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    }
    return result;
  }, [users, userRoleFilter, searchUsers]);

  const ridePages = Math.max(1, Math.ceil(filteredRides.length / PAGE_SIZE));
  const driverPages = Math.max(1, Math.ceil(filteredDrivers.length / PAGE_SIZE));
  const userPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

  const pagedRides = filteredRides.slice((ridesPage - 1) * PAGE_SIZE, ridesPage * PAGE_SIZE);
  const pagedDrivers = filteredDrivers.slice((driversPage - 1) * PAGE_SIZE, driversPage * PAGE_SIZE);
  const pagedUsers = filteredUsers.slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE);

  useEffect(() => { setRidesPage(1); }, [rideStatusFilter, searchRides]);
  useEffect(() => { setDriversPage(1); }, [driverStatusFilter, searchDrivers]);
  useEffect(() => { setUsersPage(1); }, [userRoleFilter, searchUsers]);

  const activeRides = rides.filter((r: any) => ['REQUESTED', 'BIDDING', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(r.status));

  const isLoading = statsLoading || usersLoading || driversLoading || ridesLoading;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <RefreshIndicator isRefreshing={isRefreshing} />
      
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-border/50 px-4 md:px-8 py-3">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display" data-testid="text-admin-title">Farady Admin</h1>
              <p className="text-xs text-muted-foreground">Panneau d'administration</p>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            {stats?.activeRides > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Badge className="bg-green-500/10 text-green-600 border-green-200 animate-pulse" data-testid="badge-active-rides">
                  <Activity className="w-3 h-3 mr-1" /> {stats.activeRides} en cours
                </Badge>
              </motion.div>
            )}
            <motion.div
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TabsList className="bg-white dark:bg-zinc-900 border border-border/50 rounded-xl p-1 w-full md:w-auto flex flex-wrap gap-0" data-testid="admin-tabs">
              <TabsTrigger value="overview" className="rounded-lg text-xs md:text-sm" data-testid="tab-overview">
                <TrendingUp className="w-4 h-4 mr-1.5" /> Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger value="rides" className="rounded-lg text-xs md:text-sm" data-testid="tab-rides">
                <Route className="w-4 h-4 mr-1.5" /> Courses
              </TabsTrigger>
              <TabsTrigger value="drivers" className="rounded-lg text-xs md:text-sm" data-testid="tab-drivers">
                <Car className="w-4 h-4 mr-1.5" /> Chauffeurs
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-lg text-xs md:text-sm" data-testid="tab-users">
                <Users className="w-4 h-4 mr-1.5" /> Utilisateurs
              </TabsTrigger>
              <TabsTrigger value="locations" className="rounded-lg text-xs md:text-sm" data-testid="tab-locations">
                <MapPin className="w-4 h-4 mr-1.5" /> Lieux
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg text-xs md:text-sm" data-testid="tab-settings">
                <Settings className="w-4 h-4 mr-1.5" /> Paramètres
              </TabsTrigger>
            </TabsList>
          </motion.div>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard icon={<Users className="w-5 h-5" />} label="Utilisateurs" value={stats?.totalUsers || 0} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/30" delay={0} />
              <StatCard icon={<Car className="w-5 h-5" />} label="Chauffeurs" value={stats?.totalDrivers || 0} color="text-purple-500" bg="bg-purple-50 dark:bg-purple-950/30" sub={`${stats?.onlineDrivers || 0} en ligne`} delay={0.1} />
              <StatCard icon={<Route className="w-5 h-5" />} label="Total courses" value={stats?.totalRides || 0} color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-950/30" sub={`${stats?.completedRides || 0} terminées`} delay={0.2} />
              <StatCard icon={<DollarSign className="w-5 h-5" />} label="Revenu total" value={formatAr(stats?.totalRevenue || 0)} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/30" delay={0.3} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <MiniStat label="Courses actives" value={stats?.activeRides || 0} icon={<Activity className="w-4 h-4 text-green-500" />} delay={0.4} />
              <MiniStat label="Annulées" value={stats?.canceledRides || 0} icon={<XCircle className="w-4 h-4 text-red-500" />} delay={0.5} />
              <MiniStat label="En attente" value={stats?.pendingDrivers || 0} icon={<Clock className="w-4 h-4 text-amber-500" />} delay={0.6} />
              <MiniStat label="En ligne" value={stats?.onlineDrivers || 0} icon={<CircleDot className="w-4 h-4 text-green-500" />} delay={0.7} />
            </div>

            {/* Real-time map */}
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/50 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Carte en temps réel</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Chauffeurs</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Courses</span>
                </div>
              </div>
              <AdminMap activeRides={activeRides} driverLocations={driverLocations} />
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-green-500" /> Courses en temps réel</h3>
                  <Badge variant="outline" className="text-xs">{activeRides.length} actives</Badge>
                </div>
                <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
                  {activeRides.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Aucune course active</div>
                  ) : (
                    activeRides.slice(0, 10).map((r: any, idx: number) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedRide(r)}
                        data-testid={`ride-active-${r.id}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm">#{r.id} — {r.passenger?.name || 'Passager'}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || ''}`}>{r.status.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-green-500" /> {r.pickupAddress?.slice(0, 30)}...
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Navigation className="w-3 h-3 text-red-400" /> {r.dropAddress?.slice(0, 30)}...
                        </div>
                        {r.selectedPriceAr && <div className="text-xs font-bold text-primary mt-1">{formatAr(r.selectedPriceAr)}</div>}
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Car className="w-4 h-4 text-purple-500" /> Chauffeurs récents</h3>
                  <Badge variant="outline" className="text-xs">{drivers.length} total</Badge>
                </div>
                <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
                  {drivers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Aucun chauffeur</div>
                  ) : (
                    drivers.slice(0, 10).map((d: any, idx: number) => (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedDriver(d)}
                        data-testid={`driver-row-${d.id}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium text-sm">{d.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{d.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {d.profile?.online && <CircleDot className="w-3 h-3 text-green-500" />}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${driverStatusColors[d.profile?.status] || ''}`}>{d.profile?.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {d.profile?.vehicleType === 'BAJAJ' ? <Bike className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                            {d.profile?.vehicleType}
                          </span>
                          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> {d.profile?.ratingAvg || '—'}</span>
                          <span>{d.completedRides || 0} courses</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ===== RIDES TAB ===== */}
          <TabsContent value="rides" className="space-y-4 mt-0">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <h2 className="text-xl font-bold font-display">Gestion des courses</h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Select value={rideStatusFilter} onValueChange={setRideStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44 rounded-xl h-9 text-xs" data-testid="select-ride-status">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les statuts</SelectItem>
                    <SelectItem value="REQUESTED">Demandée</SelectItem>
                    <SelectItem value="BIDDING">Enchères</SelectItem>
                    <SelectItem value="ASSIGNED">Assignée</SelectItem>
                    <SelectItem value="DRIVER_EN_ROUTE">Chauffeur en route</SelectItem>
                    <SelectItem value="DRIVER_ARRIVED">Chauffeur arrivé</SelectItem>
                    <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                    <SelectItem value="COMPLETED">Terminée</SelectItem>
                    <SelectItem value="CANCELED">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Rechercher course, passager, adresse..." value={searchRides} onChange={e => setSearchRides(e.target.value)} className="pl-9 rounded-xl h-9 text-xs" data-testid="input-search-rides" />
                </div>
              </div>
            </div>

            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-3 font-semibold">#</th>
                      <th className="p-3 font-semibold">Passager</th>
                      <th className="p-3 font-semibold">Chauffeur</th>
                      <th className="p-3 font-semibold hidden md:table-cell">Trajet</th>
                      <th className="p-3 font-semibold">Statut</th>
                      <th className="p-3 font-semibold hidden md:table-cell">Prix</th>
                      <th className="p-3 font-semibold hidden lg:table-cell">Distance</th>
                      <th className="p-3 font-semibold hidden lg:table-cell">Date</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {pagedRides.map((r: any, idx: number) => (
                      <motion.tr 
                        key={r.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-muted/20 transition-colors" 
                        data-testid={`ride-row-${r.id}`}
                      >
                        <td className="p-3 font-mono text-xs font-bold">{r.id}</td>
                        <td className="p-3">
                          <div className="font-medium text-sm">{r.passenger?.name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.passenger?.phone}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-sm">{r.driver?.name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.driver?.phone || ''}</div>
                        </td>
                        <td className="p-3 hidden md:table-cell max-w-[200px]">
                          <div className="text-xs truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500 shrink-0" /> {r.pickupAddress}</div>
                          <div className="text-xs truncate flex items-center gap-1 text-muted-foreground"><Navigation className="w-3 h-3 text-red-400 shrink-0" /> {r.dropAddress}</div>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusColors[r.status] || ''}`}>{r.status.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell font-bold text-sm">{r.selectedPriceAr ? formatAr(r.selectedPriceAr) : '—'}</td>
                        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {r.distanceKm ? `${parseFloat(r.distanceKm).toFixed(1)} km` : '—'}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedRide(r)} data-testid={`button-view-ride-${r.id}`}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {!['COMPLETED', 'CANCELED'].includes(r.status) && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => { setCancelRideId(r.id); setShowCancelDialog(true); }} data-testid={`button-cancel-ride-${r.id}`}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filteredRides.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucune course trouvée</div>}
              </div>
              <Pagination current={ridesPage} total={ridePages} onChange={setRidesPage} count={filteredRides.length} />
            </Card>
          </TabsContent>

          {/* ===== DRIVERS TAB ===== */}
          <TabsContent value="drivers" className="space-y-4 mt-0">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <h2 className="text-xl font-bold font-display">Gestion des chauffeurs</h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Select value={driverStatusFilter} onValueChange={setDriverStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40 rounded-xl h-9 text-xs" data-testid="select-driver-status">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les statuts</SelectItem>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="APPROVED">Approuvé</SelectItem>
                    <SelectItem value="REJECTED">Rejeté</SelectItem>
                    <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Rechercher chauffeur..." value={searchDrivers} onChange={e => setSearchDrivers(e.target.value)} className="pl-9 rounded-xl h-9 text-xs" data-testid="input-search-drivers" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedDrivers.map((d: any, idx: number) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                >
                  <Card className="rounded-2xl border-0 shadow-sm overflow-hidden hover:shadow-md transition-all" data-testid={`card-driver-${d.id}`}>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center"
                          >
                            <Users className="w-6 h-6 text-muted-foreground" />
                          </motion.div>
                          <div>
                            <h4 className="font-bold text-sm">{d.name}</h4>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {d.phone}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${driverStatusColors[d.profile?.status] || ''}`}>{d.profile?.status}</span>
                          {d.profile?.online && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium flex items-center gap-1"><CircleDot className="w-2 h-2" /> En ligne</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">Véhicule</div>
                          <div className="font-bold text-xs flex items-center justify-center gap-1">
                            {d.profile?.vehicleType === 'BAJAJ' ? <Bike className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                            {d.profile?.vehicleType}
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">Note</div>
                          <div className="font-bold text-xs flex items-center justify-center gap-1">
                            <Star className="w-3 h-3 text-amber-400" /> {d.profile?.ratingAvg || '0.00'}
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">Courses</div>
                          <div className="font-bold text-xs">{d.completedRides || 0}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>Gains: <span className="font-bold text-foreground">{formatAr(d.totalEarnings || 0)}</span></span>
                        <span>{d.profile?.ratingCount || 0} avis</span>
                      </div>

                      <div className="flex gap-2">
                        {d.profile?.status === 'PENDING' && (
                          <>
                            <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-green-500 hover:bg-green-600 text-white" onClick={() => updateDriverStatus.mutate({ id: d.profile.id, action: 'APPROVE' })} data-testid={`button-approve-${d.id}`}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Approuver
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs rounded-lg" onClick={() => updateDriverStatus.mutate({ id: d.profile.id, action: 'REJECT' })} data-testid={`button-reject-${d.id}`}>
                              <XCircle className="w-3 h-3 mr-1" /> Rejeter
                            </Button>
                          </>
                        )}
                        {d.profile?.status === 'APPROVED' && (
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-lg text-amber-600" onClick={() => updateDriverStatus.mutate({ id: d.profile.id, action: 'SUSPEND' })} data-testid={`button-suspend-${d.id}`}>
                            <Ban className="w-3 h-3 mr-1" /> Suspendre
                          </Button>
                        )}
                        {d.profile?.status === 'SUSPENDED' && (
                          <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-green-500 hover:bg-green-600 text-white" onClick={() => updateDriverStatus.mutate({ id: d.profile.id, action: 'APPROVE' })} data-testid={`button-reactivate-${d.id}`}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Réactiver
                          </Button>
                        )}
                        {d.profile?.status === 'REJECTED' && (
                          <Button size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => updateDriverStatus.mutate({ id: d.profile.id, action: 'APPROVE' })} data-testid={`button-approve-rejected-${d.id}`}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Approuver
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedDriver(d)} data-testid={`button-details-driver-${d.id}`}>
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
              {filteredDrivers.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground text-sm">Aucun chauffeur trouvé</div>
              )}
            </div>
            <Pagination current={driversPage} total={driverPages} onChange={setDriversPage} count={filteredDrivers.length} />
          </TabsContent>

          {/* ===== USERS TAB ===== */}
          <TabsContent value="users" className="space-y-4 mt-0">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <h2 className="text-xl font-bold font-display">Gestion des utilisateurs</h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-full sm:w-40 rounded-xl h-9 text-xs" data-testid="select-user-role">
                    <SelectValue placeholder="Filtrer par rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les rôles</SelectItem>
                    <SelectItem value="PASSENGER">Passager</SelectItem>
                    <SelectItem value="DRIVER">Chauffeur</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Rechercher utilisateur..." value={searchUsers} onChange={e => setSearchUsers(e.target.value)} className="pl-9 rounded-xl h-9 text-xs" data-testid="input-search-users" />
                </div>
              </div>
            </div>

            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-3 font-semibold">#</th>
                      <th className="p-3 font-semibold">Nom</th>
                      <th className="p-3 font-semibold">Téléphone</th>
                      <th className="p-3 font-semibold">Rôle</th>
                      <th className="p-3 font-semibold hidden md:table-cell">Langue</th>
                      <th className="p-3 font-semibold hidden md:table-cell">Inscrit le</th>
                      <th className="p-3 font-semibold">Statut</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {pagedUsers.map((u: any, idx: number) => (
                      <motion.tr 
                        key={u.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-muted/20 transition-colors" 
                        data-testid={`user-row-${u.id}`}
                      >
                        <td className="p-3 font-mono text-xs font-bold">{u.id}</td>
                        <td className="p-3 font-medium">{u.name}</td>
                        <td className="p-3 text-muted-foreground">{u.phone}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {u.role === 'ADMIN' ? <Shield className="w-2.5 h-2.5 mr-1" /> : u.role === 'DRIVER' ? <Car className="w-2.5 h-2.5 mr-1" /> : <Users className="w-2.5 h-2.5 mr-1" />}
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs">{u.language === 'mg' ? 'Malagasy' : 'Français'}</td>
                        <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                        <td className="p-3">
                          {u.isBlocked ? (
                            <Badge variant="destructive" className="text-[10px]"><Ban className="w-2.5 h-2.5 mr-1" /> Bloqué</Badge>
                          ) : (
                            <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><UserCheck className="w-2.5 h-2.5 mr-1" /> Actif</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            {u.role !== 'ADMIN' && (
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Button
                                  size="icon" variant="ghost"
                                  className={`h-7 w-7 ${u.isBlocked ? 'text-green-500' : 'text-red-500'}`}
                                  onClick={() => blockUser.mutate({ id: u.id, blocked: !u.isBlocked })}
                                  data-testid={`button-toggle-block-${u.id}`}
                                >
                                  {u.isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Aucun utilisateur trouvé</div>}
              </div>
              <Pagination current={usersPage} total={userPages} onChange={setUsersPage} count={filteredUsers.length} />
            </Card>
          </TabsContent>

          {/* ===== LOCATIONS TAB ===== */}
          <TabsContent value="locations" className="space-y-4 mt-0">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <h2 className="text-xl font-bold font-display">Gestion des lieux</h2>
            </div>
            <LocationsManager />
          </TabsContent>

          {/* ===== SETTINGS TAB ===== */}
          <TabsContent value="settings" className="space-y-6 mt-0">
            <h2 className="text-xl font-bold font-display">Configuration de la plateforme</h2>
            {config && <ConfigForm config={config} onSave={(data: any) => updateConfig.mutate(data)} isPending={updateConfig.isPending} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Course #{selectedRide?.id}</DialogTitle>
          </DialogHeader>
          {selectedRide && <RideDetailView ride={selectedRide} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDriver} onOpenChange={() => setSelectedDriver(null)}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Profil chauffeur</DialogTitle>
          </DialogHeader>
          {selectedDriver && <DriverDetailView driver={selectedDriver} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Annuler la course #{cancelRideId}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Raison de l'annulation..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="rounded-xl" data-testid="input-cancel-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Retour</Button>
            <Button variant="destructive" disabled={adminCancelRide.isPending} onClick={() => cancelRideId && adminCancelRide.mutate({ id: cancelRideId, reason: cancelReason })} data-testid="button-confirm-cancel">
              {adminCancelRide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer l\'annulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}