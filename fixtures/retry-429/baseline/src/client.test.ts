import { describe, expect, it } from "vitest";
import { request } from "./client.js";

describe("request", () => {
    it("retries server errors", () => {
        expect(request(500)).toBe(true);
    });
});