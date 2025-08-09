# Анализ архитектуры Pomatez и план интеграции API

## 📋 Анализ существующей архитектуры Pomatez

### Технологический стек

- **Фреймворк:** Electron 18.1.0 + React + TypeScript
- **State Management:** Redux Toolkit
- **Сборка:** Lerna (монорепо) + Create React App + electron-builder
- **Основные зависимости:**
  - `node-notifier` - системные уведомления
  - `electron-store` - хранение настроек
  - `lodash.debounce` - оптимизация производительности
  - `redux-undo` - отмена действий

### Структура проекта (Монорепо)

```txt
app/
├── electron/           # Main процесс Electron
│   ├── src/
│   │   ├── main.ts     # Главный файл Electron
│   │   ├── store.ts    # Electron Store (SafeStore)
│   │   ├── preload.ts  # Preload скрипт
│   │   └── helpers/    # Вспомогательные функции
├── renderer/           # React приложение
│   ├── src/
│   │   ├── store/      # Redux Store
│   │   │   ├── timer/  # Таймер состояние
│   │   │   ├── tasks/  # Задачи
│   │   │   ├── settings/ # Настройки
│   │   │   └── config/ # Конфигурация
│   │   ├── components/ # React компоненты
│   │   ├── hooks/      # Custom hooks
│   │   └── utils/      # Утилиты
└── shareables/         # Общие константы и типы
    └── src/
        └── constants/  # IPC каналы, типы
```

### Ключевые компоненты системы

#### 1. Electron Store (SafeStore)

- Обертка над `electron-store` с error handling
- Методы: `safeGet()`, `safeSet()`
- Хранит: `userId`, `isDarkMode`, `useNativeTitlebar`, `compactMode`, `openAtLogin`
- **ИДЕАЛЬНО для расширения под API данные!**

#### 2. Redux Store (State Management)

- **Timer Slice:** `playing`, `timerType`, `round`
- **Tasks Slice:** список задач с undo/redo
- **Settings Slice:** пользовательские настройки
- **Config Slice:** конфигурация приложения
- **Автосохранение** в localStorage через `saveToStorage()`

#### 3. IPC Communication

- Использует константы из `@pomatez/shareables`
- Каналы: `SET_ALWAYS_ON_TOP`, `MINIMIZE_WINDOW`, `TRAY_ICON_UPDATE`
- **Готова для расширения новыми каналами**

#### 4. Системная интеграция

- **Tray integration** - иконка в системном трее
- **Global shortcuts** - глобальные горячие клавиши
- **Notifications** - системные уведомления
- **Auto-update** - автообновления

## 🎯 План интеграции API (Обновленный)

### Этап 1: Подготовка инфраструктуры

#### 1.1 Создать API модули в electron процессе

```txt
app/electron/src/
├── api/
│   ├── pomodoro-data.ts     # Менеджер данных помидорок
│   ├── activity-tracker.ts  # Трекинг активности
│   ├── windows-monitor.ts   # Windows API интеграция
│   └── storage-manager.ts   # Расширение SafeStore
```

#### 1.2 Расширить Redux Store

```txt
app/renderer/src/store/
├── pomodoro/               # Новый slice
│   ├── index.ts           # Основной slice
│   ├── types.ts           # TypeScript типы
│   ├── thunks.ts          # Async действия
│   └── defaultState.ts    # Начальное состояние
```

#### 1.3 Добавить IPC каналы в shareables

```txt
app/shareables/src/
└── constants.ts           # Новые IPC константы
    - POMODORO_CREATE
    - POMODORO_START
    - ACTIVITY_TRACK_UPDATE
    - POMODORO_SAVE
```

### Этап 2: Интеграция с существующим Timer Store

#### 2.1 Расширить Timer Slice

```typescript
// app/renderer/src/store/timer/types.ts
interface TimerState {
  // существующие поля...
  playing: boolean;
  timerType: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
  round: number;

  // новые поля для API
  currentPomodoro: PomodoroSession | null;
  activityTracking: boolean;
  realTimeActivity: ActivityStats;
}
```

