"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
function createLogger(name, options) {
    return (0, pino_1.default)({
        name,
        level: process.env.LOG_LEVEL ?? "info",
        transport: process.env.NODE_ENV === "production"
            ? undefined
            : {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    singleLine: true
                }
            },
        ...options
    });
}
//# sourceMappingURL=logger.js.map