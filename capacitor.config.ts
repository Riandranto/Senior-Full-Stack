import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ridemada.app',
  appName: 'ridemada',
  webDir: 'dist/public',
  server: {
    // Pour Android, utilisez l'URL de votre backend Railway
    androidScheme: 'https',
    // En production, le serveur doit être accessible depuis l'appareil
    url: 'https://ride-mada-mg.up.railway.app',
    // Alternative: utiliser cleartext pour le développement
    // cleartext: true
  },
  android: {
    // Permettre les connexions HTTP en développement (décommentez si besoin)
     allowMixedContent: true
  }
};

export default config;
