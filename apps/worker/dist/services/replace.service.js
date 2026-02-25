"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReplaceService = createReplaceService;
function escapeRegex(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildWholeMatchRegex(fragment) {
    if (!fragment) {
        return null;
    }
    const escaped = escapeRegex(fragment);
    // Match only when the full fragment is not glued to letters/digits/underscore.
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu");
}
function createReplaceService() {
    return {
        contains(input, findText) {
            const pattern = buildWholeMatchRegex(findText);
            return pattern ? pattern.test(input) : false;
        },
        replace(input, from, to) {
            const pattern = buildWholeMatchRegex(from);
            if (!pattern) {
                return input;
            }
            return input.replace(pattern, to);
        }
    };
}
//# sourceMappingURL=replace.service.js.map