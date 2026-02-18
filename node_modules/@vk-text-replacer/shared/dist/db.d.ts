import type { Logger } from "pino";
export declare function ensureDatabaseSchema(databaseUrl: string, logger?: Logger): Promise<void>;
