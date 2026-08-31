import { DefaultRetryStrategy } from "./retry-strategy.js";

const retry = new DefaultRetryStrategy();

export const request = (status: number) => retry.retry(status);