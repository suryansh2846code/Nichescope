import { WorkerLog } from "../models/WorkerLog";

export function setupWorkerLogger(workerName: string) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const formatMessage = (args: any[]) => {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
  };

  console.log = (...args: any[]) => {
    originalLog(...args);
    const message = formatMessage(args);
    if (message.trim()) {
      WorkerLog.create({
        workerName,
        message,
        level: "info",
        timestamp: new Date(),
      }).catch(() => {});
    }
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    const message = formatMessage(args);
    if (message.trim()) {
      WorkerLog.create({
        workerName,
        message,
        level: "error",
        timestamp: new Date(),
      }).catch(() => {});
    }
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    const message = formatMessage(args);
    if (message.trim()) {
      WorkerLog.create({
        workerName,
        message,
        level: "warn",
        timestamp: new Date(),
      }).catch(() => {});
    }
  };
}
