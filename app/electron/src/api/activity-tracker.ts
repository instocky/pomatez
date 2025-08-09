/**
 * Activity Tracker - Базовая система трекинга активности
 * Без Windows API интеграции (пока моки данных)
 */

import { EventEmitter } from "events";
import { storageManager, PomodoroSession } from "./storage-manager";

interface ActivityStatus {
  isActive: boolean;
  lastInputTime: number;
  idleTimeSeconds: number;
  mouseActivity: boolean;
  keyboardActivity: boolean;
}

interface ActivityStats {
  totalIntervals: number;
  activeIntervals: number;
  inactiveIntervals: number;
  activityPercentage: number;
  sessionDuration?: number;
  realWorkTime?: number;
}

interface BitMaskData {
  date: string;
  pomodoroId: string;
  mask: string;
  startTime: string;
  lastUpdated: string;
  intervalCount: number;
}

class ActivityTracker extends EventEmitter {
  private currentSession: PomodoroSession | null = null;
  private isTracking: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  private currentBitMask: string = "";
  private intervalDuration: number = 5 * 60 * 1000; // 5 minutes in ms
  private activityThreshold: number = 3 * 60 * 1000; // 3 minutes in ms

  constructor() {
    super();
    console.log("[ActivityTracker] Initialized");
  }

  /**
   * Запустить трекинг для сессии
   */
  async startTracking(session: PomodoroSession): Promise<boolean> {
    try {
      if (this.isTracking) {
        console.warn(
          "[ActivityTracker] Already tracking, stopping previous session"
        );
        await this.stopTracking();
      }

      console.log(
        `[ActivityTracker] Starting tracking for session: ${session.id}`
      );

      this.currentSession = session;
      this.isTracking = true;
      this.startTime = new Date();
      this.currentBitMask = "";

      // Загрузить существующую маску если есть
      const today = new Date().toISOString().split("T")[0];
      if (session.dailyMasks[today]) {
        this.currentBitMask = session.dailyMasks[today];
      }

      // Запустить интервальную запись
      this.startIntervalRecording();

      this.emit("tracking_started", session);
      return true;
    } catch (error) {
      console.error(
        "[ActivityTracker] Failed to start tracking:",
        error
      );
      return false;
    }
  }

