# API Specification - Pomodoro Timer

## Общие принципы

- Все операции асинхронные (Promise-based)
- Данные хранятся в JSON файлах
- Битовые маски для активности (1 символ = 5 минут)
- Автоматическое создание бэкапов

## 1. Pomodoro API

### 1.1 createPomodoro(options)

Создает новую сессию помидорки

**Параметры:**

```javascript
{
  path: string,        // путь проекта
  title: string,       // название задачи
  description?: string // описание (опционально)
}
```

**Возвращает:**

```javascript
{
  id: string,          // уникальный ID
  path: string,
  title: string,
  status: "created",
  fill_color: "#4CAF50",
  total_minutes: 0,
  aggregated_minutes: 0,
  description: string,
  daily_masks: {},
  created_at: ISO_string,
  updated_at: ISO_string
}
```

### 1.2 startPomodoro(id)

Запускает помидорку

**Параметры:** `id: string`

**Возвращает:** `Promise<{ success: boolean, session: object }>`

**Действия:**

- Меняет статус на "running"
- Запускает таймер
- Начинает мониторинг активности
- Обновляет `updated_at`

### 1.3 pausePomodoro(id)

Ставит помидорку на паузу

**Параметры:** `id: string`

**Возвращает:** `Promise<{ success: boolean, session: object }>`

**Действия:**

- Меняет статус на "paused"
- Останавливает таймер
- Приостанавливает мониторинг
- Сохраняет текущий прогресс

### 1.4 stopPomodoro(id)

Завершает помидорку

**Параметры:** `id: string`

**Возвращает:** `Promise<{ success: boolean, session: object }>`

**Действия:**

- Меняет статус на "completed"
- Останавливает все процессы
- Финализирует битовую маску
- Подсчитывает итоговое время

### 1.5 getPomodoro(id)

Получает данные помидорки

**Параметры:** `id: string`

**Возвращает:** `Promise<object | null>`

### 1.6 listPomodoros(filters?)

Получает список помидорок

**Параметры:**

```javascript
{
  path?: string,       // фильтр по пути
  status?: string,     // фильтр по статусу
  date?: string,       // фильтр по дате (YYYY-MM-DD)
  limit?: number       // лимит результатов
}
```

**Возвращает:** `Promise<array>`

## 2. Activity Tracker API

### 2.1 startActivityTracking(pomodoroId)

Начинает трекинг активности

**Параметры:** `pomodoroId: string`

**Возвращает:** `Promise<{ success: boolean }>`

**Логика:**

- Запускает мониторинг каждые 5 секунд
- Сохраняет состояние каждые 5 минут
- Обновляет битовую маску в реальном времени

### 2.2 stopActivityTracking()

Останавливает трекинг

**Возвращает:** `Promise<{ success: boolean }>`

### 2.3 recordActivityInterval(pomodoroId, isActive)

Записывает интервал активности

**Параметры:**

- `pomodoroId: string`
- `isActive: boolean`

**Возвращает:** `Promise<{ success: boolean }>`

**Логика:**

- Обновляет битовую маску текущего дня
- Пересчитывает `aggregated_minutes`
- Сохраняет изменения в JSON

### 2.4 getActivityStats(pomodoroId)

Получает статистику активности

**Параметры:** `pomodoroId: string`

**Возвращает:**

```javascript
{
  total_intervals: number,     // всего интервалов
  active_intervals: number,    // активных интервалов
  inactive_intervals: number,  // неактивных интервалов
  activity_percentage: number, // процент активности
  daily_breakdown: {           // разбивка по дням
    "2025-08-08": {
      total: number,
      active: number,
      percentage: number
    }
  }
}
```

## 3. Data Manager API

### 3.1 savePomodoro(pomodoroData)

Сохраняет данные помидорки

**Параметры:** `pomodoroData: object`

**Возвращает:** `Promise<{ success: boolean, filePath: string }>`

**Логика:**

- Валидирует структуру данных
- Создает бэкап если файл существует
- Сохраняет в JSON формате
- Обновляет индексный файл

### 3.2 loadPomodoro(id)

Загружает данные помидорки

**Параметры:** `id: string`

