"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReplaceService = createReplaceService;
function createReplaceService() {
    return {
        contains(input, findText) {
            return Boolean(findText) && input.includes(findText);
        },
        replace(input, from, to) {
            if (!from) {
                return input;
            }
            return input.split(from).join(to);
        }
    };
}
//# sourceMappingURL=replace.service.js.map