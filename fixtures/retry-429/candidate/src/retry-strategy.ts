export interface RetryStrategy {
    retry(status: number): boolean;
}

export class DefaultRetryStrategy implements RetryStrategy {
    retry(status: number): boolean {
        return status === 429 || status >= 500;
    }
}