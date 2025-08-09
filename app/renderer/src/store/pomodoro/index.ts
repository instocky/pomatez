/**
 * Pomodoro Redux Slice - Управление состоянием трекинга активности
 * Интеграция с существующим Timer slice через middleware
 */

import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from "@reduxjs/toolkit";
import {
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
  ActivityStatus,
  ActivityStats,
  PomodoroSettings,
} from "@pomatez/shareables";

// Типы состояния
interface PomodoroSession {
  id: string;
  path: string;
  title: string;
  status: "created" | "running" | "paused" | "completed";
  sessionType: "work" | "short_break" | "long_break";
  targetMinutes: number;
  totalMinutes: number;
  activeMinutes: number;
  description?: string;
  fillColor: string;
  dailyMasks: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface PomodoroState {
  // Текущая сессия
  currentSession: PomodoroSession | null;
  isTracking: boolean;

  // Активность в реальном времени
  currentActivity: ActivityStatus | null;
  activityStats: ActivityStats | null;
  bitMaskToday: string;

  // История и кэш
  recentSessions: PomodoroSession[];
  sessionHistory: PomodoroSession[];

  // Настройки
  settings: PomodoroSettings;

  // UI состояние
  showActivityIndicator: boolean;

  // Загрузка и ошибки
  loading: {
    createSession: boolean;
    startTracking: boolean;
    loadStats: boolean;
    loadSettings: boolean;
  };
  error: string | null;
}

// Начальное состояние
const initialState: PomodoroState = {
  currentSession: null,
  isTracking: false,

  currentActivity: null,
  activityStats: null,
  bitMaskToday: "",

  recentSessions: [],
  sessionHistory: [],

  settings: {
    trackingEnabled: true,
    activityThresholdSeconds: 180,
    intervalDurationMinutes: 5,
    showActivityIndicator: true,
    autoCreateSessions: true,
    saveDetailedLogs: false,
  },

  showActivityIndicator: true,

  loading: {
    createSession: false,
    startTracking: false,
    loadStats: false,
    loadSettings: false,
  },
  error: null,
};

// Async Thunks для IPC коммуникации
export const createPomodoroSession = createAsyncThunk(
  "pomodoro/createSession",
  async (request: CreateSessionRequest): Promise<PomodoroSession> => {
    // Проверка что мы в Electron окружении
    if (!window.electron?.ipcRenderer) {
      throw new Error(
        "Pomodoro API only available in Electron environment"
      );
    }

    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_CREATE_SESSION,
      request
    )) as CreateSessionResponse;

    if (response.success && response.session) {
      return response.session;
    } else {
      throw new Error(response.error || "Failed to create session");
    }
  }
);

export const startSessionTracking = createAsyncThunk(
  "pomodoro/startTracking",
  async (sessionId: string): Promise<string> => {
    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_START_TRACKING,
      { sessionId } as TrackingRequest
    )) as TrackingResponse;

    if (response.success) {
      return sessionId;
    } else {
      throw new Error(response.error || "Failed to start tracking");
    }
  }
);

export const pauseSessionTracking = createAsyncThunk(
  "pomodoro/pauseTracking",
  async (sessionId: string): Promise<string> => {
    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_PAUSE_TRACKING,
      { sessionId } as TrackingRequest
    )) as TrackingResponse;

    if (response.success) {
      return sessionId;
    } else {
      throw new Error(response.error || "Failed to pause tracking");
    }
  }
);

export const stopSessionTracking = createAsyncThunk(
  "pomodoro/stopTracking",
  async (sessionId: string): Promise<PomodoroSession> => {
    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_STOP_TRACKING,
      { sessionId } as TrackingRequest
    )) as TrackingResponse;

    if (response.success) {
      // После остановки получаем обновленную сессию
      const sessionResponse = (await window.electron.ipcRenderer.invoke(
        POMODORO_GET_SESSION,
        { sessionId } as GetSessionRequest
      )) as GetSessionResponse;

      if (sessionResponse.success && sessionResponse.session) {
        return sessionResponse.session;
      }
    }

    throw new Error(response.error || "Failed to stop tracking");
  }
);

