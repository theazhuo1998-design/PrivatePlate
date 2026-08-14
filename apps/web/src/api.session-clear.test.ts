import { afterEach, describe, expect, it, vi } from "vitest";
import { resetDemo, resetSession, sessionClearUrl } from "./api";

describe("session clear URL", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds POST /api/agent/sessions/:id/clear", () => {
    expect(sessionClearUrl("sess-abc")).toBe(
      "/api/agent/sessions/sess-abc/clear"
    );
  });

  it("resetSession posts to sessionClearUrl and does not call demo reset", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe("/api/agent/sessions/sess-web/clear");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("X-PrivatePlate-Session")).toBe("sess-web");
      return new Response(JSON.stringify({ ok: true, sessionId: "sess-web" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await resetSession("sess-web");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(
      /\/api\/demo\/reset|\/api\/session\/reset/
    );
  });

  it("deprecated resetDemo still clears the Agent session only", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ ok: true, sessionId: "sess-web" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    await resetDemo("sess-web");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/agent/sessions/sess-web/clear"
    );
  });
});