**Возвращает:** `Promise<object | null>`

### 3.3 deletePomodoro(id)

Удаляет помидорку

**Параметры:** `id: string`

**Возвращает:** `Promise<{ success: boolean }>`

**Логика:**

- Создает бэкап перед удалением
- Удаляет JSON файл
- Обновляет индексный файл

### 3.4 createBackup(pomodoroId)

Создает бэкап помидорки

**Параметры:** `pomodoroId: string`

**Возвращает:** `Promise<{ success: boolean, backupPath: string }>`

## 4. Windows API Integration

### 4.1 getSystemActivity()

Получает текущую активность системы

**Возвращает:**

```javascript
{
  mouse_activity: boolean,    // активность мыши
  keyboard_activity: boolean, // активность клавиатуры
  last_input_time: number,   // время последнего ввода (timestamp)
  idle_time: number          // время простоя (секунды)
}
```

### 4.2 isUserActive(thresholdSeconds = 180)

Проверяет активность пользователя

**Параметры:** `thresholdSeconds: number` (по умолчанию 3 минуты)

**Возвращает:** `boolean`

### 4.3 startSystemMonitoring(callback)

Запускает мониторинг системы

**Параметры:** `callback: function` - вызывается при изменении активности

**Возвращает:** `Promise<{ success: boolean, monitorId: string }>`

### 4.4 stopSystemMonitoring(monitorId)

Останавливает мониторинг

**Параметры:** `monitorId: string`

**Возвращает:** `Promise<{ success: boolean }>`

## 5. Utility Functions

### 5.1 generatePomodoroId()

Генерирует уникальный ID

**Возвращает:** `string`

### 5.2 formatBitMask(mask)

Форматирует битовую маску для отображения

**Параметры:** `mask: string`

**Возвращает:**

```javascript
{
  raw: string,              // исходная маска
  formatted: string,        // форматированная (с разделителями)
  active_count: number,     // количество активных интервалов
  total_count: number,      // общее количество интервалов
  percentage: number        // процент активности
}
```

### 5.3 validatePomodoroData(data)

Валидирует структуру данных помидорки

**Параметры:** `data: object`

**Возвращает:**

```javascript
{
  valid: boolean,
  errors: array,     // список ошибок валидации
  warnings: array    // список предупреждений
}
```

## Структура ошибок

Все API методы используют стандартную структуру ошибок:

```javascript
{
  success: false,
  error: {
    code: string,        // код ошибки (e.g., "POMODORO_NOT_FOUND")
    message: string,     // человеко-читаемое сообщение
    details?: object     // дополнительные детали
  }
}
```

## События (Event System)

API поддерживает события для реактивного интерфейса:

- `pomodoro.created` - создана новая помидорка
- `pomodoro.started` - помидорка запущена
- `pomodoro.paused` - помидорка приостановлена
- `pomodoro.stopped` - помидорка завершена
- `activity.interval` - записан новый интервал активности
- `activity.status_changed` - изменился статус активности
  : ActivityStatus | null;
  activityStats: ActivityStats | null;
  bitMaskToday: string;
  // История и кэш
  recentSessions: PomodoroSession[];
  sessionHistory: PomodoroSession[];
  // UI состояние
  showActivityIndicator: boolean;
  trackingEnabled: boolean;
  // Загрузка и ошибки
  loading: boolean;
  error: string | null;
  }

````

