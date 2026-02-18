"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStateService = createStateService;
function createStateService() {
    const authorizedUsers = new Map();
    const pendingAuthUsers = new Map();
    const redPostsState = new Map();
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
//# sourceMappingURL=state.service.js.map