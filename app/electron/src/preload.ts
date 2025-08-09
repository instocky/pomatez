import { contextBridge, ipcRenderer, shell } from "electron";
import { TO_MAIN, FROM_MAIN } from "@pomatez/shareables";

// https://github.com/electron/electron/issues/9920#issuecomment-575839738

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, ...args: any[]) => {
    if (TO_MAIN.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  receive: (channel: string, response: (...args: any[]) => void) => {
    if (FROM_MAIN.includes(channel)) {
      ipcRenderer.on(
        channel,
        (event: Electron.IpcRendererEvent, ...args) => {
          return response(...args);
        }
      );
    }
  },
  openExternal: (
    url: string,
    options?: Electron.OpenExternalOptions
  ) => {
    shell.openExternal(url);
  },
  // Добавляем поддержку ipcRenderer для наших Pomodoro API вызовов
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => {
      if (TO_MAIN.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(
        new Error(`Channel ${channel} not allowed`)
      );
    },
    on: (channel: string, listener: (...args: any[]) => void) => {
      if (FROM_MAIN.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => listener(...args));
      }
    },
    removeAllListeners: (channel: string) => {
      if (FROM_MAIN.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
  },
});