### 4.2 Redux Actions (createSlice)
```typescript
const pomodoroSlice = createSlice({
  name: 'pomodoro',
  initialState,
  reducers: {
    // Управление сессией
    setCurrentSession: (state, action: PayloadAction<PomodoroSession | null>) => {
      state.currentSession = action.payload;
    },

    setTrackingStatus: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },

    // Активность в реальном времени
    updateCurrentActivity: (state, action: PayloadAction<ActivityStatus>) => {
      state.currentActivity = action.payload;
    },

    updateActivityStats: (state, action: PayloadAction<ActivityStats>) => {
      state.activityStats = action.payload;
    },

    updateBitMask: (state, action: PayloadAction<string>) => {
      state.bitMaskToday = action.payload;
    },

    // История сессий
    addToHistory: (state, action: PayloadAction<PomodoroSession>) => {
      state.sessionHistory.unshift(action.payload);
      // Ограничить историю последними 100 сессиями
      if (state.sessionHistory.length > 100) {
        state.sessionHistory = state.sessionHistory.slice(0, 100);
      }
    },

    // UI состояние
    toggleActivityIndicator: (state) => {
      state.showActivityIndicator = !state.showActivityIndicator;
    },

    setTrackingEnabled: (state, action: PayloadAction<boolean>) => {
      state.trackingEnabled = action.payload;
    },

    // Состояния загрузки
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});
````

### 4.3 Async Thunks (IPC коммуникация)

```typescript
// Создание новой сессии
export const createPomodoroSession = createAsyncThunk(
  "pomodoro/createSession",
  async (request: CreateSessionRequest, { dispatch }) => {
    const response = (await window.electron.ipcRenderer.invoke(
      CREATE_POMODORO_SESSION,
      request
    )) as CreateSessionResponse;

    if (response.success && response.session) {
      dispatch(setCurrentSession(response.session));
      return response.session;
    } else {
      throw new Error(response.error || "Failed to create session");
    }
  }
);

// Запуск трекинга
export const startSessionTracking = createAsyncThunk(
  "pomodoro/startTracking",
  async (sessionId: string, { dispatch }) => {
    const response = await window.electron.ipcRenderer.invoke(
      START_POMODORO_TRACKING,
      { sessionId }
    );

    if (response.success) {
      dispatch(setTrackingStatus(true));
      return true;
    } else {
      throw new Error(response.error || "Failed to start tracking");
    }
  }
);

// Пауза трекинга
export const pauseSessionTracking = createAsyncThunk(
  "pomodoro/pauseTracking",
  async (_, { dispatch }) => {
    const response = await window.electron.ipcRenderer.invoke(
      PAUSE_POMODORO_TRACKING
    );

    if (response.success) {
      dispatch(setTrackingStatus(false));
      return true;
    } else {
      throw new Error(response.error || "Failed to pause tracking");
    }
  }
);

// Завершение сессии
export const completeSession = createAsyncThunk(
  "pomodoro/completeSession",
  async (_, { getState, dispatch }) => {
    const state = getState() as { pomodoro: PomodoroState };
    const currentSession = state.pomodoro.currentSession;

    if (!currentSession) {
      throw new Error("No active session to complete");
    }

    const response = await window.electron.ipcRenderer.invoke(
      STOP_POMODORO_TRACKING,
      { sessionId: currentSession.id }
    );

    if (response.success && response.session) {
      dispatch(addToHistory(response.session));
      dispatch(setCurrentSession(null));
      dispatch(setTrackingStatus(false));
      return response.session;
    } else {
      throw new Error(response.error || "Failed to complete session");
    }
  }
);

// Получение статистики
export const fetchSessionStats = createAsyncThunk(
  "pomodoro/fetchStats",
  async (request: GetStatsRequest, { dispatch }) => {
    const response = (await window.electron.ipcRenderer.invoke(
      GET_POMODORO_STATS,
      request
    )) as GetStatsResponse;

    if (response.success && response.stats) {
      dispatch(updateActivityStats(response.stats));
      return response.stats;
    } else {
      throw new Error(response.error || "Failed to fetch stats");
    }
  }
);
```

### 4.4 Selectors

```typescript
// Селекторы для доступа к состоянию
export const selectCurrentSession = (state: RootState) =>
  state.pomodoro.currentSession;

export const selectIsTracking = (state: RootState) =>
  state.pomodoro.isTracking;

export const selectCurrentActivity = (state: RootState) =>
  state.pomodoro.currentActivity;

export const selectActivityStats = (state: RootState) =>
  state.pomodoro.activityStats;

export const selectBitMaskToday = (state: RootState) =>
  state.pomodoro.bitMaskToday;

export const selectSessionHistory = (state: RootState) =>
  state.pomodoro.sessionHistory;

export const selectRecentSessions = (state: RootState) =>
  state.pomodoro.recentSessions;