export const fetchSessionStats = createAsyncThunk(
  "pomodoro/fetchStats",
  async (request: GetStatsRequest): Promise<ActivityStats> => {
    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_GET_STATS,
      request
    )) as GetStatsResponse;

    if (response.success && response.stats) {
      return response.stats;
    } else {
      throw new Error(response.error || "Failed to fetch stats");
    }
  }
);

export const loadPomodoroSettings = createAsyncThunk(
  "pomodoro/loadSettings",
  async (): Promise<PomodoroSettings> => {
    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_GET_SETTINGS
    )) as GetSettingsResponse;

    if (response.success && response.settings) {
      return response.settings;
    } else {
      throw new Error(response.error || "Failed to load settings");
    }
  }
);

export const updatePomodoroSettings = createAsyncThunk(
  "pomodoro/updateSettings",
  async (
    settings: Partial<PomodoroSettings>
  ): Promise<PomodoroSettings> => {
    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_UPDATE_SETTINGS,
      { settings } as UpdateSettingsRequest
    )) as UpdateSettingsResponse;

    if (response.success && response.settings) {
      return response.settings;
    } else {
      throw new Error(response.error || "Failed to update settings");
    }
  }
);

export const getCurrentActivity = createAsyncThunk(
  "pomodoro/getCurrentActivity",
  async (): Promise<ActivityStatus> => {
    const response = (await window.electron.ipcRenderer.invoke(
      ACTIVITY_GET_CURRENT
    )) as GetCurrentActivityResponse;

    if (response.success && response.activity) {
      return response.activity;
    } else {
      throw new Error(
        response.error || "Failed to get current activity"
      );
    }
  }
);

export const fetchRecentSessions = createAsyncThunk(
  "pomodoro/fetchRecentSessions",
  async (): Promise<PomodoroSession[]> => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const response = (await window.electron.ipcRenderer.invoke(
      POMODORO_LIST_SESSIONS,
      {
        dateFrom: weekAgo.toISOString().split("T")[0],
        dateTo: today.toISOString().split("T")[0],
        limit: 20,
      } as ListSessionsRequest
    )) as ListSessionsResponse;

    if (response.success && response.sessions) {
      return response.sessions.filter(
        (session): session is PomodoroSession => session !== undefined
      );
    } else {
      throw new Error(
        response.error || "Failed to fetch recent sessions"
      );
    }
  }
);

