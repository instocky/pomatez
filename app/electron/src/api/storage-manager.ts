/**
 * Storage Manager - Расширение SafeStore для управления данными помидорок
 * Основа системы хранения для трекинга активности
 */

import { app } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import store from "../store";

// Типы для TypeScript
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
  dailyMasks: Record<string, string>; // "YYYY-MM-DD": битовая маска
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface PomodoroSettings {
  trackingEnabled: boolean;
  activityThresholdSeconds: number;
  intervalDurationMinutes: number;
  showActivityIndicator: boolean;
  autoCreateSessions: boolean;
  saveDetailedLogs: boolean;
}

interface PomodoroIndex {
  version: string;
  createdAt: string;
  lastUpdated: string;
  totalSessions: number;
  sessions: Record<
    string,
    {
      id: string;
      date: string;
      filePath: string;
      status: string;
      sessionType: string;
      totalMinutes: number;
      activeMinutes: number;
    }
  >;
  dailyStats: Record<
    string,
    {
      date: string;
      sessionsCount: number;
      totalActiveMinutes: number;
      averageActivity: number;
    }
  >;
}

interface BitMaskData {
  date: string;
  pomodoroId: string;
  mask: string;
  startTime: string;
  lastUpdated: string;
  intervalCount: number;
}

interface PomodoroFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sessionType?: string;
  limit?: number;
}

class PomodoroStorageManager {
  private readonly userDataPath: string;
  private readonly pomodorosDir: string;
  private readonly indexFilePath: string;
  private readonly bitMasksDir: string;

  constructor() {
    this.userDataPath = app.getPath("userData");
    this.pomodorosDir = path.join(this.userDataPath, "pomodoros");
    this.bitMasksDir = path.join(this.userDataPath, "activity-masks");
    this.indexFilePath = path.join(
      this.userDataPath,
      "pomodoros-index.json"
    );

    this.initializeDirectories();
  }

  /**
   * Инициализация необходимых директорий
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.pomodorosDir, { recursive: true });
      await fs.mkdir(this.bitMasksDir, { recursive: true });
      console.log("[StorageManager] Directories initialized");
    } catch (error) {
      console.error(
        "[StorageManager] Failed to initialize directories:",
        error
      );
    }
  }

  /**
   * Получить путь к файлу помидорки
   */
  private getPomodoroFilePath(
    sessionId: string,
    date?: string
  ): string {
    const sessionDate = date || new Date().toISOString().split("T")[0];
    const dateDir = path.join(this.pomodorosDir, sessionDate);
    return path.join(dateDir, `${sessionId}.json`);
  }

  /**
   * Получить путь к файлу битовой маски
   */
  private getBitMaskFilePath(pomodoroId: string, date: string): string {
    return path.join(this.bitMasksDir, `${pomodoroId}_${date}.json`);
  }

  /**
   * Сохранить помидорку
   */
  async savePomodoro(session: PomodoroSession): Promise<boolean> {
    try {
      const sessionDate = session.createdAt.split("T")[0];
      const filePath = this.getPomodoroFilePath(
        session.id,
        sessionDate
      );
      const dateDir = path.dirname(filePath);

      // Создать директорию для даты если не существует
      await fs.mkdir(dateDir, { recursive: true });

      // Обновить timestamp
      session.updatedAt = new Date().toISOString();

      // Сохранить файл
      await fs.writeFile(
        filePath,
        JSON.stringify(session, null, 2),
        "utf8"
      );

      // Обновить индекс
      await this.updateIndex(session);

      console.log(`[StorageManager] Saved pomodoro: ${session.id}`);
      return true;
    } catch (error) {
      console.error("[StorageManager] Failed to save pomodoro:", error);
      return false;
    }
  }

