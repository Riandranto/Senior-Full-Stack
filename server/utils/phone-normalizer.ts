// server/utils/phone-normalizer.ts
export function normalizePhone(phone: string): string | null {
    let cleaned = phone.trim().replace(/[^\d+]/g, '');
    if (!cleaned) return null;
  
    // Déjà au format international
    if (cleaned.startsWith('+261') && cleaned.length === 13) return cleaned;
  
    // 261...
    if (cleaned.startsWith('261') && cleaned.length === 12) return `+${cleaned}`;
  
    // Format local 10 chiffres commençant par 03 ou 04
    if (cleaned.length === 10 && /^(03|04)\d{8}$/.test(cleaned)) {
      return `+261${cleaned.slice(1)}`;
    }
  
    // 9 chiffres (manque le 0 initial)
    if (cleaned.length === 9 && /^[34]\d{8}$/.test(cleaned)) {
      return `+261${cleaned}`;
    }
  
    return null;
  }