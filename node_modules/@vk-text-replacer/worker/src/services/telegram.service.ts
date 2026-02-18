function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN ?? "";
  if (!token) {
    throw new Error("TG_BOT_TOKEN is empty");
  }

  const maxAttempts = 3;
  let lastError: unknown;

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
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(300 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Telegram sendMessage failed");
}
