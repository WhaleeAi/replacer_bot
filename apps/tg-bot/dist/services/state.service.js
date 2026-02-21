"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStateService = createStateService;
function createStateService() {
    const authorizedUsers = new Map();
    const pendingAuthUsers = new Map();
    const redPostsState = new Map();
    const addPackState = new Map();
    const redCommentsState = new Map();
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
//# sourceMappingURL=state.service.js.map