// Redux Slice
const pomodoroSlice = createSlice({
  name: "pomodoro",
  initialState,
  reducers: {
    // Управление сессиями
    setCurrentSession: (
      state,
      action: PayloadAction<PomodoroSession>
    ) => {
      state.currentSession = action.payload;
    },

    updateCurrentSession: (
      state,
      action: PayloadAction<Partial<PomodoroSession>>
    ) => {
      if (state.currentSession) {
        state.currentSession = {
          ...state.currentSession,
          ...action.payload,
        };
      }
    },

    clearCurrentSession: (state) => {
      state.currentSession = null;
      state.isTracking = false;
    },

    // Управление трекингом
    setTrackingStatus: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },

    // Активность в реальном времени
    updateCurrentActivity: (
      state,
      action: PayloadAction<ActivityStatus>
    ) => {
      state.currentActivity = action.payload;
    },

    updateActivityStats: (
      state,
      action: PayloadAction<ActivityStats>
    ) => {
      state.activityStats = action.payload;
    },

    updateBitMask: (state, action: PayloadAction<string>) => {
      state.bitMaskToday = action.payload;
    },

    // История сессий
    addToHistory: (state, action: PayloadAction<PomodoroSession>) => {
      state.sessionHistory.unshift(action.payload);
      // Ограничиваем историю 50 сессиями
      if (state.sessionHistory.length > 50) {
        state.sessionHistory = state.sessionHistory.slice(0, 50);
      }
    },

    setRecentSessions: (
      state,
      action: PayloadAction<PomodoroSession[]>
    ) => {
      state.recentSessions = action.payload;
    },

    // Настройки
    updateSettings: (
      state,
      action: PayloadAction<Partial<PomodoroSettings>>
    ) => {
      state.settings = { ...state.settings, ...action.payload };
    },

    // UI состояние
    setActivityIndicatorVisible: (
      state,
      action: PayloadAction<boolean>
    ) => {
      state.showActivityIndicator = action.payload;
    },

    // Ошибки
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // createPomodoroSession
    builder
      .addCase(createPomodoroSession.pending, (state) => {
        state.loading.createSession = true;
        state.error = null;
      })
      .addCase(createPomodoroSession.fulfilled, (state, action) => {
        state.loading.createSession = false;
        state.currentSession = action.payload;
      })
      .addCase(createPomodoroSession.rejected, (state, action) => {
        state.loading.createSession = false;
        state.error =
          action.error.message || "Failed to create session";
      });

    // startSessionTracking
    builder
      .addCase(startSessionTracking.pending, (state) => {
        state.loading.startTracking = true;
        state.error = null;
      })
      .addCase(startSessionTracking.fulfilled, (state) => {
        state.loading.startTracking = false;
        state.isTracking = true;
      })
      .addCase(startSessionTracking.rejected, (state, action) => {
        state.loading.startTracking = false;
        state.error =
          action.error.message || "Failed to start tracking";
      });

    // pauseSessionTracking
    builder.addCase(pauseSessionTracking.fulfilled, (state) => {
      state.isTracking = false;
    });

    // stopSessionTracking
    builder.addCase(stopSessionTracking.fulfilled, (state, action) => {
      state.isTracking = false;
      if (action.payload) {
        // Добавить завершенную сессию в историю
        state.sessionHistory.unshift(action.payload);
      }
      state.currentSession = null;
    });

    // fetchSessionStats
    builder
      .addCase(fetchSessionStats.pending, (state) => {
        state.loading.loadStats = true;
      })
      .addCase(fetchSessionStats.fulfilled, (state, action) => {
        state.loading.loadStats = false;
        state.activityStats = action.payload;
      })
      .addCase(fetchSessionStats.rejected, (state, action) => {
        state.loading.loadStats = false;
        state.error = action.error.message || "Failed to load stats";
      });

    // loadPomodoroSettings
    builder
      .addCase(loadPomodoroSettings.pending, (state) => {
        state.loading.loadSettings = true;
      })
      .addCase(loadPomodoroSettings.fulfilled, (state, action) => {
        state.loading.loadSettings = false;
        state.settings = action.payload;
      })
      .addCase(loadPomodoroSettings.rejected, (state, action) => {
        state.loading.loadSettings = false;
        state.error = action.error.message || "Failed to load settings";
      });

    // updatePomodoroSettings
    builder.addCase(
      updatePomodoroSettings.fulfilled,
      (state, action) => {
        state.settings = action.payload;
      }
    );

    // fetchRecentSessions
    builder.addCase(fetchRecentSessions.fulfilled, (state, action) => {
      state.recentSessions = action.payload;
    });
  },
});

// Экспорт actions
export const {
  setCurrentSession,
  updateCurrentSession,
  clearCurrentSession,
  setTrackingStatus,
  updateCurrentActivity,
  updateActivityStats,
  updateBitMask,
  addToHistory,
  setRecentSessions,
  updateSettings,
  setActivityIndicatorVisible,
  setError,
  clearError,
} = pomodoroSlice.actions;

// Экспорт типов
export type { PomodoroState, PomodoroSession };

// Экспорт reducer
export default pomodoroSlice.reducer;