  /**
   * Остановить трекинг
   */
  async stopTracking(): Promise<boolean> {
    try {
      if (!this.isTracking || !this.currentSession) {
        console.warn("[ActivityTracker] Not currently tracking");
        return true;
      }

      console.log(
        `[ActivityTracker] Stopping tracking for session: ${this.currentSession.id}`
      );

      // Записать финальный интервал
      await this.recordCurrentInterval();

      // Остановить таймер
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }

      // Финализировать сессию
      await this.finalizeSession();

      const stoppedSession = this.currentSession;
      this.currentSession = null;
      this.isTracking = false;
      this.startTime = null;
      this.currentBitMask = "";

      this.emit("tracking_stopped", stoppedSession);
      return true;
    } catch (error) {
      console.error(
        "[ActivityTracker] Failed to stop tracking:",
        error
      );
      return false;
    }
  }

  /**
   * Приостановить трекинг
   */
  async pauseTracking(): Promise<boolean> {
    try {
      if (!this.isTracking) {
        console.warn("[ActivityTracker] Not currently tracking");
        return true;
      }

      console.log("[ActivityTracker] Pausing tracking");

      // Записать текущий интервал
      await this.recordCurrentInterval();

      // Остановить таймер но сохранить состояние
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }

      this.emit("tracking_paused", this.currentSession);
      return true;
    } catch (error) {
      console.error(
        "[ActivityTracker] Failed to pause tracking:",
        error
      );
      return false;
    }
  }

  /**
   * Возобновить трекинг
   */
  async resumeTracking(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        console.warn("[ActivityTracker] No session to resume");
        return false;
      }

      console.log("[ActivityTracker] Resuming tracking");

      this.isTracking = true;
      this.startIntervalRecording();

      this.emit("tracking_resumed", this.currentSession);
      return true;
    } catch (error) {
      console.error(
        "[ActivityTracker] Failed to resume tracking:",
        error
      );
      return false;
    }
  }

  /**
   * Запустить интервальную запись активности
   */
  private startIntervalRecording(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    // Записывать каждые 5 минут
    this.intervalTimer = setInterval(async () => {
      if (this.isTracking) {
        await this.recordCurrentInterval();
      }
    }, this.intervalDuration);

    console.log("[ActivityTracker] Interval recording started");
  }

  /**
   * Записать текущий интервал активности
   */
  private async recordCurrentInterval(): Promise<void> {
    try {
      if (!this.currentSession || !this.startTime) {
        return;
      }

      // TODO: Получить реальную активность из Windows API
      // Пока используем мок-данные
      const activity = await this.getCurrentActivity();
      const isActive = activity.isActive;

      // Добавить интервал в битовую маску
      this.currentBitMask += isActive ? "1" : "0";

      // Обновить сессию
      const today = new Date().toISOString().split("T")[0];
      this.currentSession.dailyMasks[today] = this.currentBitMask;

      // Пересчитать активные минуты
      const activeIntervals = (this.currentBitMask.match(/1/g) || [])
        .length;
      this.currentSession.activeMinutes = activeIntervals * 5;

      // Обновить общее время
      const totalMinutes = Math.floor(
        (Date.now() - this.startTime.getTime()) / (1000 * 60)
      );
      this.currentSession.totalMinutes = totalMinutes;

      // Сохранить в storage
      await storageManager.savePomodoro(this.currentSession);

      // Сохранить битовую маску отдельно
      await storageManager.saveBitMask(this.currentSession.id, {
        date: today,
        pomodoroId: this.currentSession.id,
        mask: this.currentBitMask,
        startTime: this.startTime.toISOString(),
        lastUpdated: new Date().toISOString(),
        intervalCount: this.currentBitMask.length,
      });

      // Отправить статистику
      const stats = this.calculateStats();
      this.emit("interval_recorded", {
        sessionId: this.currentSession.id,
        intervalIndex: this.currentBitMask.length - 1,
        isActive,
        stats,
      });

      console.log(
        `[ActivityTracker] Recorded interval: ${
          isActive ? "ACTIVE" : "INACTIVE"
        } (${this.currentBitMask.length} total)`
      );
    } catch (error) {
      console.error(
        "[ActivityTracker] Failed to record interval:",
        error
      );
    }
  }

  /**
   * Получить текущую активность (MOCK - потом заменить на Windows API)
   */
  private async getCurrentActivity(): Promise<ActivityStatus> {
    // TODO: Заменить на реальный Windows API
    // Пока возвращаем рандомные данные для тестирования
    const isActive = Math.random() > 0.3; // 70% chance of being active

    return {
      isActive,
      lastInputTime: Date.now() - (isActive ? 1000 : 5 * 60 * 1000),
      idleTimeSeconds: isActive ? 0 : 5 * 60,
      mouseActivity: isActive && Math.random() > 0.5,
      keyboardActivity: isActive && Math.random() > 0.5,
    };
  }

  /**
   * Рассчитать статистику текущей сессии
   */
  private calculateStats(): ActivityStats {
    const totalIntervals = this.currentBitMask.length;
    const activeIntervals = (this.currentBitMask.match(/1/g) || [])
      .length;
    const inactiveIntervals = totalIntervals - activeIntervals;
    const activityPercentage =
      totalIntervals > 0 ? (activeIntervals / totalIntervals) * 100 : 0;

    const sessionDuration = this.startTime
      ? Math.floor(
          (Date.now() - this.startTime.getTime()) / (1000 * 60)
        )
      : 0;

    const realWorkTime = activeIntervals * 5;

    return {
      totalIntervals,
      activeIntervals,
      inactiveIntervals,
      activityPercentage,
      sessionDuration,
      realWorkTime,
    };
  }

  /**
   * Финализировать сессию при завершении
   */
  private async finalizeSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Обновить финальный статус
      this.currentSession.status = "completed";
      this.currentSession.completedAt = new Date().toISOString();
      this.currentSession.updatedAt = new Date().toISOString();

      // Финальный пересчет статистики
      const stats = this.calculateStats();
      this.currentSession.activeMinutes = stats.realWorkTime || 0;
      this.currentSession.totalMinutes = stats.sessionDuration || 0;

      // Сохранить финальную версию
      await storageManager.savePomodoro(this.currentSession);

      console.log(
        `[ActivityTracker] Session ${this.currentSession.id} finalized`
      );
      console.log(
        `- Total time: ${this.currentSession.totalMinutes} min`
      );
      console.log(
        `- Active time: ${this.currentSession.activeMinutes} min`
      );
      console.log(
        `- Activity: ${stats.activityPercentage.toFixed(1)}%`
      );
    } catch (error) {
      console.error(
        "[ActivityTracker] Failed to finalize session:",
        error
      );
    }
  }

  /**
   * Получить текущую статистику
   */
  getCurrentStats(): ActivityStats | null {
    if (!this.isTracking) return null;
    return this.calculateStats();
  }

  /**
   * Получить текущую битовую маску
   */
  getCurrentBitMask(): string {
    return this.currentBitMask;
  }

  /**
   * Проверить статус трекинга
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Получить текущую сессию
   */
  getCurrentSession(): PomodoroSession | null {
    return this.currentSession;
  }
}

// Экспорт singleton instance
export const activityTracker = new ActivityTracker();
export default activityTracker;

// Экспорт типов
export type { ActivityStatus, ActivityStats, BitMaskData };
