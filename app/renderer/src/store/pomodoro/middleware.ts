/**
 * Timer Integration Middleware - Интеграция с существующим Timer slice
 * Автоматически создает и управляет помидорками при изменении состояния таймера
 */

import { Middleware } from "@reduxjs/toolkit";
import {
  createPomodoroSession,
  startSessionTracking,
  pauseSessionTracking,
  stopSessionTracking,
  clearCurrentSession,
} from "./index";

// Типы для интеграции с Timer slice
interface TimerState {
  playing: boolean;
  timerType: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
  round: number;
}

interface RootState {
  timer: TimerState;
  pomodoro: {
    currentSession: any;
    isTracking: boolean;
    settings: {
      autoCreateSessions: boolean;
      trackingEnabled: boolean;
    };
  };
  tasks: {
    present: {
      cards: Array<{ text: string }>;
    };
  };
}

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

function getCurrentTaskTitle(state: RootState): string {
  const cards = state.tasks?.present?.cards || [];
  if (cards.length > 0) {
    return cards[0].text || "Untitled Task";
  }
  return `${mapTimerTypeToSessionType(state.timer.timerType)} Session`;
}

function getCurrentProjectPath(): string {
  // В будущем можно добавить определение текущего проекта
  // Пока используем базовое значение
  return process.cwd();
}

// Middleware для интеграции Pomodoro с Timer
export const pomodoroTimerMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action: any) => {
    const prevState = store.getState();
    const result = next(action);
    const nextState = store.getState();

    // Проверяем включена ли автоматическая интеграция
    if (
      !nextState.pomodoro.settings.autoCreateSessions ||
      !nextState.pomodoro.settings.trackingEnabled
    ) {
      return result;
    }

    // Обработка изменений в Timer
    if (action.type === "timer/setPlay") {
      const isNowPlaying = nextState.timer.playing;
      const wasPlaying = prevState.timer.playing;

      if (isNowPlaying && !wasPlaying) {
        // Timer запущен
        handleTimerStart(store, nextState);
      } else if (!isNowPlaying && wasPlaying) {
        // Timer остановлен/приостановлен
        handleTimerPause(store, nextState);
      }
    }

    // Обработка смены типа таймера
    if (
      action.type === "timer/setTimerType" ||
      action.type === "timer/skipTimer"
    ) {
      handleTimerTypeChange(store, nextState, prevState);
    }

    // Обработка сброса таймера
    if (action.type === "timer/restartTimer") {
      handleTimerRestart(store, nextState);
    }

    return result;
  };

// Обработчики событий Timer
async function handleTimerStart(store: any, state: RootState) {
  const { currentSession, isTracking } = state.pomodoro;

  if (!currentSession) {
    // Создать новую сессию
    const sessionData = {
      path: getCurrentProjectPath(),
      title: getCurrentTaskTitle(state),
      sessionType: mapTimerTypeToSessionType(state.timer.timerType),
      targetMinutes: getTargetMinutes(state.timer.timerType),
      description: `Round ${
        state.timer.round
      } - ${state.timer.timerType.toLowerCase()} session`,
    };

    console.log(
      "[PomodoroMiddleware] Creating new session:",
      sessionData
    );

    try {
      const action = await store.dispatch(
        createPomodoroSession(sessionData)
      );
      if (createPomodoroSession.fulfilled.match(action)) {
        // Запустить трекинг после создания сессии
        setTimeout(() => {
          const newState = store.getState();
          const session = newState.pomodoro.currentSession;
          if (session) {
            store.dispatch(startSessionTracking(session.id));
          }
        }, 100);
      }
    } catch (error) {
      console.error(
        "[PomodoroMiddleware] Failed to create session:",
        error
      );
    }
  } else if (!isTracking) {
    // Возобновить трекинг существующей сессии
    console.log(
      "[PomodoroMiddleware] Resuming tracking for session:",
      currentSession.id
    );
    store.dispatch(startSessionTracking(currentSession.id));
  }
}

async function handleTimerPause(store: any, state: RootState) {
  const { currentSession, isTracking } = state.pomodoro;

  if (currentSession && isTracking) {
    console.log(
      "[PomodoroMiddleware] Pausing tracking for session:",
      currentSession.id
    );
    store.dispatch(pauseSessionTracking(currentSession.id));
  }
}

async function handleTimerTypeChange(
  store: any,
  nextState: RootState,
  prevState: RootState
) {
  const { currentSession } = nextState.pomodoro;

  // Если изменился тип таймера, завершить текущую сессию
  if (
    currentSession &&
    nextState.timer.timerType !== prevState.timer.timerType
  ) {
    console.log(
      "[PomodoroMiddleware] Timer type changed, completing current session"
    );

    try {
      await store.dispatch(stopSessionTracking(currentSession.id));
    } catch (error) {
      console.error(
        "[PomodoroMiddleware] Failed to stop session:",
        error
      );
    }
  }
}

