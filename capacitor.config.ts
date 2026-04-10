import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.farady.app',
  appName: 'Farady',
  webDir: 'dist/public',  // Changé de 'dist' à 'dist/public' pour correspondre à votre build
  server: {
    androidScheme: 'https',
    url: 'https://ride-mada-mg.up.railway.app',
    cleartext: true,  // Ajouté pour permettre les connexions HTTP en développement
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'automatic',
  },
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
    },
    Preferences: {
      storage: 'localStorage'
    },
    Network: {
      enabled: true
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#0891b2",
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;