export type RedPostsStep = "await_token" | "await_links" | "await_find" | "await_replace";
export type AddPackStep = "await_name" | "await_links";
export type RedCommentsStep =
  | "await_token"
  | "await_links"
  | "await_post_fragment"
  | "await_old_comment_fragment"
  | "await_new_comment_text";

export interface RedPostsDialogState {
  step: RedPostsStep;
  rawLinks: string[];
  groupIds: number[];
  findText: string;
  vkAccessToken: string;
  skippedLinks: string[];
}

export interface AddPackDialogState {
  step: AddPackStep;
  name: string;
}

export interface RedCommentsDialogState {
  step: RedCommentsStep;
  groupIds: number[];
  vkAccessToken: string;
  postTextFragment: string;
  oldCommentFragment: string;
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
  getAddPackState(userId: number): AddPackDialogState | undefined;
  setAddPackState(userId: number, state: AddPackDialogState): void;
  clearAddPackState(userId: number): void;
  getRedCommentsState(userId: number): RedCommentsDialogState | undefined;
  setRedCommentsState(userId: number, state: RedCommentsDialogState): void;
  clearRedCommentsState(userId: number): void;
}

export function createStateService(): StateService {
  const authorizedUsers = new Map<number, true>();
  const pendingAuthUsers = new Map<number, true>();
  const redPostsState = new Map<number, RedPostsDialogState>();
  const addPackState = new Map<number, AddPackDialogState>();
  const redCommentsState = new Map<number, RedCommentsDialogState>();

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
    },
    getAddPackState(userId) {
      return addPackState.get(userId);
    },
    setAddPackState(userId, state) {
      addPackState.set(userId, state);
    },
    clearAddPackState(userId) {
      addPackState.delete(userId);
    },
    getRedCommentsState(userId) {
      return redCommentsState.get(userId);
    },
    setRedCommentsState(userId, state) {
      redCommentsState.set(userId, state);
    },
    clearRedCommentsState(userId) {
      redCommentsState.delete(userId);
    }
  };
}