export const selectTrackingEnabled = (state: RootState) =>
  state.pomodoro.trackingEnabled;

export const selectShowActivityIndicator = (state: RootState) =>
  state.pomodoro.showActivityIndicator;

// Вычисляемые селекторы
export const selectCurrentSessionProgress = createSelector(
  [selectCurrentSession, selectActivityStats],
  (session, stats) => {
    if (!session || !stats) return 0;
    return (stats.sessionDuration / session.targetMinutes) * 100;
  }
);

export const selectActivityPercentage = createSelector(
  [selectActivityStats],
  (stats) => stats?.activityPercentage || 0
);

export const selectIsSessionActive = createSelector(
  [selectCurrentSession, selectIsTracking],
  (session, isTracking) => Boolean(session && isTracking)
);
```

## 5. Middleware для интеграции с Timer

### 5.1 Timer Integration Middleware

```typescript
// Middleware для автоматической синхронизации с Timer
export const pomodoroTimerMiddleware: Middleware =
  (store) => (next) => (action) => {
    const result = next(action);
    const state = store.getState() as RootState;

    // Интеграция с существующим Timer slice
    if (action.type === "timer/setPlay") {
      const isPlaying = action.payload;
      const timerType = state.timer.timerType;
      const pomodoroState = state.pomodoro;

      if (isPlaying && !pomodoroState.currentSession) {
        // Создать новую сессию при старте таймера
        store.dispatch(
          createPomodoroSession({
            path: getCurrentProjectPath(), // получить из контекста
            title: getCurrentTaskTitle(), // получить из Tasks
            sessionType: mapTimerTypeToSessionType(timerType),
            targetMinutes: getTargetMinutes(timerType),
            description: "",
          })
        );

        // Запустить трекинг
        setTimeout(() => {
          const newState = store.getState() as RootState;
          const currentSession = newState.pomodoro.currentSession;
          if (currentSession) {
            store.dispatch(startSessionTracking(currentSession.id));
          }
        }, 100);
      } else if (!isPlaying && pomodoroState.isTracking) {
        // Пауза трекинга при паузе таймера
        store.dispatch(pauseSessionTracking());
      } else if (
        isPlaying &&
        pomodoroState.currentSession &&
        !pomodoroState.isTracking
      ) {
        // Возобновить трекинг при возобновлении таймера
        store.dispatch(
          startSessionTracking(pomodoroState.currentSession.id)
        );
      }
    }

    // Завершение сессии при сбросе или пропуске таймера
    if (
      (action.type === "timer/restartTimer" ||
        action.type === "timer/skipTimer") &&
      state.pomodoro.currentSession
    ) {
      store.dispatch(completeSession());
    }

    return result;
  };

// Вспомогательные функции
function mapTimerTypeToSessionType(
  timerType: string
): "work" | "short_break" | "long_break" {
  switch (timerType) {
    case "WORK":
      return "work";
    case "SHORT_BREAK":
      return "short_break";
    case "LONG_BREAK":
      return "long_break";
    default:
      return "work";
  }
}

