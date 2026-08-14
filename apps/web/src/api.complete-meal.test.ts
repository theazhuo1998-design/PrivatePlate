import { afterEach, describe, expect, it, vi } from "vitest";
import { completeMealAsPlanned } from "./api";

describe("completeMealAsPlanned web call path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("confirms meal completion on the current session, not dashboard-session", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "/api/households/hh-demo-001/meal-complete") {
        return new Response(
          JSON.stringify({
            status: "preview",
            actionType: "meal_completion",
            preview: {},
            confirmation: {
              pendingActionId: "pend-meal-1",
              confirmationToken: "tok-meal-1",
              payloadHash: "hash-meal-1",
              expiresAt: "2099-01-01T00:00:00.000Z"
            }
          }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url === "/api/pending-actions/pend-meal-1/confirm") {
        const headers = new Headers(init?.headers);
        expect(init?.method).toBe("POST");
        expect(headers.get("X-PrivatePlate-Session")).toBe("sess-web-eat");
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          sessionId?: string;
        };
        expect(body.sessionId).toBe("sess-web-eat");
        expect(body.sessionId).not.toBe("dashboard-session");
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await completeMealAsPlanned({
      householdId: "hh-demo-001",
      planId: "plan-1",
      sessionId: "sess-web-eat"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "/api/pending-actions/pend-meal-1/confirm"
    );
  });
});
