import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kihap.app',
  appName: 'Kihap',
  webDir: 'www',
  ios: {
    appendUserAgent: 'KihapApp'
  },
  android: {
    appendUserAgent: 'KihapApp'
  }
};

export default config;