#### 2.2 Новые Redux Thunks

- `startPomodoroSession` - создание и запуск помидорки
- `pausePomodoroSession` - пауза с сохранением активности
- `completePomodoroSession` - завершение и финальное сохранение
- `updateActivityData` - обновление битовой маски

### Этап 3: Windows API интеграция

#### 3.1 Установить зависимости для Windows API

```json
{
  "dependencies": {
    "ffi-napi": "^4.0.3", // для Windows API
    "@types/ffi-napi": "^4.0.10", // типы
    "win32-api": "^20.0.0" // готовые биндинги
  }
}
```

#### 3.2 Создать Activity Monitor

```typescript
// app/electron/src/api/windows-monitor.ts
interface ActivityMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  getCurrentActivity(): ActivityStatus;
  getIdleTime(): number;
}
```

### Этап 4: Интеграция с UI

#### 4.1 Новые React компоненты

- `ActivityIndicator` - показ статуса активности
- `PomodoroHistory` - история помидорок (опционально)
- `ActivityStats` - статистика в настройках

#### 4.2 Расширить существующие компоненты

- Добавить индикатор активности в Timer
- Показать прогресс реального времени
- Настройки включения/выключения трекинга

## 🔧 Технические детали реализации

### Структура хранения данных

```txt
%APPDATA%/Pomatez/           # Стандартная папка Electron
├── config.json             # Существующие настройки
├── pomodoros-index.json     # Индекс помидорок
└── pomodoros/
    ├── 2025-08-09/
    │   ├── pomo_001.json
    │   └── pomo_002.json
    └── 2025-08-10/
        └── pomo_003.json
```

### Интеграция с существующим Timer

1. **При setPlay(true)** → создать помидорку через IPC
2. **Во время работы** → записывать активность каждые 5 минут
3. **При setPlay(false)** → пауза и сохранение прогресса
4. **При skipTimer/restartTimer** → завершить текущую помидорку

### Обратная совместимость

- Все существующие Redux actions остаются без изменений
- API работает как middleware - не ломает основной функционал
- Можно включать/отключать через настройки

## 📝 Приоритетный план реализации

### Неделя 1: Базовая инфраструктура

1. **Создать новые файлы структуры** в electron/src/api/
2. **Расширить SafeStore** для хранения данных помидорок
3. **Добавить IPC каналы** в shareables и main.ts
4. **Создать Redux slice** для помидорок

### Неделя 2: Windows API

1. **Установить и настроить** ffi-napi
2. **Создать Windows Monitor** с GetLastInputInfo
3. **Интегрировать с Timer** через Redux middleware
4. **Тестировать производительность** и стабильность

### Неделя 3: UI интеграция

1. **Добавить индикатор активности** в основной Timer
2. **Создать настройки** включения/выключения трекинга
3. **Тестировать полную интеграцию** с существующим функционалом
4. **Оптимизировать и полировать**

## ✅ Преимущества архитектуры Pomatez

1. **Современный стек** - Electron 18, React, TypeScript, Redux Toolkit
2. **Отличная архитектура** - четкое разделение main/renderer, типизация
3. **Готовая система состояний** - Redux с автосохранением
4. **Расширяемость** - легко добавлять новые slices и IPC каналы
5. **Качественная сборка** - Lerna + electron-builder
6. **Активная разработка** - проект поддерживается в 2025 году

## 🚀 Готовность к интеграции

Pomatez имеет **превосходную архитектуру** для интеграции вашего API:

- ✅ TypeScript для типобезопасности
- ✅ Redux Toolkit для управления состоянием
- ✅ Готовая система IPC коммуникации
- ✅ Расширяемый SafeStore для данных
- ✅ Современный Electron с отличной производительностью

**Можно начинать интеграцию API прямо сейчас!** 🎯
