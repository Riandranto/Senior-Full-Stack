// Map.tsx - Version avec icônes de véhicules personnalisées

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background:#22C55E;width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:white;"></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const dropoffIcon = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background:#EF4444;width:30px;height:30px;border-radius:8px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:3px;background:white;"></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// Icône de base pour le driver (quand le type n'est pas spécifié)
const baseDriverIcon = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background:#FFD500;width:26px;height:26px;border-radius:50%;border:3px solid #0F172A;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="2.5"><path d="M5 17h14M5 17a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2M5 17l-1 3m15-3l1 3M8 14h.01M16 14h.01"/></svg></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

// Icônes par type de véhicule
const vehicleIcons: Record<string, string> = {
  TAXI: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="11" width="18" height="8" rx="2" ry="2"/><circle cx="7.5" cy="16.5" r="1.5" fill="white" stroke="none"/><circle cx="16.5" cy="16.5" r="1.5" fill="white" stroke="none"/><polyline points="9 11 12 8 15 11"/></svg>`,
  BAJAJ: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="4" y="12" width="16" height="6" rx="2"/><circle cx="7" cy="17" r="2" fill="white" stroke="none"/><circle cx="17" cy="17" r="2" fill="white" stroke="none"/><path d="M12 12 L12 8 L16 6"/><rect x="8" y="4" width="8" height="4" rx="1"/></svg>`,
  CAMION: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="11" width="14" height="7" rx="1"/><circle cx="6" cy="17" r="2" fill="white" stroke="none"/><circle cx="16" cy="17" r="2" fill="white" stroke="none"/><rect x="16" y="9" width="6" height="4" rx="1"/><path d="M16 13 L22 13"/></svg>`,
  '4X4': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="12" width="18" height="8" rx="2"/><circle cx="7" cy="18" r="2" fill="white" stroke="none"/><circle cx="17" cy="18" r="2" fill="white" stroke="none"/><path d="M3 14 L21 14"/><path d="M8 10 L10 6 L14 6 L16 10"/><path d="M10 6 L10 4 M14 6 L14 4"/></svg>`,
  DEFAULT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M5 17h14M5 17a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2M5 17l-1 3m15-3l1 3M8 14h.01M16 14h.01"/></svg>`
};

// Couleurs par type de véhicule
const vehicleColors: Record<string, string> = {
  TAXI: '#2563EB',
  BAJAJ: '#16A34A',
  CAMION: '#EA580C',
  '4X4': '#DC2626',
  DEFAULT: '#3B82F6'
};

