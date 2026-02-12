import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.petronel.traveltok',
  appName: 'Travel Tok Pro',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,  // <--- ASTA E CHEIA!
    },
  },
};

export default config;