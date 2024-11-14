// pino-logger.mjs
import pino from 'pino';
import { getLogDirectory } from '../path/index.mjs';
import path from 'path';
import { Logger } from './logger-interface.mjs';


class PinoLogger extends Logger{
    static instance = null;

    constructor() {
        super();
        if (PinoLogger.instance) {
            return PinoLogger.instance;
        }
        const currentDateTime = new Date().toISOString().replace(/[:.]/g, '-');
        const currentModuleDir = getLogDirectory();
        this.logFilePath = path.join(currentModuleDir, `log-${currentDateTime}.log`);

        const transport = pino.transport({
            targets: [
                {
                    target: 'pino-pretty',
                    options: {
                        destination: this.logFilePath,
                        colorize: false,
                        translateTime: 'SYS:standard',
                        ignore: 'pid,hostname',
                        singleLine: false,
                    }
                }
            ],
        });

        this.logger = pino({
            level: process.env.LOG_LEVEL || 'info',
            timestamp: pino.stdTimeFunctions.isoTime,
            formatters: {
                level: (label) => {
                    return { level: label.toUpperCase() };
                }
            },
        }, transport);
        PinoLogger.instance = this;
    }

    info(message, ...args) {
        this.logger.info(message, ...args);
    }

    error(message, error = null) {
        if (error) {
            this.logger.error({ err: error }, message);
        } else {
            this.logger.error(message);
        }
    }

    warn(message, ...args) {
        this.logger.warn(message, ...args);
    }

    debug(message, ...args) {
        this.logger.debug(message, ...args);
    }

    getChildLogger(bindings) {
        return this.logger.child(bindings);
    }

    getLogFilePath() {
        return this.logFilePath;
    }
}

export default PinoLogger;