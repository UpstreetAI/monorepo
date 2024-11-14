import PinoLogger from "./logger-pino.mjs";
import WinstonLogger
 from "./logger-winston.mjs";

class LoggerFactory {
    static getLogger() {
      return new PinoLogger();
    }
  }

export default LoggerFactory;