export type RedPostsStep = "await_token" | "await_links" | "await_find" | "await_replace";
export interface RedPostsDialogState {
    step: RedPostsStep;
    rawLinks: string[];
    groupIds: number[];
    findText: string;
    vkAccessToken: string;
    skippedLinks: string[];
}
export interface StateService {
    authorize(userId: number): void;
    isAuthorized(userId: number): boolean;
    requestAuth(userId: number): void;
    isAuthRequested(userId: number): boolean;
    clearAuthRequest(userId: number): void;
    getRedPostsState(userId: number): RedPostsDialogState | undefined;
    setRedPostsState(userId: number, state: RedPostsDialogState): void;
    clearRedPostsState(userId: number): void;
}
export declare function createStateService(): StateService;
