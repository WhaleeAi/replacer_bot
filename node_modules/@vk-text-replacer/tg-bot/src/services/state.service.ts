export type RedPostsStep = "await_links" | "await_find" | "await_replace";

export interface RedPostsDialogState {
  step: RedPostsStep;
  rawLinks: string[];
  groupIds: number[];
  findText: string;
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

export function createStateService(): StateService {
  const authorizedUsers = new Map<number, true>();
  const pendingAuthUsers = new Map<number, true>();
  const redPostsState = new Map<number, RedPostsDialogState>();

  return {
    authorize(userId) {
      authorizedUsers.set(userId, true);
      pendingAuthUsers.delete(userId);
    },
    isAuthorized(userId) {
      return authorizedUsers.has(userId);
    },
    requestAuth(userId) {
      pendingAuthUsers.set(userId, true);
    },
    isAuthRequested(userId) {
      return pendingAuthUsers.has(userId);
    },
    clearAuthRequest(userId) {
      pendingAuthUsers.delete(userId);
    },
    getRedPostsState(userId) {
      return redPostsState.get(userId);
    },
    setRedPostsState(userId, state) {
      redPostsState.set(userId, state);
    },
    clearRedPostsState(userId) {
      redPostsState.delete(userId);
    }
  };
}
