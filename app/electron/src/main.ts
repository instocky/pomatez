import {
  BrowserWindow,
  app,
  ipcMain,
  globalShortcut,
  Menu,
  Tray,
  shell,
  nativeImage,
} from "electron";
import debounce from "lodash.debounce";
import notifier from "node-notifier";
import path from "path";
import {
  SET_ALWAYS_ON_TOP,
  SET_FULLSCREEN_BREAK,
  MINIMIZE_WINDOW,
  CLOSE_WINDOW,
  SET_UI_THEME,
  SET_NATIVE_TITLEBAR,
  SHOW_WINDOW,
  RELEASE_NOTES_LINK,
  TRAY_ICON_UPDATE,
  SET_COMPACT_MODE,
  SET_OPEN_AT_LOGIN,
  // Pomodoro API channels
  POMODORO_CREATE_SESSION,
  POMODORO_START_TRACKING,
  POMODORO_PAUSE_TRACKING,
  POMODORO_STOP_TRACKING,
  POMODORO_GET_SESSION,
  POMODORO_LIST_SESSIONS,
  POMODORO_GET_STATS,
  POMODORO_GET_SETTINGS,
  POMODORO_UPDATE_SETTINGS,
  ACTIVITY_GET_CURRENT,
  // Type imports
  CreateSessionRequest,
  CreateSessionResponse,
  TrackingRequest,
  TrackingResponse,
  GetSessionRequest,
  GetSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  GetStatsRequest,
  GetStatsResponse,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  GetCurrentActivityResponse,
} from "@pomatez/shareables";
import {
  activateGlobalShortcuts,
  activateAutoUpdate,
  blockShortcutKeys,
  getIcon,
  isWindow,
  isMacOS,
  getFromStorage,
  createContextMenu,
} from "./helpers";
import isDev from "electron-is-dev";
import store from "./store";
import { storageManager } from "./api/storage-manager";
import { activityTracker } from "./api/activity-tracker";

import "v8-compile-cache";
import {
  FullscreenState,
  setFullscreenBreakHandler,
} from "./lifecycleEventHandlers/fullScreenBreak";
import WindowsToaster from "node-notifier/notifiers/toaster";
import NotificationCenter from "node-notifier/notifiers/notificationcenter";

const onProduction = app.isPackaged;

const notificationIcon = path.join(
  __dirname,
  "assets/notification-dark.png"
);

const trayIcon = path.join(__dirname, "assets/tray-dark.png");

const onlySingleInstance = app.requestSingleInstanceLock();

const applicationMenu = isMacOS()
  ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }])
  : null;
Menu.setApplicationMenu(applicationMenu);

const getFrameHeight = () => {
  if (isWindow()) {
    return 502;
  } else {
    if (store.safeGet("useNativeTitlebar")) {
      return 488;
    }
    return 502;
  }
};

let tray: Tray | null = null;

let win: BrowserWindow | null;

type WindowStateProps = {
  isOnCompactMode: boolean;
} & FullscreenState;

const windowState: WindowStateProps = {
  isFullscreen: false,
  isOnCompactMode: false,
};

