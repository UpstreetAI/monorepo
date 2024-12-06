import winston from 'winston';
import path from 'path';
import { Logger } from './logger-interface.mjs';
import { getLogDirectory } from '../path/index.mjs';

class WinstonLogger extends Logger {
  constructor() {
    super();
    const currentDateTime = new Date().toISOString().replace(/[:.]/g, '-');
    const currentModuleDir = getLogDirectory();
    const logFilePath = path.join(currentModuleDir, `log-${currentDateTime}.log`);

    this.logger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.File({ filename: logFilePath, name: 'error-file', level: 'info'}),
        new winston.transports.Console()
      ]
    });

    // console.log('logFilePath: ', logFilePath);
  }

  info(...args) {
    this.logger.info(...args);
  }

  warn(...args) {
    this.logger.warn(...args);
  }

  error(...args) {
    // const message = args.join(' ');
    // const stack = new Error().stack;

    // // Only bypass Winston if it's specifically the update notification
    // // update-notifier uses console.error to log the message
    // if (stack.includes('update-notifier') && 
    //   (message.includes('Update available') || message.includes('╭─'))) {
    //   return;
    // }
    this.logger.error(...args);
  }
}

export default WinstonLogger;