function getTargetMinutes(timerType: string): number {
  switch (timerType) {
    case "WORK":
      return 25;
    case "SHORT_BREAK":
      return 5;
    case "LONG_BREAK":
      return 15;
    default:
      return 25;
  }
}
```

## 6. Структура ошибок и обработка

### 6.1 Error Types

```typescript
interface PomodoroError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Коды ошибок
export const ERROR_CODES = {
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  STORAGE_ERROR: "STORAGE_ERROR",
  WINDOWS_API_ERROR: "WINDOWS_API_ERROR",
  TRACKING_ERROR: "TRACKING_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
} as const;
```

### 6.2 Error Handling

```typescript
// Централизованная обработка ошибок
export function handlePomodoroError(error: unknown): PomodoroError {
  const timestamp = new Date().toISOString();

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      details: error.stack,
      timestamp,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred",
    timestamp,
  };
}
```

## 7. События и реактивность

### 7.1 IPC Event Listeners (в renderer)

```typescript
// Настройка listeners для IPC событий из main процесса
export function setupPomodoroEventListeners(dispatch: AppDispatch) {
  // Обновления активности в реальном времени
  window.electron.ipcRenderer.on(
    ACTIVITY_STATUS_CHANGED,
    (_, activity: ActivityStatus) => {
      dispatch(updateCurrentActivity(activity));
    }
  );

  // Обновления статистики каждые 5 минут
  window.electron.ipcRenderer.on(
    ACTIVITY_STATS_UPDATED,
    (_, stats: ActivityStats) => {
      dispatch(updateActivityStats(stats));
    }
  );

  // Обновления битовой маски
  window.electron.ipcRenderer.on(
    "activity:bitmask-updated",
    (_, bitMask: string) => {
      dispatch(updateBitMask(bitMask));
    }
  );

  // Завершение сессии
  window.electron.ipcRenderer.on(
    POMODORO_SESSION_COMPLETED,
    (_, session: PomodoroSession) => {
      dispatch(addToHistory(session));
      dispatch(setCurrentSession(null));
      dispatch(setTrackingStatus(false));
    }
  );
}
```

## 8. Утилиты и хелперы

### 8.1 Bit Mask Utils

```typescript
export class BitMaskUtils {
  // Создать пустую маску для дня
  static createEmptyMask(intervalCount: number): string {
    return "0".repeat(intervalCount);
  }

  // Обновить интервал в маске
  static updateInterval(
    mask: string,
    intervalIndex: number,
    isActive: boolean
  ): string {
    const chars = mask.split("");
    chars[intervalIndex] = isActive ? "1" : "0";
    return chars.join("");
  }

  // Подсчитать статистику из маски
  static calculateStats(mask: string): {
    active: number;
    total: number;
    percentage: number;
  } {
    const total = mask.length;
    const active = (mask.match(/1/g) || []).length;
    const percentage = total > 0 ? (active / total) * 100 : 0;

    return { active, total, percentage };
  }

  // Форматировать маску для отображения
  static formatMask(mask: string, chunkSize: number = 12): string {
    return (
      mask.match(new RegExp(`.{1,${chunkSize}}`, "g"))?.join(" ") ||
      mask
    );
  }
}
```

### 8.2 Time Utils

```typescript
export class TimeUtils {
  // Преобразовать минуты в интервалы (5 мин = 1 интервал)
  static minutesToIntervals(minutes: number): number {
    return Math.ceil(minutes / 5);
  }

  // Преобразовать интервалы в минуты
  static intervalsToMinutes(intervals: number): number {
    return intervals * 5;
  }

  // Получить индекс текущего интервала для времени
  static getCurrentIntervalIndex(startTime: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return Math.floor(diffMinutes / 5);
  }

  // Форматировать время для отображения
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}
```

## 9. Конфигурация и настройки

### 9.1 Default Settings

```typescript
export const DEFAULT_POMODORO_SETTINGS = {
  trackingEnabled: true,
  activityThresholdSeconds: 180, // 3 минуты бездействия = неактивный
  intervalDurationMinutes: 5, // интервал записи активности
  showActivityIndicator: true,
  saveDetailedLogs: false,
  autoCreateSessions: true, // создавать сессии автоматически
  autoStartTracking: true, // начинать трекинг автоматически
} as const;
```

### 9.2 Settings Integration

```typescript
// Интеграция с существующей Settings системой Pomatez
interface PomodoroSettings {
  trackingEnabled: boolean;
  activityThresholdSeconds: number;
  intervalDurationMinutes: number;
  showActivityIndicator: boolean;
  saveDetailedLogs: boolean;
  autoCreateSessions: boolean;
  autoStartTracking: boolean;
}

// Добавить в существующий Settings slice
export const updatePomodoroSettings = createAsyncThunk(
  "settings/updatePomodoroSettings",
  async (settings: Partial<PomodoroSettings>) => {
    // Сохранить в SafeStore через IPC
    await window.electron.ipcRenderer.invoke(
      "settings:update-pomodoro",
      settings
    );
    return settings;
  }
);
```

Эта спецификация API полностью интегрируется с архитектурой Pomatez, используя современные паттерны TypeScript, Redux Toolkit и Electron IPC. Готова для начала реализации! 🚀
