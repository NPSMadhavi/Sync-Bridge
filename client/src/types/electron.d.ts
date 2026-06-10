declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      sendMessage: (channel: string, data: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

export {}; 