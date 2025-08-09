export const CHECK_FOR_UPDATES = "CHECK_FOR_UPDATES";
export const SET_ALWAYS_ON_TOP = "SET_ALWAYS_ON_TOP";
export const SET_FULLSCREEN_BREAK = "SET_FULLSCREEN_BREAK";
export const SET_COMPACT_MODE = "SET_COMPACT_MODE";
export const SET_NATIVE_TITLEBAR = "SET_NATIVE_TITLEBAR";
export const SET_OPEN_AT_LOGIN = "SET_OPEN_AT_LOGIN";
export const TRAY_ICON_UPDATE = "TRAY_ICON_UPDATE";
export const SET_UI_THEME = "SET_UI_THEME";
export const MINIMIZE_WINDOW = "MINIMIZE_WINDOW";
export const CLOSE_WINDOW = "CLOSE_WINDOW";
export const SHOW_WINDOW = "SHOW_WINDOW";
export const UPDATE_AVAILABLE = "UPDATE_AVAILABLE";
export const INSTALL_UPDATE = "INSTALL_UPDATE";

// === POMODORO API CHANNELS ===
// Renderer → Main (commands)
export const POMODORO_CREATE_SESSION = "POMODORO_CREATE_SESSION";
export const POMODORO_START_TRACKING = "POMODORO_START_TRACKING";
export const POMODORO_PAUSE_TRACKING = "POMODORO_PAUSE_TRACKING";
export const POMODORO_STOP_TRACKING = "POMODORO_STOP_TRACKING";
export const POMODORO_GET_SESSION = "POMODORO_GET_SESSION";
export const POMODORO_LIST_SESSIONS = "POMODORO_LIST_SESSIONS";
export const POMODORO_GET_STATS = "POMODORO_GET_STATS";
export const POMODORO_GET_SETTINGS = "POMODORO_GET_SETTINGS";
export const POMODORO_UPDATE_SETTINGS = "POMODORO_UPDATE_SETTINGS";

// Main → Renderer (events)
export const POMODORO_SESSION_CREATED = "POMODORO_SESSION_CREATED";
export const POMODORO_SESSION_UPDATED = "POMODORO_SESSION_UPDATED";
export const POMODORO_SESSION_COMPLETED = "POMODORO_SESSION_COMPLETED";
export const POMODORO_TRACKING_STARTED = "POMODORO_TRACKING_STARTED";
export const POMODORO_TRACKING_PAUSED = "POMODORO_TRACKING_PAUSED";
export const POMODORO_TRACKING_STOPPED = "POMODORO_TRACKING_STOPPED";

// Activity tracking events
export const ACTIVITY_STATUS_CHANGED = "ACTIVITY_STATUS_CHANGED";
export const ACTIVITY_STATS_UPDATED = "ACTIVITY_STATS_UPDATED";
export const ACTIVITY_BITMASK_UPDATED = "ACTIVITY_BITMASK_UPDATED";
export const ACTIVITY_GET_CURRENT = "ACTIVITY_GET_CURRENT";

export const TO_MAIN: string[] = [
  SET_ALWAYS_ON_TOP,
  SET_FULLSCREEN_BREAK,
  SET_COMPACT_MODE,
  SET_NATIVE_TITLEBAR,
  SET_OPEN_AT_LOGIN,
  TRAY_ICON_UPDATE,
  SET_UI_THEME,
  MINIMIZE_WINDOW,
  CLOSE_WINDOW,
  SHOW_WINDOW,
  INSTALL_UPDATE,
  // Pomodoro commands
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
];

export const FROM_MAIN: string[] = [
  UPDATE_AVAILABLE,
  // Pomodoro events
  POMODORO_SESSION_CREATED,
  POMODORO_SESSION_UPDATED,
  POMODORO_SESSION_COMPLETED,
  POMODORO_TRACKING_STARTED,
  POMODORO_TRACKING_PAUSED,
  POMODORO_TRACKING_STOPPED,
  ACTIVITY_STATUS_CHANGED,
  ACTIVITY_STATS_UPDATED,
  ACTIVITY_BITMASK_UPDATED,
];

export const RELEASE_NOTES_LINK =
  "https://github.com/zidoro/pomatez/releases/latest";

// === POMODORO API TYPES ===
export interface CreateSessionRequest {
  path: string;
  title: string;
  sessionType: "work" | "short_break" | "long_break";
  targetMinutes: number;
  description?: string;
}

export interface CreateSessionResponse {
  success: boolean;
  session?: {
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
  };
  error?: string;
}

export interface TrackingRequest {
  sessionId: string;
}

export interface TrackingResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface GetSessionRequest {
  sessionId: string;
}

export interface GetSessionResponse {
  success: boolean;
  session?: CreateSessionResponse["session"];
  error?: string;
}

export interface ListSessionsRequest {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sessionType?: string;
  limit?: number;
}

export interface ListSessionsResponse {
  success: boolean;
  sessions?: CreateSessionResponse["session"][];
  error?: string;
}

export interface GetStatsRequest {
  sessionId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ActivityStats {
  totalIntervals: number;
  activeIntervals: number;
  inactiveIntervals: number;
  activityPercentage: number;
  sessionDuration?: number;
  realWorkTime?: number;
}

export interface GetStatsResponse {
  success: boolean;
  stats?: ActivityStats;
  dailyStats?: Record<
    string,
    {
      sessionsCount: number;
      totalActiveMinutes: number;
      averageActivity: number;
    }
  >;
  error?: string;
}

export interface PomodoroSettings {
  trackingEnabled: boolean;
  activityThresholdSeconds: number;
  intervalDurationMinutes: number;
  showActivityIndicator: boolean;
  autoCreateSessions: boolean;
  saveDetailedLogs: boolean;
}

export interface GetSettingsResponse {
  success: boolean;
  settings?: PomodoroSettings;
  error?: string;
}

export interface UpdateSettingsRequest {
  settings: Partial<PomodoroSettings>;
}

export interface UpdateSettingsResponse {
  success: boolean;
  settings?: PomodoroSettings;
  error?: string;
}

export interface ActivityStatus {
  isActive: boolean;
  lastInputTime: number;
  idleTimeSeconds: number;
  mouseActivity: boolean;
  keyboardActivity: boolean;
}

export interface GetCurrentActivityResponse {
  success: boolean;
  activity?: ActivityStatus;
  error?: string;
}

// Event payload types
export interface SessionEventPayload {
  session: CreateSessionResponse["session"];
}

export interface ActivityStatusEventPayload {
  activity: ActivityStatus;
}

export interface ActivityStatsEventPayload {
  stats: ActivityStats;
  sessionId: string;
}

export interface BitMaskEventPayload {
  sessionId: string;
  date: string;
  mask: string;
  intervalIndex: number;
}
