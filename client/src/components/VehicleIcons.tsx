// client/src/components/VehicleIcons.tsx - TOUTES LES ICÔNES POUR VÉHICULES
import React from 'react';

// ==================== ICÔNES SVG COMPLÈTES ====================

interface VehicleIconProps {
  type: 'TAXI' | 'BAJAJ' | 'CAMION' | '4X4' | 'MOTO' | 'BUS' | 'VAN' | 'SEDAN';
  size?: number;
  color?: string;
  className?: string;
}

// Icône Taxi
export const TaxiIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#F59E0B', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="10" width="16" height="8" rx="2" fill={color} />
    <circle cx="8" cy="16" r="2" fill="white" />
    <circle cx="16" cy="16" r="2" fill="white" />
    <path d="M8 10 L11 7 L13 7 L16 10" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="9" y="4" width="6" height="3" rx="1" fill="#FFD700" />
    <text x="12" y="6.5" textAnchor="middle" fontSize="4" fill="black" fontWeight="bold">TAXI</text>
  </svg>
);

// Icône Bajaj
export const BajajIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#10B981', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="11" width="18" height="6" rx="2" fill={color} />
    <circle cx="7" cy="16" r="2" fill="white" />
    <circle cx="17" cy="16" r="2" fill="white" />
    <rect x="8" y="7" width="8" height="4" rx="1" fill="#FFD700" />
    <text x="12" y="10" textAnchor="middle" fontSize="4" fill="black" fontWeight="bold">BAJAJ</text>
    <path d="M12 11 L14 8" stroke={color} strokeWidth="1" />
    <path d="M12 11 L10 8" stroke={color} strokeWidth="1" />
  </svg>
);

// Icône Camion
export const TruckIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#3B82F6', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="10" width="12" height="7" rx="1" fill={color} />
    <circle cx="5.5" cy="16" r="1.5" fill="white" />
    <circle cx="10.5" cy="16" r="1.5" fill="white" />
    <rect x="14" y="8" width="8" height="5" rx="1" fill="#FFD700" />
    <text x="18" y="11.5" textAnchor="middle" fontSize="3.5" fill="black" fontWeight="bold">CAMION</text>
    <circle cx="18.5" cy="16" r="1.5" fill="white" />
    <circle cx="21.5" cy="16" r="1.5" fill="white" />
    <path d="M14 10 L18 10" stroke="white" strokeWidth="1" />
  </svg>
);

// Icône 4x4 SUV
export const FourByFourIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#8B5CF6', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="10" width="18" height="8" rx="2" fill={color} />
    <circle cx="7" cy="16" r="2" fill="white" />
    <circle cx="17" cy="16" r="2" fill="white" />
    <path d="M7 10 L9 6 L15 6 L17 10" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="9" y="3" width="6" height="3" rx="1" fill="#FFD700" />
    <text x="12" y="5.5" textAnchor="middle" fontSize="4" fill="black" fontWeight="bold">4x4</text>
  </svg>
);

// Icône Moto
export const MotoIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#EF4444', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="6" cy="16" r="3" fill="white" stroke={color} strokeWidth="1.5" />
    <circle cx="18" cy="16" r="3" fill="white" stroke={color} strokeWidth="1.5" />
    <path d="M12 16 L12 10 L15 10" stroke={color} strokeWidth="2" fill="none" />
    <path d="M12 10 L9 8" stroke={color} strokeWidth="2" />
    <rect x="14" y="12" width="3" height="2" rx="1" fill={color} />
    <circle cx="12" cy="16" r="1.5" fill={color} />
  </svg>
);

// Icône Bus
export const BusIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#EC4899', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="8" width="20" height="12" rx="2" fill={color} />
    <circle cx="6" cy="18" r="2" fill="white" />
    <circle cx="18" cy="18" r="2" fill="white" />
    <rect x="4" y="10" width="16" height="3" fill="white" opacity="0.3" />
    <rect x="6" y="6" width="12" height="2" fill="#FFD700" />
    <text x="12" y="7.5" textAnchor="middle" fontSize="4" fill="black" fontWeight="bold">BUS</text>
  </svg>
);

// Icône Van utilitaire
export const VanIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#06B6D4', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="10" width="14" height="7" rx="1" fill={color} />
    <rect x="17" y="8" width="5" height="9" rx="1" fill={color} />
    <circle cx="6" cy="16" r="2" fill="white" />
    <circle cx="18" cy="16" r="2" fill="white" />
    <rect x="4" y="12" width="8" height="2" fill="white" opacity="0.5" />
  </svg>
);

// Icône Berline
export const SedanIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = '#6B7280', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 17L2 19H8L7 17" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M16 17L15 19H21L20 17" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="4" y="9" width="16" height="8" rx="2" fill={color} />
    <circle cx="7.5" cy="15" r="1.5" fill="white" />
    <circle cx="16.5" cy="15" r="1.5" fill="white" />
    <path d="M7 9L9 6H15L17 9" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
);

// Composant principal
export const VehicleIcon: React.FC<VehicleIconProps> = ({ type, size = 32, color, className = '' }) => {
  const props = { size, color, className };
  
  switch (type) {
    case 'TAXI': return <TaxiIcon {...props} />;
    case 'BAJAJ': return <BajajIcon {...props} />;
    case 'CAMION': return <TruckIcon {...props} />;
    case '4X4': return <FourByFourIcon {...props} />;
    case 'MOTO': return <MotoIcon {...props} />;
    case 'BUS': return <BusIcon {...props} />;
    case 'VAN': return <VanIcon {...props} />;
    case 'SEDAN': return <SedanIcon {...props} />;
    default: return <SedanIcon {...props} />;
  }
};

// Obtenir l'icône sous forme de chaîne SVG (pour les marqueurs Leaflet)
export const getVehicleSvgString = (type: string, color: string): string => {
  const icons: Record<string, string> = {
    TAXI: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="16" height="8" rx="2" fill="${color}"/>
      <circle cx="8" cy="16" r="2" fill="white"/>
      <circle cx="16" cy="16" r="2" fill="white"/>
      <path d="M8 10 L11 7 L13 7 L16 10" stroke="${color}" stroke-width="1.5" fill="none"/>
    </svg>`,
    BAJAJ: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="11" width="18" height="6" rx="2" fill="${color}"/>
      <circle cx="7" cy="16" r="2" fill="white"/>
      <circle cx="17" cy="16" r="2" fill="white"/>
      <path d="M12 11 L14 8" stroke="${color}" stroke-width="1"/>
      <path d="M12 11 L10 8" stroke="${color}" stroke-width="1"/>
    </svg>`,
    CAMION: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10" width="12" height="7" rx="1" fill="${color}"/>
      <circle cx="5.5" cy="16" r="1.5" fill="white"/>
      <circle cx="10.5" cy="16" r="1.5" fill="white"/>
      <rect x="14" y="8" width="8" height="5" rx="1" fill="#FFD700"/>
      <circle cx="18.5" cy="16" r="1.5" fill="white"/>
      <circle cx="21.5" cy="16" r="1.5" fill="white"/>
    </svg>`,
    '4X4': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="10" width="18" height="8" rx="2" fill="${color}"/>
      <circle cx="7" cy="16" r="2" fill="white"/>
      <circle cx="17" cy="16" r="2" fill="white"/>
      <path d="M7 10 L9 6 L15 6 L17 10" stroke="${color}" stroke-width="1.5" fill="none"/>
    </svg>`,
  };
  return icons[type] || icons.TAXI;
};