import { shouldRetry } from "./retry-policy.js";

export const request = (status: number) => shouldRetry(status);