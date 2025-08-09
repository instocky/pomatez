import Electron from "electron";

declare global {
  interface Window {
    electron: {
      send: (channel: string, ...args: any[]) => void;
      recieve: (channel: string, response: Function) => void;
      openExternal: (
        url: string,
        options?: Electron.OpenExternalOptions
      ) => Promise<void>;
      // Добавляем поддержку invoke для наших IPC вызовов
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (
          channel: string,
          listener: (...args: any[]) => void
        ) => void;
        removeAllListeners: (channel: string) => void;
      };
    };
    __TAURI__: {};
  }
}

export {};
