// client/src/components/Map.tsx - Version PNG avec icônes transparentes et popups stylisés
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Correction pour les icônes Leaflet par défaut
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ==================== UTILITAIRES POUR LES CHEMINS PNG ====================
const getVehicleIconUrl = (vehicleType?: string): string => {
  const type = vehicleType?.toUpperCase() || 'DEFAULT';
  const baseUrl = '/images/vehicles/';
  
  const mapping: Record<string, string> = {
    'TAXI': 'taxi.png',
    'BAJAJ': 'bajaj.png',
    'CAMION': 'camion.png',
    '4X4': '4x4.png',
    'DEFAULT': 'default.png'
  };
  
  const filename = mapping[type] || mapping.DEFAULT;
  return `${baseUrl}${filename}`;
};

// ==================== ICÔNES DES CONDUCTEURS (PNG sans fond) ====================
function createDriverIcon(vehicleType?: string, rating?: number, isAssigned?: boolean) {
  const iconUrl = getVehicleIconUrl(vehicleType);
  return L.icon({
    iconUrl,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
    className: isAssigned ? 'driver-pulse' : ''
  });
}

// Icône pour la position actuelle du conducteur (point de départ du conducteur)
function createDriverStartIcon(vehicleType?: string) {
  const iconUrl = getVehicleIconUrl(vehicleType);
  return L.icon({
    iconUrl,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
    className: 'driver-start-marker'
  });
}

