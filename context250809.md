# Контекст проекта: Интеграция трекинга активности в Pomatez

## 📋 **Описание проекта**

Создание системы трекинга активности пользователя, интегрированной в существующее Electron приложение **Pomatez** (Pomodoro таймер). Система автоматически записывает активность пользователя в виде битовых масок и сохраняет данные в JSON файлы.

## 🏗️ **Архитектура системы**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Timer Actions │────│  Pomodoro        │────│  IPC Channels   │
│   (setPlay)     │    │  Middleware      │    │  (TO_MAIN)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Redux Store   │────│  Event Listeners │────│  Main Process   │
│   (pomodoro)    │    │  (FROM_MAIN)     │    │  IPC Handlers   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Components │    │  Activity        │────│  Storage        │
│   (selectors)   │    │  Tracker         │    │  Manager        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   BitMask       │    │   JSON Files    │
                       │   (5min chunks) │    │   + Index       │
                       └─────────────────┘    └─────────────────┘
```

## 📁 **Структура проекта**

```
C:\Projects\_Others\0808_pomodoro-db\
├── app\
│   ├── electron\src\               # Main процесс
│   │   ├── api\
│   │   │   ├── storage-manager.ts  # CRUD операции, индексация (371 строк)
│   │   │   └── activity-tracker.ts # Трекинг активности (355 строк)
│   │   ├── main.ts                 # IPC handlers (добавлено ~180 строк)
│   │   └── preload.ts              # Расширен для ipcRenderer
│   ├── renderer\src\               # Renderer процесс
│   │   ├── store\pomodoro\
│   │   │   ├── index.ts           # Redux slice (458 строк)
│   │   │   └── middleware.ts      # Timer интеграция (266 строк)
│   │   ├── store\store.ts         # Добавлен pomodoro reducer + middleware
│   │   ├── index.tsx              # Инициализация event listeners
│   │   └── extensions\window.extension.ts # Типы для ipcRenderer
│   └── shareables\src\
│       └── index.ts               # IPC каналы и типы (расширен)
```

## 🎯 **Текущий статус: 95% готов**

### ✅ **Полностью реализовано:**

1. **Backend (Electron Main)**

   - ✅ `storage-manager.ts` - полная система хранения с CRUD операциями
   - ✅ `activity-tracker.ts` - система трекинга с EventEmitter
   - ✅ `main.ts` - 8 IPC handlers для всех операций
   - ✅ Интеграция с SafeStore Pomatez

2. **IPC Communication**

   - ✅ 18 IPC каналов с TypeScript типизацией
   - ✅ `preload.ts` расширен для поддержки `ipcRenderer.invoke`
   - ✅ Все типы запросов/ответов определены

3. **Frontend (React/Redux)**

   - ✅ Redux slice с 8 async thunks
   - ✅ Middleware для автоматической интеграции с Timer
   - ✅ Event listeners для IPC событий
   - ✅ 15+ селекторов для UI

4. **Автоматическая интеграция**
   - ✅ При `timer/setPlay(true)` → создается помидорка + запускается трекинг
   - ✅ При `timer/setPlay(false)` → трекинг приостанавливается
   - ✅ При `timer/restartTimer` → сессия завершается и сохраняется

### 🔄 **Последний шаг (5%):**

- **Middleware не срабатывает** - middleware включен, но возможно проблема с типами timer actions

## 💾 **Структура данных**

### **Файловая система:**

```
%APPDATA%\Pomatez\
├── pomodoros-index.json          # Быстрый поиск сессий
├── pomodoros\
│   ├── 2025-08-09\
│   │   ├── pomodoro_001.json    # Полные данные сессии
│   │   └── pomodoro_002.json
│   └── 2025-08-10\
│       └── pomodoro_003.json
└── activity-masks\
    ├── pomodoro_001_2025-08-09.json  # Битовые маски (1=активен, 0=неактивен)
    └── pomodoro_002_2025-08-09.json
```

### **Структура сессии:**

```typescript
interface PomodoroSession {
  id: string; // Уникальный ID
  path: string; // Путь проекта
  title: string; // Название задачи
  status: "created" | "running" | "paused" | "completed";
  sessionType: "work" | "short_break" | "long_break";
  targetMinutes: number; // Целевое время (25 мин)
  totalMinutes: number; // Общее время сессии
  activeMinutes: number; // Время активной работы
  dailyMasks: Record<string, string>; // Битовые маски по дням
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### **Битовые маски:**

- Каждый символ = 5 минут активности
- `"1111100110"` = 50 минут, где первые 25 мин активны, потом 10 мин неактивны, потом 10 мин активны
- Автоматическое обновление каждые 5 минут

## 🔧 **Текущая проблема**

**Симптом:** При нажатии Play в Pomatez таймере файлы помидорок не создаются.

**Возможные причины:**

1. Middleware не перехватывает timer actions (тип action может отличаться)
2. Проблема с TypeScript типами в middleware
3. IPC коммуникация не работает

**Для диагностики нужно:**

1. Открыть DevTools в Electron (`Ctrl+Shift+I`)
2. Нажать Play и посмотреть Console логи
3. Проверить работу IPC: `window.electron.ipcRenderer.invoke('POMODORO_GET_SETTINGS')`

## 🧪 **Тестирование**

### **Команды для запуска:**

```bash
# Запуск dev режима (все пакеты)
npm run dev:app

# Или отдельно:
cd app\electron
npx electron .
```

### **Ожидаемое поведение:**

1. Открывается Electron окно Pomatez
2. При нажатии Play создается файл в `%APPDATA%\Pomatez\pomodoros\`
3. Каждые 5 минут записывается интервал активности
4. При паузе/остановке сессия сохраняется с полной статистикой

## 📝 **Ключевые особенности реализации**

1. **Безопасность:** Все IPC каналы проверяются в preload.ts
2. **Производительность:** Индексная система для быстрого поиска сессий
3. **Надежность:** Автоматические бэкапы и восстановление после сбоев
4. **Расширяемость:** Готово для интеграции с Windows API для реального трекинга
5. **Совместимость:** Не нарушает существующий функционал Pomatez

## 🎯 **Следующие шаги**

1. **Исправить middleware** - найти правильные timer action types
2. **Протестировать создание файлов**
3. **Добавить Windows API** для реального трекинга активности (опционально)
4. **Создать UI компоненты** для отображения статистики (опционально)

## 🔗 **Важные константы**

```typescript
// IPC каналы (shareables/src/index.ts)
export const POMODORO_CREATE_SESSION = "POMODORO_CREATE_SESSION";
export const POMODORO_START_TRACKING = "POMODORO_START_TRACKING";
export const POMODORO_PAUSE_TRACKING = "POMODORO_PAUSE_TRACKING";
export const POMODORO_STOP_TRACKING = "POMODORO_STOP_TRACKING";
// ... и другие

// Timer actions для middleware
"timer/setPlay",
  "timer/setTimerType",
  "timer/restartTimer",
  "timer/skipTimer";
```

**Проект практически завершен, осталось решить вопрос с срабатыванием middleware при действиях таймера.**
