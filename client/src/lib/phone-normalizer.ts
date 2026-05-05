export interface PhoneValidationResult {
    valid: boolean;
    normalized: string;    // Format E.164 : +261XXXXXXXXX
    error: string | null;
  }
  
  /**
   * Normalise un numéro malgache vers le format international +261...
   * Exemples acceptés :
   * - 0341234567   → +261341234567
   * - 034 12 345 67 → +261341234567
   * - +261341234567 → +261341234567
   * - 261341234567  → +261341234567
   */
  export function normalizePhone(phone: string): PhoneValidationResult {
    let cleaned = phone.trim().replace(/[^\d+]/g, '');
  
    if (!cleaned) {
      return { valid: false, normalized: '', error: 'Le numéro est requis' };
    }
  
    // Déjà au format international complet
    if (cleaned.startsWith('+261')) {
      if (cleaned.length !== 13) {
        return { valid: false, normalized: '', error: 'Format international invalide (+261 suivi de 9 chiffres)' };
      }
      const afterPrefix = cleaned.slice(4);
      if (!/^\d{9}$/.test(afterPrefix)) {
        return { valid: false, normalized: '', error: 'Le numéro doit contenir 9 chiffres après +261' };
      }
      return { valid: true, normalized: cleaned, error: null };
    }
  
    // Format sans + : 261........
    if (cleaned.startsWith('261')) {
      if (cleaned.length !== 12) {
        return { valid: false, normalized: '', error: 'Format invalide (261 suivi de 9 chiffres)' };
      }
      const afterPrefix = cleaned.slice(3);
      if (!/^\d{9}$/.test(afterPrefix)) {
        return { valid: false, normalized: '', error: 'Le numéro doit contenir 9 chiffres après 261' };
      }
      return { valid: true, normalized: `+${cleaned}`, error: null };
    }
  
    // Format local 10 chiffres commençant par 03 ou 04
    if (cleaned.length === 10 && /^(03|04)\d{8}$/.test(cleaned)) {
      return { valid: true, normalized: `+261${cleaned.slice(1)}`, error: null };
    }
  
    // Format 9 chiffres (il manque le premier 0)
    if (cleaned.length === 9 && /^[34]\d{8}$/.test(cleaned)) {
      return { valid: true, normalized: `+261${cleaned}`, error: null };
    }
  
    // Messages d'erreur spécifiques
    if (cleaned.startsWith('0') && cleaned.length < 10) {
      return { valid: false, normalized: '', error: `Numéro incomplet (${cleaned.length}/10 chiffres requis)` };
    }
    if (cleaned.length > 13) {
      return { valid: false, normalized: '', error: 'Numéro trop long (maximum 13 caractères)' };
    }
  
    return { valid: false, normalized: '', error: 'Numéro invalide. Utilisez 034XXXXXXX ou +26134XXXXXXX' };
  }