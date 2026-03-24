import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.farady.app',
  appName: 'Farady',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://ride-mada-mg.up.railway.app',
  },
  android: {
    allowMixedContent: true,
  },
  // Configuration des assets
  plugins: {
    CapacitorAssets: {
      assets: {
        icon: {
          foreground: './resources/icon-foreground.png',
          background: './resources/icon-background.png'
        },
        splash: {
          drawables: {
            portrait: './resources/splash.png'
          }
        }
      }
    }
  }
};

export default config;