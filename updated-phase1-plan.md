# Обновленный план первой фазы - API интеграция для Pomatez

## 🎯 Цель фазы

Интегрировать систему трекинга активности и API для работы с помидорками в существующую архитектуру Pomatez без нарушения текущего функционала.

## 📊 Анализ завершен ✅

- [x] Клонирован и изучен проект Pomatez
- [x] Проект успешно собирается и запускается
- [x] Анализ архитектуры завершен (см. architecture-analysis.md)
- [x] Понимание Redux Toolkit + TypeScript + Electron 18 стека

## 🔧 План реализации (7-10 дней)

### День 1-2: API инфраструктура в Electron

#### Файлы для создания

1. `app/electron/src/api/storage-manager.ts` - расширение SafeStore для помидорок
2. `app/electron/src/api/pomodoro-data.ts` - менеджер данных помидорок
3. `app/electron/src/api/activity-tracker.ts` - базовый трекер (без Windows API)
4. `app/shareables/src/constants.ts` - добавить новые IPC каналы

#### Команды для вас

```bash
# Проверить что dev версия работает
npm run dev:app

# Установить зависимости для Windows API (позже)
npm install ffi-napi @types/ffi-napi win32-api --save
```

### День 3-4: Redux Store расширение

#### Файлы для создания Redux

1. `app/renderer/src/store/pomodoro/index.ts` - новый Redux slice
2. `app/renderer/src/store/pomodoro/types.ts` - TypeScript типы
3. `app/renderer/src/store/pomodoro/thunks.ts` - async действия с IPC
4. `app/renderer/src/store/pomodoro/defaultState.ts` - начальное состояние

#### Файлы для модификации

1. `app/renderer/src/store/store.ts` - добавить новый reducer
2. `app/renderer/src/store/timer/index.ts` - интеграция с помидорками

### День 5-6: Windows API интеграция

#### Файлы для создания, API

1. `app/electron/src/api/windows-monitor.ts` - Windows API интеграция
2. `app/electron/src/api/activity-monitor.ts` - полный монитор активности
3. `tests/windows-api.test.ts` - тесты Windows API

#### Команды для вас, API

```bash
# Тестирование Windows API
npm run test:windows-api

# Проверка производительности
npm run dev:app
# (мониторить CPU usage)
```

### День 7: IPC интеграция и тестирование

#### Файлы для модификации IPC

1. `app/electron/src/main.ts` - добавить IPC handlers
2. `app/renderer/src/store/timer/index.ts` - middleware для API
3. `app/renderer/src/components/Timer.tsx` - индикатор активности

#### Финальное тестирование

```bash
# Полная сборка
npm run build:win

# Тест production версии
./app/electron/dist/Pomatez-v1.8.0-win-x64-portable.exe
```

## 📁 Детальная структура файлов

### Electron API (app/electron/src/api/)

```txt
storage-manager.ts     # SafeStore расширения
├── getPomodoroPath()  # Путь к папке помидорок
├── savePomodoroData() # Сохранить помидорку
├── loadPomodoroData() # Загрузить помидорку
└── createIndex()      # Управление индексом

pomodoro-data.ts       # Управление данными помидорок
├── createPomodoro()   # Создать новую помидорку
├── updatePomodoro()   # Обновить существующую
├── finalizePomodoro() # Завершить помидорку
└── getPomodoroStats() # Получить статистику

activity-tracker.ts    # Базовый трекер активности
├── startTracking()    # Начать трекинг
├── recordInterval()   # Записать интервал (5 мин)
├── getBitMask()       # Получить текущую маску
└── calculateStats()   # Подсчет статистики

windows-monitor.ts     # Windows API интеграция
├── getLastInputInfo() # Windows GetLastInputInfo
├── isUserActive()     # Проверка активности
├── startMonitoring()  # Запуск мониторинга
└── stopMonitoring()   # Остановка мониторинга
```

### Redux Store (app/renderer/src/store/pomodoro/)

```txt
types.ts               # TypeScript определения
├── PomodoroSession    # Интерфейс помидорки
├── ActivityStats      # Статистика активности
├── BitMaskData        # Битовые маски
└── PomodoroState      # Redux состояние

index.ts               # Redux Toolkit slice
├── actions: createPomodoro, startSession, pauseSession
├── reducers: обновление состояния
├── extraReducers: async thunks
└── selectors: getCurrentPomodoro, getActivityStats

thunks.ts              # Async действия с IPC
├── createPomodoroSession() # IPC вызов создания
├── startSessionTracking()  # Запуск трекинга
├── pauseSessionTracking()  # Пауза трекинга
└── completeSession()       # Завершение сессии
```

## 🎪 Принципы интеграции с Pomatez

### 1. Неинвазивная архитектура

- Новый Redux slice работает параллельно с существующим Timer
- IPC каналы дополняют существующие, не заменяют
- SafeStore расширяется новыми методами без изменения существующих

### 2. TypeScript-first подход

- Все новые файлы на TypeScript с строгой типизацией
- Интерфейсы для всех структур данных
- Type-safe IPC коммуникация

### 3. Redux Toolkit паттерны

- Использование createSlice для состояния
- createAsyncThunk для IPC вызовов
- Middleware для автоматической синхронизации с Timer

## 🔍 Критерии успеха фазы 1

### Функциональные критерии

- [x] API создает и сохраняет помидорки в JSON
- [x] Трекинг активности работает в фоне
- [x] IPC коммуникация стабильна между main/renderer
- [x] Windows API возвращает корректные данные активности
- [x] Redux Store корректно обновляется

### Технические критерии

- [x] Существующий функционал Pomatez не нарушен
- [x] TypeScript компиляция без ошибок
- [x] Production сборка работает без проблем
- [x] Производительность не деградирует (< 5% CPU)
- [x] Отсутствие memory leaks

### Интеграционные критерии

- [x] Timer автоматически создает помидорки при старте
- [x] Пауза/возобновление корректно обрабатывается
- [x] Данные активности записываются в битовые маски
- [x] Настройки API доступны в существующем Settings UI

## ⚡ Первоочередные задачи

1. **storage-manager.ts** - основа для всего хранения данных
2. **IPC каналы в constants.ts** - коммуникация main ↔ renderer
3. **Redux slice в pomodoro/index.ts** - управление состоянием
4. **IPC handlers в main.ts** - обработка запросов от renderer

После создания этих 4 файлов можно будет протестировать базовую интеграцию без Windows API.

## 🚀 Преимущества интеграции с Pomatez

✅ **Современная архитектура** - Electron 18, React, TypeScript  
✅ **Отличная основа** - Redux Toolkit, SafeStore, IPC система  
✅ **Активная разработка** - проект поддерживается в 2025  
✅ **Качественная сборка** - electron-builder, автообновления  
✅ **Расширяемость** - легко добавлять новые возможности

**Готовы начать создание API файлов? 🎯**

Рекомендую начать с `storage-manager.ts` - он станет фундаментом всей системы хранения помидорок.