// ==================== ICÔNES POINTS A ET B (sans fond) ====================
function createPickupIcon(vehicleType?: string) {
  if (vehicleType) {
    const iconUrl = getVehicleIconUrl(vehicleType);
    return L.divIcon({
      className: 'custom-pin pickup-pin vehicle-pickup',
      html: `
        <div style="position:relative; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <img src="${iconUrl}" style="width:44px;height:44px;object-fit:contain;" alt="vehicle" />
          <div style="position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);background:#1F2937;color:white;padding:2px 10px;border-radius:16px;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
            Point A - Départ
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });
  }
  // Icône par défaut si pas de véhicule (simple cercle vert, mais sans fond ? on garde le style d'origine mais on peut aussi simplifier)
  return L.divIcon({
    className: 'custom-pin pickup-pin',
    html: `<div style="background:#22C55E;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.2s;">
      <div style="background:white;width:12px;height:12px;border-radius:50%;"></div>
    </div>
    <div style="position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);background:#1F2937;color:white;padding:2px 10px;border-radius:16px;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
      Point A - Départ
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

const dropoffIcon = L.divIcon({
  className: 'custom-pin dropoff-pin',
  html: `<div style="background:#EF4444;width:36px;height:36px;border-radius:8px;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.2s;">
    <div style="background:white;width:12px;height:12px;border-radius:2px;"></div>
  </div>
  <div style="position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);background:#1F2937;color:white;padding:2px 10px;border-radius:16px;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
    Point B - Arrivée
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

// ==================== TYPES & OSRM ====================
export type LatLng = { lat: number; lng: number };

export interface OSRMRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
}

export async function fetchOSRMRoute(pickup: LatLng, dropoff: LatLng): Promise<OSRMRouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;
    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    return {
      coordinates: coords,
      distanceKm: route.distance / 1000,
      durationMin: Math.ceil(route.duration / 60),
    };
  } catch {
    return null;
  }
}

export interface DriverMarkerInfo {
  lat: number;
  lng: number;
  name?: string;
  phone?: string;
  vehicleType?: string;
  rating?: number;
  ratingCount?: number;
  isAssigned?: boolean;
  isDriverStart?: boolean;
}

interface MapPickerProps {
  center?: LatLng;
  zoom?: number;
  pickupMarker?: LatLng | null;
  dropoffMarker?: LatLng | null;
  pickupVehicleType?: string;
  markers?: LatLng[];
  driverMarkers?: DriverMarkerInfo[];
  interactive?: boolean;
  selectMode?: 'pickup' | 'dropoff' | null;
  onLocationSelect?: (loc: LatLng) => void;
  flyToTrigger?: number;
  showRoute?: boolean;
  routeCoordinates?: [number, number][];
}

// ==================== COMPOSANTS INTERNES ====================
function LocationMarker({ onSelect, selectMode }: { onSelect?: (loc: LatLng) => void; selectMode?: 'pickup' | 'dropoff' | null }) {
  useMapEvents({
    click(e) {
      if (onSelect && selectMode) {
        onSelect(e.latlng);
      }
    },
  });
  return null;
}

function MapUpdater({ center, zoom, flyToTrigger }: { center: LatLng; zoom?: number; flyToTrigger?: number }) {
  const map = useMap();
  const lastTrigger = useRef(flyToTrigger);
  useEffect(() => {
    if (flyToTrigger !== undefined && flyToTrigger !== lastTrigger.current) {
      map.flyTo([center.lat, center.lng], zoom || map.getZoom(), { duration: 0.6 });
      lastTrigger.current = flyToTrigger;
    }
  }, [center, zoom, map, flyToTrigger]);
  return null;
}

function FitBounds({ pickup, dropoff, driverMarkers }: { pickup?: LatLng | null; dropoff?: LatLng | null; driverMarkers?: DriverMarkerInfo[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (pickup && dropoff && !fitted.current) {
      const points: [number, number][] = [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ];
      if (driverMarkers) {
        driverMarkers.forEach(d => points.push([d.lat, d.lng]));
      }
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        fitted.current = true;
      }
    }
    if (!pickup || !dropoff) {
      fitted.current = false;
    }
  }, [pickup, dropoff, driverMarkers, map]);
  return null;
}

// Composant Popup personnalisé avec fond transparent (via CSS global)
// On va utiliser le Popup normal de Leaflet mais on override le style avec des classes CSS.
// Dans le rendu, on utilise <Popup> avec className pour personnaliser.

// ==================== COMPOSANT PRINCIPAL ====================
export function MapView({ 
  center = { lat: -18.8792, lng: 47.5079 },  
  zoom = 15,
  pickupMarker,
  dropoffMarker,
  pickupVehicleType,
  markers = [],
  driverMarkers = [],
  interactive = false, 
  selectMode,
  onLocationSelect,
  flyToTrigger,
  showRoute = false,
  routeCoordinates
}: MapPickerProps) {
  const routePositions: [number, number][] = routeCoordinates && routeCoordinates.length > 0
    ? routeCoordinates
    : (showRoute && pickupMarker && dropoffMarker
      ? [[pickupMarker.lat, pickupMarker.lng], [dropoffMarker.lat, dropoffMarker.lng]]
      : []);

  const pickupIcon = pickupVehicleType ? createPickupIcon(pickupVehicleType) : createPickupIcon();

  return (
    <div className="w-full h-full relative z-0">
      {/* Style global pour les popups transparents */}
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          padding: 0;
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
        }
        .custom-popup .leaflet-popup-content {
          margin: 8px 12px;
          color: white;
        }
        .custom-popup a {
          color: #3b82f6;
        }
        .driver-pulse {
          animation: driverPulse 2s infinite;
        }
        @keyframes driverPulse {
          0% { filter: drop-shadow(0 0 0 0 rgba(59, 130, 246, 0.4)); }
          70% { filter: drop-shadow(0 0 0 10px rgba(59, 130, 246, 0)); }
          100% { filter: drop-shadow(0 0 0 0 rgba(59, 130, 246, 0)); }
        }
        .custom-pin:hover > div:first-child { transform: scale(1.1); }
      `}</style>

      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={false}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater center={center} zoom={zoom} flyToTrigger={flyToTrigger} />
        <FitBounds pickup={pickupMarker} dropoff={dropoffMarker} driverMarkers={driverMarkers} />
        
        {interactive && <LocationMarker onSelect={onLocationSelect} selectMode={selectMode} />}

        {/* Tracé de l'itinéraire */}
        {routePositions.length > 0 && (
          <Polyline 
            positions={routePositions}
            pathOptions={{ 
              color: '#3B82F6', 
              weight: 5, 
              opacity: 0.8, 
              lineCap: 'round',
              lineJoin: 'round'
            }} 
          />
        )}
        
        {/* Marqueur de départ */}
        {pickupMarker && (
          <Marker 
            position={[pickupMarker.lat, pickupMarker.lng]} 
            icon={pickupIcon}
            eventHandlers={{
              click: () => {
                // On laisse le popup par défaut, mais on peut aussi afficher un message personnalisé sans popup si on veut.
                // Pour rester simple, on n'ajoute pas de popup ici, on utilise celui de Leaflet si besoin.
                // Mais on peut en ajouter un via le composant <Popup> ci-dessous.
              }
            }}
          >
            {/* Popup transparent pour le point A */}
            <Popup className="custom-popup" autoPan={false}>
              <div className="text-center">
                <strong>Point A - Départ</strong><br />
                {pickupMarker.lat.toFixed(6)}, {pickupMarker.lng.toFixed(6)}<br />
                <button 
                  onClick={() => navigator.clipboard.writeText(`${pickupMarker.lat}, ${pickupMarker.lng}`)}
                  className="mt-1 text-xs bg-white/20 px-2 py-1 rounded-full"
                >
                  Copier
                </button>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Marqueur d'arrivée */}
        {dropoffMarker && (
          <Marker 
            position={[dropoffMarker.lat, dropoffMarker.lng]} 
            icon={dropoffIcon}
          >
            <Popup className="custom-popup" autoPan={false}>
              <div className="text-center">
                <strong>Point B - Arrivée</strong><br />
                {dropoffMarker.lat.toFixed(6)}, {dropoffMarker.lng.toFixed(6)}<br />
                <button 
                  onClick={() => navigator.clipboard.writeText(`${dropoffMarker.lat}, ${dropoffMarker.lng}`)}
                  className="mt-1 text-xs bg-white/20 px-2 py-1 rounded-full"
                >
                  Copier
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marqueurs des conducteurs */}
        {driverMarkers.map((driver, index) => {
          let icon;
          if (driver.isDriverStart) {
            icon = createDriverStartIcon(driver.vehicleType);
          } else {
            icon = createDriverIcon(driver.vehicleType, driver.rating, driver.isAssigned);
          }
          
          const vehicleTypeName = driver.vehicleType === 'TAXI' ? 'Taxi' : 
                                   driver.vehicleType === 'BAJAJ' ? 'Bajaj' :
                                   driver.vehicleType === 'CAMION' ? 'Camion' : 
                                   driver.vehicleType === '4X4' ? '4x4' : 'Véhicule';
          
          return (
            <Marker 
              key={`driver-${index}-${driver.lat}-${driver.lng}`}
              position={[driver.lat, driver.lng]} 
              icon={icon}
            >
              <Popup className="custom-popup">
                <div style={{ minWidth: '160px', padding: '4px 0' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: 'white' }}>
                    {driver.name || 'Chauffeur'}
                  </p>
                  {driver.rating && driver.rating > 0 && (
                    <p style={{ color: '#FBBF24', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
                      ★ {driver.rating.toFixed(1)} ({driver.ratingCount || 0} avis)
                    </p>
                  )}
                  <p style={{ color: '#D1D5DB', fontSize: '11px', marginTop: '4px', marginBottom: '6px' }}>
                    {vehicleTypeName}
                  </p>
                  {driver.phone && (
                    <a 
                      href={`tel:${driver.phone}`} 
                      style={{ 
                        color: '#60A5FA', 
                        fontWeight: 600, 
                        display: 'inline-block', 
                        marginTop: '4px', 
                        fontSize: '11px',
                        textDecoration: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '4px 10px',
                        borderRadius: '20px'
                      }}
                    >
                      📞 Appeler
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Autres marqueurs */}
        {markers.map((m, i) => (
          <Marker key={`marker-${i}`} position={[m.lat, m.lng]} />
        ))}
      </MapContainer>

      {selectMode && (
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-full shadow-lg font-bold text-sm pointer-events-none flex items-center gap-2"
          style={{ backgroundColor: selectMode === 'pickup' ? '#22C55E' : '#EF4444', color: 'white' }}
        >
          {selectMode === 'pickup' ? 'Cliquez sur la carte pour sélectionner le départ' : 'Cliquez sur la carte pour sélectionner l\'arrivée'}
        </div>
      )}
    </div>
  );
}