"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = sendMessage;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function sendMessage(chatId, text) {
    const token = process.env.TG_BOT_TOKEN ?? "";
    if (!token) {
        throw new Error("TG_BOT_TOKEN is empty");
    }
    const maxAttempts = 3;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text
                }),
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) {
                throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
            }
            return;
        }
        catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(300 * 2 ** (attempt - 1));
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Telegram sendMessage failed");
}
//# sourceMappingURL=telegram.service.js.map