export interface RateLimitService {
    wait(): Promise<void>;
}
export declare function createRateLimitService(rps: number): RateLimitService;