  /**
   * Загрузить помидорку по ID
   */
  async loadPomodoro(
    sessionId: string
  ): Promise<PomodoroSession | null> {
    try {
      // Сначала попробуем найти в индексе
      const index = await this.loadIndex();
      const sessionInfo = index.sessions[sessionId];

      if (!sessionInfo) {
        console.warn(
          `[StorageManager] Session not found in index: ${sessionId}`
        );
        return null;
      }

      // Загрузить файл
      const filePath = this.getPomodoroFilePath(
        sessionId,
        sessionInfo.date
      );
      const data = await fs.readFile(filePath, "utf8");
      const session = JSON.parse(data) as PomodoroSession;

      console.log(`[StorageManager] Loaded pomodoro: ${sessionId}`);
      return session;
    } catch (error) {
      console.error(
        `[StorageManager] Failed to load pomodoro ${sessionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Удалить помидорку
   */
  async deletePomodoro(sessionId: string): Promise<boolean> {
    try {
      const index = await this.loadIndex();
      const sessionInfo = index.sessions[sessionId];

      if (!sessionInfo) {
        console.warn(
          `[StorageManager] Session not found: ${sessionId}`
        );
        return false;
      }

      // Удалить файл помидорки
      const filePath = this.getPomodoroFilePath(
        sessionId,
        sessionInfo.date
      );
      await fs.unlink(filePath);

      // Удалить битовые маски
      const bitMaskPath = this.getBitMaskFilePath(
        sessionId,
        sessionInfo.date
      );
      try {
        await fs.unlink(bitMaskPath);
      } catch {
        // Битовая маска может не существовать
      }

      // Обновить индекс
      delete index.sessions[sessionId];
      await this.saveIndex(index);

      console.log(`[StorageManager] Deleted pomodoro: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(
        `[StorageManager] Failed to delete pomodoro ${sessionId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Получить список помидорок с фильтрами
   */
  async listPomodoros(
    filters: PomodoroFilters = {}
  ): Promise<PomodoroSession[]> {
    try {
      const index = await this.loadIndex();
      let sessions = Object.values(index.sessions);

      // Применить фильтры
      if (filters.dateFrom) {
        sessions = sessions.filter((s) => s.date >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        sessions = sessions.filter((s) => s.date <= filters.dateTo!);
      }
      if (filters.status) {
        sessions = sessions.filter((s) => s.status === filters.status);
      }
      if (filters.sessionType) {
        sessions = sessions.filter(
          (s) => s.sessionType === filters.sessionType
        );
      }

      // Ограничить количество результатов
      if (filters.limit) {
        sessions = sessions.slice(0, filters.limit);
      }

      // Загрузить полные данные для каждой сессии
      const fullSessions: PomodoroSession[] = [];
      for (const sessionInfo of sessions) {
        const fullSession = await this.loadPomodoro(sessionInfo.id);
        if (fullSession) {
          fullSessions.push(fullSession);
        }
      }

      console.log(
        `[StorageManager] Listed ${fullSessions.length} pomodoros`
      );
      return fullSessions;
    } catch (error) {
      console.error(
        "[StorageManager] Failed to list pomodoros:",
        error
      );
      return [];
    }
  }

  /**
   * Загрузить индексный файл
   */
  async loadIndex(): Promise<PomodoroIndex> {
    try {
      const data = await fs.readFile(this.indexFilePath, "utf8");
      return JSON.parse(data) as PomodoroIndex;
    } catch (error) {
      // Создать новый индекс если файл не существует
      console.log("[StorageManager] Creating new index file");
      return this.createFreshIndex();
    }
  }

  /**
   * Сохранить индексный файл
   */
  private async saveIndex(index: PomodoroIndex): Promise<void> {
    try {
      index.lastUpdated = new Date().toISOString();
      await fs.writeFile(
        this.indexFilePath,
        JSON.stringify(index, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("[StorageManager] Failed to save index:", error);
    }
  }

  /**
   * Создать новый индексный файл
   */
  private createFreshIndex(): PomodoroIndex {
    const now = new Date().toISOString();
    return {
      version: "1.0.0",
      createdAt: now,
      lastUpdated: now,
      totalSessions: 0,
      sessions: {},
      dailyStats: {},
    };
  }

  /**
   * Обновить индекс при сохранении помидорки
   */
  async updateIndex(session: PomodoroSession): Promise<void> {
    try {
      const index = await this.loadIndex();
      const sessionDate = session.createdAt.split("T")[0];

      // Обновить информацию о сессии
      const isNewSession = !index.sessions[session.id];
      index.sessions[session.id] = {
        id: session.id,
        date: sessionDate,
        filePath: this.getPomodoroFilePath(session.id, sessionDate),
        status: session.status,
        sessionType: session.sessionType,
        totalMinutes: session.totalMinutes,
        activeMinutes: session.activeMinutes,
      };

      // Увеличить счетчик если новая сессия
      if (isNewSession) {
        index.totalSessions++;
      }

      // Обновить дневную статистику
      if (!index.dailyStats[sessionDate]) {
        index.dailyStats[sessionDate] = {
          date: sessionDate,
          sessionsCount: 0,
          totalActiveMinutes: 0,
          averageActivity: 0,
        };
      }

      const dayStats = index.dailyStats[sessionDate];
      if (isNewSession) {
        dayStats.sessionsCount++;
      }

      // Пересчитать статистику дня
      const daySessions = Object.values(index.sessions).filter(
        (s) => s.date === sessionDate
      );

      dayStats.totalActiveMinutes = daySessions.reduce(
        (sum, s) => sum + s.activeMinutes,
        0
      );

      const totalMinutes = daySessions.reduce(
        (sum, s) => sum + s.totalMinutes,
        0
      );

      dayStats.averageActivity =
        totalMinutes > 0
          ? (dayStats.totalActiveMinutes / totalMinutes) * 100
          : 0;

      await this.saveIndex(index);
      console.log(
        `[StorageManager] Updated index for session: ${session.id}`
      );
    } catch (error) {
      console.error("[StorageManager] Failed to update index:", error);
    }
  }

  /**
   * Пересоздать индекс на основе существующих файлов
   */
  async rebuildIndex(): Promise<void> {
    try {
      console.log("[StorageManager] Rebuilding index...");
      const index = this.createFreshIndex();

      // Сканировать все директории с датами
      const items = await fs.readdir(this.pomodorosDir);
      const dateDirs = items.filter((item) =>
        /^\d{4}-\d{2}-\d{2}$/.test(item)
      );

      for (const dateDir of dateDirs) {
        const datePath = path.join(this.pomodorosDir, dateDir);
        const files = await fs.readdir(datePath);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));

        for (const file of jsonFiles) {
          const filePath = path.join(datePath, file);
          try {
            const data = await fs.readFile(filePath, "utf8");
            const session = JSON.parse(data) as PomodoroSession;

            // Добавить в индекс без пересохранения файла
            const sessionDate = session.createdAt.split("T")[0];
            index.sessions[session.id] = {
              id: session.id,
              date: sessionDate,
              filePath: filePath,
              status: session.status,
              sessionType: session.sessionType,
              totalMinutes: session.totalMinutes,
              activeMinutes: session.activeMinutes,
            };
            index.totalSessions++;
          } catch (error) {
            console.warn(
              `[StorageManager] Failed to read session file: ${filePath}`,
              error
            );
          }
        }
      }

      // Пересчитать дневную статистику
      for (const sessionInfo of Object.values(index.sessions)) {
        const date = sessionInfo.date;
        if (!index.dailyStats[date]) {
          index.dailyStats[date] = {
            date,
            sessionsCount: 0,
            totalActiveMinutes: 0,
            averageActivity: 0,
          };
        }

        const dayStats = index.dailyStats[date];
        dayStats.sessionsCount++;
        dayStats.totalActiveMinutes += sessionInfo.activeMinutes;
      }

      // Рассчитать средний процент активности
      for (const dayStats of Object.values(index.dailyStats)) {
        const daySessions = Object.values(index.sessions).filter(
          (s) => s.date === dayStats.date
        );

        const totalMinutes = daySessions.reduce(
          (sum, s) => sum + s.totalMinutes,
          0
        );

        dayStats.averageActivity =
          totalMinutes > 0
            ? (dayStats.totalActiveMinutes / totalMinutes) * 100
            : 0;
      }

      await this.saveIndex(index);
      console.log(
        `[StorageManager] Rebuilt index with ${index.totalSessions} sessions`
      );
    } catch (error) {
      console.error("[StorageManager] Failed to rebuild index:", error);
    }
  }

  /**
   * Сохранить битовую маску активности
   */
  async saveBitMask(
    pomodoroId: string,
    maskData: BitMaskData
  ): Promise<void> {
    try {
      const filePath = this.getBitMaskFilePath(
        pomodoroId,
        maskData.date
      );
      await fs.writeFile(
        filePath,
        JSON.stringify(maskData, null, 2),
        "utf8"
      );

      console.log(
        `[StorageManager] Saved bit mask for ${pomodoroId} on ${maskData.date}`
      );
    } catch (error) {
      console.error("[StorageManager] Failed to save bit mask:", error);
    }
  }

  /**
   * Загрузить битовую маску
   */
  async loadBitMask(pomodoroId: string, date: string): Promise<string> {
    try {
      const filePath = this.getBitMaskFilePath(pomodoroId, date);
      const data = await fs.readFile(filePath, "utf8");
      const maskData = JSON.parse(data) as BitMaskData;

      return maskData.mask;
    } catch (error) {
      console.warn(
        `[StorageManager] Bit mask not found for ${pomodoroId} on ${date}`
      );
      return "";
    }
  }

  /**
   * Получить статистику сессии
   */
  async getSessionStats(pomodoroId: string): Promise<{
    totalIntervals: number;
    activeIntervals: number;
    inactiveIntervals: number;
    activityPercentage: number;
  }> {
    try {
      const session = await this.loadPomodoro(pomodoroId);
      if (!session) {
        throw new Error(`Session ${pomodoroId} not found`);
      }

      let totalIntervals = 0;
      let activeIntervals = 0;

      // Подсчитать статистику из всех битовых масок
      for (const [date, mask] of Object.entries(session.dailyMasks)) {
        totalIntervals += mask.length;
        activeIntervals += (mask.match(/1/g) || []).length;
      }

      const inactiveIntervals = totalIntervals - activeIntervals;
      const activityPercentage =
        totalIntervals > 0
          ? (activeIntervals / totalIntervals) * 100
          : 0;

      return {
        totalIntervals,
        activeIntervals,
        inactiveIntervals,
        activityPercentage,
      };
    } catch (error) {
      console.error(
        `[StorageManager] Failed to get session stats for ${pomodoroId}:`,
        error
      );
      return {
        totalIntervals: 0,
        activeIntervals: 0,
        inactiveIntervals: 0,
        activityPercentage: 0,
      };
    }
  }

  /**
   * Получить дневную статистику
   */
  async getDayStats(date: string): Promise<{
    sessionsCount: number;
    totalActiveMinutes: number;
    averageActivity: number;
  }> {
    try {
      const index = await this.loadIndex();
      return (
        index.dailyStats[date] || {
          sessionsCount: 0,
          totalActiveMinutes: 0,
          averageActivity: 0,
        }
      );
    } catch (error) {
      console.error(
        `[StorageManager] Failed to get day stats for ${date}:`,
        error
      );
      return {
        sessionsCount: 0,
        totalActiveMinutes: 0,
        averageActivity: 0,
      };
    }
  }

  /**
   * Получить настройки из SafeStore (интеграция с существующим store)
   */
  /**
   * Получить настройки (упрощенная версия)
   */
  getPomodoroSettings(): PomodoroSettings {
    return {
      trackingEnabled: true,
      activityThresholdSeconds: 180,
      intervalDurationMinutes: 5,
      showActivityIndicator: true,
      autoCreateSessions: true,
      saveDetailedLogs: false,
    };
  }

  /**
   * Сохранить настройки (пока просто логируем)
   */
  savePomodoroSettings(settings: Partial<PomodoroSettings>) {
    console.log("[StorageManager] Saving Pomodoro settings:", settings);
  }
}

// Экспорт singleton instance
export const storageManager = new PomodoroStorageManager();
export default storageManager;

// Экспорт типов для использования в других модулях
export type {
  PomodoroSession,
  PomodoroIndex,
  BitMaskData,
  PomodoroFilters,
};