function createMainWindow() {
  win = new BrowserWindow({
    width: 340,
    height: getFrameHeight(),
    resizable: true,
    maximizable: false,
    show: false,
    frame: store.safeGet("useNativeTitlebar"),
    icon: getIcon(),
    backgroundColor: store.safeGet("isDarkMode") ? "#141e25" : "#fff",
    webPreferences: {
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Open the DevTools.
  if (isDev) win.webContents.openDevTools({ mode: "detach" });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  win.loadURL(
    !onProduction
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "index.html")}`
  );

  win.once("ready-to-show", () => {
    win?.show();
  });

  win.on(
    "minimize",
    debounce(
      async () => {
        try {
          if (win) {
            const data = await getFromStorage(win, "state");
            if (data.settings.minimizeToTray) {
              if (!windowState.isFullscreen) {
                win?.hide();
                if (tray === null && data.settings.minimizeToTray) {
                  createSystemTray();
                }
              }
            }
          }
        } catch (error) {
          console.log(error);
        }
      },
      1000,
      { leading: true }
    )
  );
  /**
   * This only exists to counteract an issue with linux where leave-full-screen triggers every time this is called on linux (when exiting fullscreen)
   *
   * It may be fixed in a future version of linux.
   *
   * If you try to set the size smaller than the minimum allowed it will also cause issues here.
   *
   * @param width
   * @param height
   */
  function setSizeIfDiff(width: number, height: number) {
    // Just to stop an infinite loop in the case of a bug
    const minSize = win?.getMinimumSize();
    width = Math.max(width, minSize?.[0] || 0);
    height = Math.max(height, minSize?.[1] || 0);
    const size = win?.getSize();
    if (!size || size[0] !== width || size[1] !== height) {
      win?.setSize(width, height);
    }
  }

  win.on("leave-full-screen", () => {
    if (windowState.isOnCompactMode) {
      setSizeIfDiff(340, 100);
      // Windows doesn't like trying to set it as not resizeable it along with everything else that's going on
      setTimeout(() => {
        win?.setResizable(false);
      });
    } else {
      setSizeIfDiff(340, getFrameHeight());
    }
  });

  win.on(
    "close",
    debounce(
      async (e) => {
        e.preventDefault();
        try {
          if (win) {
            const data = await getFromStorage(win, "state");
            if (!data.settings.closeToTray) {
              app.exit();
            } else {
              if (!windowState.isFullscreen) {
                win?.hide();
                if (tray === null && data.settings.closeToTray) {
                  createSystemTray();
                }
              }
            }
          }
        } catch (error) {
          console.log(error);
        }
      },
      1000,
      { leading: true }
    )
  );

  createContextMenu(win);
}

const trayTooltip = "Just click to restore.";

const contextMenu = Menu.buildFromTemplate([
  {
    label: "Restore the app",
    click: () => {
      win?.show();
    },
  },
  {
    label: "Quit",
    click: () => {
      app.exit();
    },
  },
]);

function createSystemTray() {
  tray = new Tray(trayIcon);

  tray.setToolTip(trayTooltip);
  tray.setContextMenu(contextMenu);

  tray?.on("click", () => {
    if (!win?.isVisible()) {
      win?.show();
    } else {
      if (!win?.isFullScreen()) {
        win?.hide();
      }
    }
  });
}

type NotificationProps = {
  title: string;
  message: string;
  actions: string[];
  callback?: (err: Error | null, response: string) => void;
};

function notify(props: NotificationProps) {
  // This is because it can take different types depending on the initialised OS.
  // Just for some reason, whoever sorted the types out of this library only really considered JS rather than TS.
  const notification: WindowsToaster.Notification &
    NotificationCenter.Notification = {
    icon: notificationIcon,
    title: props.title,
    message: props.message,
    actions: props.actions,
    appID: "com.roldanjr.pomatez",
    sound: true,
    wait: true,
  };

  notifier.notify(notification, (err, response) => {
    if (props.callback) props.callback(err, response);
  });
}

if (!onlySingleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      } else if (!win.isVisible()) {
        win.show();
      } else {
        win.focus();
      }
    }
  });

  app.whenReady().then(async () => {
    if (isDev) {
      console.log("Installing devtools");
      const extensions = ["REACT_DEVELOPER_TOOLS", "REDUX_DEVTOOLS"];
      const installer = await import("electron-devtools-installer");
      console.log(installer);

      for (const tool of extensions) {
        try {
          await installer.default(installer[tool], true);
        } catch (e) {
          console.log(e);
        }
      }
    }

    createMainWindow();

    if (onProduction) {
      if (win) {
        const blockKeys = [
          "CommandOrControl+R",
          "CommandOrControl+Shift+R",
          "CommandOrControl+Alt+Q",
          "F11",
        ];
        blockShortcutKeys(win, blockKeys);
      }
    }

    activateGlobalShortcuts([
      {
        key: "Alt+Shift+H",
        callback: () => {
          win?.hide();
        },
      },
      {
        key: "Alt+Shift+S",
        callback: () => {
          win?.show();
        },
      },
    ]);

    const autoUpdater = activateAutoUpdate({
      onUpdateAvailable: (info) => {
        notify({
          title: "NEW UPDATE IS AVAILABLE",
          message: `App version ${info.version} ready to be downloaded.`,
          actions: ["View Release Notes"],
          callback: (err, response) => {
            if (!err) {
              if (response === "view release notes") {
                shell.openExternal(RELEASE_NOTES_LINK);
              }
            }
          },
        });
      },
      onUpdateDownloaded: (info) => {
        notify({
          title: "READY TO BE INSTALLED",
          message: "Update has been successfully downloaded.",
          // Temporarily commented out due to an issue with snoretoast https://github.com/mikaelbr/node-notifier/issues/332
          actions: ["Quit and Install" /*, "Install it Later"*/],
          callback: (err, response) => {
            if (!err) {
              //if (response === "quit and install") {
              autoUpdater.quitAndInstall();
              //}
            }
          },
        });
      },
    });
  });
}

ipcMain.on(SET_ALWAYS_ON_TOP, (e, { alwaysOnTop }) => {
  win?.setAlwaysOnTop(alwaysOnTop);
});

ipcMain.on(SET_FULLSCREEN_BREAK, (e, args) => {
  setFullscreenBreakHandler(args, {
    win,
    tray,
    trayTooltip,
    contextMenu,
    isFullscreen: windowState.isFullscreen,
  });
});

ipcMain.on(SET_COMPACT_MODE, (e, args) => {
  if (args.compactMode) {
    win?.setMinimumSize(340, 100);
    win?.setSize(340, 100);
    win?.setResizable(false);
    windowState.isOnCompactMode = true;
  } else {
    win?.setResizable(true);
    windowState.isOnCompactMode = false;
    win?.setMinimumSize(340, getFrameHeight());
    win?.setSize(340, getFrameHeight());
  }
});

ipcMain.on(SET_UI_THEME, (e, { isDarkMode }) => {
  store.safeSet("isDarkMode", isDarkMode);
});

ipcMain.on(SHOW_WINDOW, () => {
  if (!win?.isVisible()) {
    win?.show();
  } else {
    win?.focus();
  }
});

ipcMain.on(MINIMIZE_WINDOW, (e, { minimizeToTray }) => {
  if (!minimizeToTray) {
    win?.minimize();
  } else {
    if (tray === null) {
      createSystemTray();
    }
    win?.hide();
  }
});

ipcMain.on(CLOSE_WINDOW, (e, { closeToTray }) => {
  if (!closeToTray) {
    app.exit();
  } else {
    if (tray === null) {
      createSystemTray();
    }
    win?.hide();
  }
});

ipcMain.on(SET_NATIVE_TITLEBAR, (e, { useNativeTitlebar }) => {
  if (store.safeGet("useNativeTitlebar") !== useNativeTitlebar) {
    store.safeSet("useNativeTitlebar", useNativeTitlebar);
    setTimeout(() => {
      app.relaunch();
      app.exit();
    }, 1000);
  }
});

ipcMain.on(TRAY_ICON_UPDATE, (e, dataUrl) => {
  const image = nativeImage.createFromDataURL(dataUrl);
  tray?.setImage(image);
});

ipcMain.on(SET_OPEN_AT_LOGIN, (e, { openAtLogin }) => {
  const storeOpenAtLogin = store.safeGet("openAtLogin");

  if (storeOpenAtLogin !== openAtLogin) {
    store.safeSet("openAtLogin", openAtLogin);

    app.setLoginItemSettings({
      openAtLogin: openAtLogin,
      openAsHidden: openAtLogin,
    });
  }
});

// === POMODORO API HANDLERS ===

// Create new pomodoro session
ipcMain.handle(
  POMODORO_CREATE_SESSION,
  async (
    event,
    request: CreateSessionRequest
  ): Promise<CreateSessionResponse> => {
    try {
      console.log("[Main] Creating pomodoro session:", request);

      // Generate unique ID
      const sessionId = `pomodoro_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create session object
      const session = {
        id: sessionId,
        path: request.path,
        title: request.title,
        status: "created" as const,
        sessionType: request.sessionType,
        targetMinutes: request.targetMinutes,
        totalMinutes: 0,
        activeMinutes: 0,
        description: request.description || "",
        fillColor: "#4CAF50",
        dailyMasks: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to storage
      const success = await storageManager.savePomodoro(session);

      if (success) {
        // Notify renderer about new session
        win?.webContents.send("POMODORO_SESSION_CREATED", { session });

        return {
          success: true,
          session,
        };
      } else {
        throw new Error("Failed to save session to storage");
      }
    } catch (error) {
      console.error("[Main] Failed to create session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Start tracking for session
ipcMain.handle(
  POMODORO_START_TRACKING,
  async (
    event,
    request: TrackingRequest
  ): Promise<TrackingResponse> => {
    try {
      console.log(
        "[Main] Starting tracking for session:",
        request.sessionId
      );

      // Load session
      const session = await storageManager.loadPomodoro(
        request.sessionId
      );
      if (!session) {
        throw new Error(`Session ${request.sessionId} not found`);
      }

      // Update session status
      session.status = "running";
      session.updatedAt = new Date().toISOString();

      const success = await storageManager.savePomodoro(session);

      if (success) {
        // Start activity tracker
        await activityTracker.startTracking(session);

        // Notify renderer
        win?.webContents.send("POMODORO_TRACKING_STARTED", {
          sessionId: request.sessionId,
        });

        return {
          success: true,
          sessionId: request.sessionId,
        };
      } else {
        throw new Error("Failed to update session status");
      }
    } catch (error) {
      console.error("[Main] Failed to start tracking:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Pause tracking for session
ipcMain.handle(
  POMODORO_PAUSE_TRACKING,
  async (
    event,
    request: TrackingRequest
  ): Promise<TrackingResponse> => {
    try {
      console.log(
        "[Main] Pausing tracking for session:",
        request.sessionId
      );

      // Load session
      const session = await storageManager.loadPomodoro(
        request.sessionId
      );
      if (!session) {
        throw new Error(`Session ${request.sessionId} not found`);
      }

      // Update session status
      session.status = "paused";
      session.updatedAt = new Date().toISOString();

      const success = await storageManager.savePomodoro(session);

      if (success) {
        // Pause activity tracker
        await activityTracker.pauseTracking();

        // Notify renderer
        win?.webContents.send("POMODORO_TRACKING_PAUSED", {
          sessionId: request.sessionId,
        });

        return {
          success: true,
          sessionId: request.sessionId,
        };
      } else {
        throw new Error("Failed to update session status");
      }
    } catch (error) {
      console.error("[Main] Failed to pause tracking:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Stop tracking and complete session
ipcMain.handle(
  POMODORO_STOP_TRACKING,
  async (
    event,
    request: TrackingRequest
  ): Promise<TrackingResponse> => {
    try {
      console.log(
        "[Main] Stopping tracking for session:",
        request.sessionId
      );

      // Load session
      const session = await storageManager.loadPomodoro(
        request.sessionId
      );
      if (!session) {
        throw new Error(`Session ${request.sessionId} not found`);
      }

      // Update session status
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();

      const success = await storageManager.savePomodoro(session);

      if (success) {
        // Stop activity tracker
        await activityTracker.stopTracking();

        // Notify renderer
        win?.webContents.send("POMODORO_TRACKING_STOPPED", {
          sessionId: request.sessionId,
        });
        win?.webContents.send("POMODORO_SESSION_COMPLETED", {
          session,
        });

        return {
          success: true,
          sessionId: request.sessionId,
        };
      } else {
        throw new Error("Failed to update session status");
      }
    } catch (error) {
      console.error("[Main] Failed to stop tracking:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.setAppUserModelId("com.roldanjr.pomatez");

// Get session by ID
ipcMain.handle(
  POMODORO_GET_SESSION,
  async (
    event,
    request: GetSessionRequest
  ): Promise<GetSessionResponse> => {
    try {
      console.log("[Main] Getting session:", request.sessionId);

      const session = await storageManager.loadPomodoro(
        request.sessionId
      );

      if (session) {
        return {
          success: true,
          session,
        };
      } else {
        return {
          success: false,
          error: `Session ${request.sessionId} not found`,
        };
      }
    } catch (error) {
      console.error("[Main] Failed to get session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// List sessions with filters
ipcMain.handle(
  POMODORO_LIST_SESSIONS,
  async (
    event,
    request: ListSessionsRequest
  ): Promise<ListSessionsResponse> => {
    try {
      console.log("[Main] Listing sessions with filters:", request);

      const sessions = await storageManager.listPomodoros(request);

      return {
        success: true,
        sessions,
      };
    } catch (error) {
      console.error("[Main] Failed to list sessions:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Get session statistics
ipcMain.handle(
  POMODORO_GET_STATS,
  async (
    event,
    request: GetStatsRequest
  ): Promise<GetStatsResponse> => {
    try {
      console.log("[Main] Getting stats:", request);

      if (request.sessionId) {
        // Get stats for specific session
        const stats = await storageManager.getSessionStats(
          request.sessionId
        );
        return {
          success: true,
          stats,
        };
      } else if (request.dateRange) {
        // Get daily stats for date range
        const dailyStats: Record<string, any> = {};

        const startDate = new Date(request.dateRange.start);
        const endDate = new Date(request.dateRange.end);

        for (
          let date = new Date(startDate);
          date <= endDate;
          date.setDate(date.getDate() + 1)
        ) {
          const dateStr = date.toISOString().split("T")[0];
          dailyStats[dateStr] = await storageManager.getDayStats(
            dateStr
          );
        }

        return {
          success: true,
          dailyStats,
        };
      } else {
        // Get today's stats
        const today = new Date().toISOString().split("T")[0];
        const dailyStats = {
          [today]: await storageManager.getDayStats(today),
        };

        return {
          success: true,
          dailyStats,
        };
      }
    } catch (error) {
      console.error("[Main] Failed to get stats:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Get Pomodoro settings
ipcMain.handle(
  POMODORO_GET_SETTINGS,
  async (event): Promise<GetSettingsResponse> => {
    try {
      console.log("[Main] Getting Pomodoro settings");

      const settings = storageManager.getPomodoroSettings();

      return {
        success: true,
        settings,
      };
    } catch (error) {
      console.error("[Main] Failed to get settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Update Pomodoro settings
ipcMain.handle(
  POMODORO_UPDATE_SETTINGS,
  async (
    event,
    request: UpdateSettingsRequest
  ): Promise<UpdateSettingsResponse> => {
    try {
      console.log(
        "[Main] Updating Pomodoro settings:",
        request.settings
      );

      storageManager.savePomodoroSettings(request.settings);
      const updatedSettings = storageManager.getPomodoroSettings();

      return {
        success: true,
        settings: updatedSettings,
      };
    } catch (error) {
      console.error("[Main] Failed to update settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

// Get current activity status (placeholder for now)
ipcMain.handle(
  ACTIVITY_GET_CURRENT,
  async (event): Promise<GetCurrentActivityResponse> => {
    try {
      console.log("[Main] Getting current activity status");

      // TODO: Implement actual activity monitoring
      // For now, return mock data
      const activity = {
        isActive: true,
        lastInputTime: Date.now(),
        idleTimeSeconds: 0,
        mouseActivity: true,
        keyboardActivity: false,
      };

      return {
        success: true,
        activity,
      };
    } catch (error) {
      console.error("[Main] Failed to get current activity:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

console.log("[Main] Pomodoro IPC handlers registered");

// Setup activity tracker event listeners
activityTracker.on("interval_recorded", (data) => {
  // Send activity stats update to renderer
  win?.webContents.send("ACTIVITY_STATS_UPDATED", {
    stats: data.stats,
    sessionId: data.sessionId,
  });
});

activityTracker.on("tracking_started", (session) => {
  console.log(
    `[Main] Activity tracking started for session: ${session.id}`
  );
});

activityTracker.on("tracking_stopped", (session) => {
  console.log(
    `[Main] Activity tracking stopped for session: ${session.id}`
  );
});

activityTracker.on("tracking_paused", (session) => {
  console.log(
    `[Main] Activity tracking paused for session: ${session.id}`
  );
});
