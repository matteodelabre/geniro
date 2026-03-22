import { adminEmail, adminName } from "../config.ts";
import { setTimeout } from "node:timers/promises";

const lastRequestTime: Record<string, number> = {};
const minRequestDelay = 1500;
const maxAttempts = 3;
const defaultHeaders = {
    "User-Agent": `${adminName} (<${adminEmail}>)`,
    "From": adminEmail,
};

type Method = "GET" | "POST";

export const query = async (
    method: Method,
    url: URL | string,
    params: Record<string, string> | undefined = undefined,
    headers: object = {},
) => {
    let body;
    url = new URL(url);

    if (params !== undefined) {
        if (method === "POST") {
            body = new URLSearchParams(params);
        } else {
            // @ts-ignore Assignment is supported even though `url.search` is a string
            url.search = new URLSearchParams(params);
        }
    }

    if (url.host in lastRequestTime) {
        const elapsed = Date.now() - lastRequestTime[url.host];

        if (elapsed < minRequestDelay) {
            await setTimeout(minRequestDelay - elapsed);
        }
    }

    let attempt = 0;

    while (true) {
        try {
            lastRequestTime[url.host] = Date.now();
            const attemptLog = attempt > 0 ? ` (retry ${attempt})` : "";
            console.log(`[${Date.now()}] ${method} ${url.toString()}${attemptLog}`);

            return await fetch(url, {
                method,
                body,
                headers: { ...headers, ...defaultHeaders },
            });
        } catch (err) {
            attempt += 1;

            if (attempt == maxAttempts) {
                throw err;
            }

            await setTimeout(minRequestDelay);
        }
    }
};