// Fonction pour créer une icône de driver avec son type de véhicule
function createDriverVehicleIcon(vehicleType?: string, rating?: number, isAssigned?: boolean) {
  const type = vehicleType?.toUpperCase() || 'DEFAULT';
  const iconSvg = vehicleIcons[type] || vehicleIcons.DEFAULT;
  const bgColor = vehicleColors[type] || vehicleColors.DEFAULT;
  const size = isAssigned ? 42 : 36;
  const iconSizeVal = isAssigned ? 42 : 36;
  const ratingStr = rating && rating > 0 ? `★${Number(rating).toFixed(1)}` : '';
  
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="position:relative;">
      <div style="background:${bgColor};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;${isAssigned ? 'animation:pulse 2s infinite;' : ''}">
        ${iconSvg}
      </div>
      ${ratingStr ? `<div style="position:absolute;top:-8px;right:-14px;background:#F59E0B;color:#000;font-size:8px;font-weight:800;padding:1px 4px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${ratingStr}</div>` : ''}
    </div>`,
    iconSize: [iconSizeVal, iconSizeVal],
    iconAnchor: [iconSizeVal / 2, iconSizeVal / 2]
  });
}

// Icône pour le point de départ du driver (sa position actuelle)
function createDriverStartIcon(vehicleType?: string) {
  const type = vehicleType?.toUpperCase() || 'DEFAULT';
  const iconSvg = vehicleIcons[type] || vehicleIcons.DEFAULT;
  const bgColor = vehicleColors[type] || vehicleColors.DEFAULT;
  
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="position:relative;">
      <div style="background:${bgColor};width:32px;height:32px;border-radius:50%;border:3px solid #FFD500;box-shadow:0 0 0 3px rgba(255,213,0,0.3);display:flex;align-items:center;justify-content:center;">
        ${iconSvg}
      </div>
      <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #FFD500;"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

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
  isDriverStart?: boolean; // Nouveau: pour indiquer que c'est le point de départ du driver
}

interface MapPickerProps {
  center?: LatLng;
  zoom?: number;
  pickupMarker?: LatLng | null;
  dropoffMarker?: LatLng | null;
  markers?: LatLng[];
  driverMarkers?: DriverMarkerInfo[];
  interactive?: boolean;
  selectMode?: 'pickup' | 'dropoff' | null;
  onLocationSelect?: (loc: LatLng) => void;
  flyToTrigger?: number;
  showRoute?: boolean;
  routeCoordinates?: [number, number][];
}

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
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      fitted.current = true;
    }
    if (!pickup || !dropoff) {
      fitted.current = false;
    }
  }, [pickup, dropoff, driverMarkers, map]);
  return null;
}

export function MapView({ 
  center = { lat: -18.8792, lng: 47.5079 },  
  zoom = 15,
  pickupMarker,
  dropoffMarker,
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

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={false}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} zoom={zoom} flyToTrigger={flyToTrigger} />
        <FitBounds pickup={pickupMarker} dropoff={dropoffMarker} driverMarkers={driverMarkers} />
        
        {interactive && <LocationMarker onSelect={onLocationSelect} selectMode={selectMode} />}

        {routePositions.length > 0 && (
          <Polyline 
            positions={routePositions}
            pathOptions={{ 
              color: '#3B82F6', 
              weight: 4, 
              opacity: 0.8, 
              dashArray: '8, 12',
              lineCap: 'round'
            }} 
          />
        )}
        
        {pickupMarker && (
          <Marker position={[pickupMarker.lat, pickupMarker.lng]} icon={pickupIcon}>
            <Popup className="font-sans text-sm font-semibold">📍 Fiaingana</Popup>
          </Marker>
        )}
        {dropoffMarker && (
          <Marker position={[dropoffMarker.lat, dropoffMarker.lng]} icon={dropoffIcon}>
            <Popup className="font-sans text-sm font-semibold">🏁 Fahatongavana</Popup>
          </Marker>
        )}

        {/* Markers des drivers avec leur type de véhicule */}
        {driverMarkers.map((d, i) => {
          // Si c'est le point de départ du driver, utiliser une icône spéciale
          if (d.isDriverStart) {
            const icon = createDriverStartIcon(d.vehicleType);
            return (
              <Marker 
                key={`driver-start-${i}`}
                position={[d.lat, d.lng]} 
                icon={icon}
              >
                <Popup className="font-sans text-xs">
                  <div style={{ minWidth: '140px' }}>
                    <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>
                      {d.name || 'Toeranako'}
                    </p>
                    <p style={{ color: '#6B7280', fontSize: '11px' }}>🚗 Toerana misy ahy</p>
                    {d.vehicleType && (
                      <p style={{ color: '#6B7280', fontSize: '11px', marginTop: '4px' }}>
                        {d.vehicleType === 'TAXI' ? '🚕 Taxi' : 
                         d.vehicleType === 'BAJAJ' ? '🛺 Bajaj' :
                         d.vehicleType === 'CAMION' ? '🚚 Camion' : '🚙 4x4'}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          }
          
          // Pour les autres drivers, utiliser l'icône avec leur type
          const icon = createDriverVehicleIcon(d.vehicleType, d.rating, d.isAssigned);
          return (
            <Marker 
              key={`driver-${i}-${d.lat}-${d.lng}`}
              position={[d.lat, d.lng]} 
              icon={icon}
            >
              <Popup className="font-sans text-xs">
                <div style={{ minWidth: '140px' }}>
                  <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{d.name || 'Mpamily'}</p>
                  {d.rating && d.rating > 0 && (
                    <p style={{ color: '#F59E0B', fontWeight: 600 }}>★ {Number(d.rating).toFixed(1)} ({d.ratingCount || 0})</p>
                  )}
                  {d.vehicleType && (
                    <p style={{ color: '#6B7280', marginTop: '4px' }}>
                      {d.vehicleType === 'TAXI' ? '🚕 Taxi' : 
                       d.vehicleType === 'BAJAJ' ? '🛺 Bajaj' :
                       d.vehicleType === 'CAMION' ? '🚚 Camion' : '🚙 4x4'}
                    </p>
                  )}
                  {d.phone && (
                    <a href={`tel:${d.phone}`} style={{ color: '#3B82F6', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                      📞 {d.phone}
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {markers.map((m, i) => (
          <Marker key={`m-${i}`} position={[m.lat, m.lng]} icon={baseDriverIcon} />
        ))}
      </MapContainer>

      {selectMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-full shadow-lg font-bold text-sm pointer-events-none flex items-center gap-2"
          style={{ backgroundColor: selectMode === 'pickup' ? '#22C55E' : '#EF4444', color: 'white' }}
          data-testid="map-select-hint"
        >
          {selectMode === 'pickup' ? '👆 Tsindrio ny fiaingana' : '👆 Tsindrio ny fahatongavana'}
        </div>
      )}
    </div>
  );
}