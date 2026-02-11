import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app', // Poți schimba asta mai târziu cu ceva unic
  appName: 'travel-tiktok-ai',
  webDir: 'out', // <--- IMPORTANT: Schimbă din 'public' sau 'dist' în 'out'
};

export default config;