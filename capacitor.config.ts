import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.RideMada.app',
  appName: 'RideMada',
  webDir: 'client/dist', // <-- point vers le front
  bundledWebRuntime: false
};

export default config;