async function handleTimerRestart(store: any, state: RootState) {
  const { currentSession, isTracking } = state.pomodoro;

  if (currentSession) {
    console.log(
      "[PomodoroMiddleware] Timer restarted, completing current session"
    );

    try {
      if (isTracking) {
        await store.dispatch(stopSessionTracking(currentSession.id));
      } else {
        // Если трекинг не активен, просто очистить текущую сессию
        store.dispatch(clearCurrentSession());
      }
    } catch (error) {
      console.error(
        "[PomodoroMiddleware] Failed to handle timer restart:",
        error
      );
    }
  }
}

// Event listeners для IPC событий из main процесса
export function setupPomodoroEventListeners(dispatch: any) {
  // Проверка что мы в Electron окружении
  if (!window.electron?.ipcRenderer) {
    console.warn(
      "[PomodoroMiddleware] Not in Electron environment, skipping event listeners setup"
    );
    return;
  }

  const { ipcRenderer } = window.electron;

  // Импорт констант из shareables
  import("@pomatez/shareables")
    .then((constants) => {
      // Обновления активности в реальном времени
      ipcRenderer.on(
        constants.ACTIVITY_STATUS_CHANGED,
        (_, activity) => {
          dispatch({
            type: "pomodoro/updateCurrentActivity",
            payload: activity,
          });
        }
      );

      // Обновления статистики
      ipcRenderer.on(constants.ACTIVITY_STATS_UPDATED, (_, payload) => {
        dispatch({
          type: "pomodoro/updateActivityStats",
          payload: payload.stats,
        });
      });

      // Обновления битовой маски
      ipcRenderer.on(
        constants.ACTIVITY_BITMASK_UPDATED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/updateBitMask",
            payload: payload.mask,
          });
        }
      );

      // События сессий
      ipcRenderer.on(
        constants.POMODORO_SESSION_CREATED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/setCurrentSession",
            payload: payload.session,
          });
        }
      );

      ipcRenderer.on(
        constants.POMODORO_SESSION_UPDATED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/updateCurrentSession",
            payload: payload.session,
          });
        }
      );

      ipcRenderer.on(
        constants.POMODORO_SESSION_COMPLETED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/addToHistory",
            payload: payload.session,
          });
          dispatch({ type: "pomodoro/clearCurrentSession" });
        }
      );

      // События трекинга
      ipcRenderer.on(
        constants.POMODORO_TRACKING_STARTED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/setTrackingStatus",
            payload: true,
          });
        }
      );

      ipcRenderer.on(
        constants.POMODORO_TRACKING_PAUSED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/setTrackingStatus",
            payload: false,
          });
        }
      );

      ipcRenderer.on(
        constants.POMODORO_TRACKING_STOPPED,
        (_, payload) => {
          dispatch({
            type: "pomodoro/setTrackingStatus",
            payload: false,
          });
        }
      );

      console.log("[PomodoroMiddleware] Event listeners configured");
    })
    .catch((error) => {
      console.error(
        "[PomodoroMiddleware] Failed to setup event listeners:",
        error
      );
    });
}

// Функция для очистки event listeners
export function cleanupPomodoroEventListeners() {
  // Проверка что мы в Electron окружении
  if (!window.electron?.ipcRenderer) {
    console.warn(
      "[PomodoroMiddleware] Not in Electron environment, skipping cleanup"
    );
    return;
  }

  const { ipcRenderer } = window.electron;

  import("@pomatez/shareables").then((constants) => {
    // Удалить все listeners
    ipcRenderer.removeAllListeners(constants.ACTIVITY_STATUS_CHANGED);
    ipcRenderer.removeAllListeners(constants.ACTIVITY_STATS_UPDATED);
    ipcRenderer.removeAllListeners(constants.ACTIVITY_BITMASK_UPDATED);
    ipcRenderer.removeAllListeners(constants.POMODORO_SESSION_CREATED);
    ipcRenderer.removeAllListeners(constants.POMODORO_SESSION_UPDATED);
    ipcRenderer.removeAllListeners(
      constants.POMODORO_SESSION_COMPLETED
    );
    ipcRenderer.removeAllListeners(constants.POMODORO_TRACKING_STARTED);
    ipcRenderer.removeAllListeners(constants.POMODORO_TRACKING_PAUSED);
    ipcRenderer.removeAllListeners(constants.POMODORO_TRACKING_STOPPED);

    console.log("[PomodoroMiddleware] Event listeners cleaned up");
  });
}

export default pomodoroTimerMiddleware;
