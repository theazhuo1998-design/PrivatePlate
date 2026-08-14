import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp, createAppContext, type AppContext } from "./app.js";
import { mockAgentTestConfig } from "./runtime-config.js";

const TASK_CARD = {
  planId: "plan-inbox-test",
  planVersion: 1,
  recipientLabel: "家庭保姆",
  serveAt: "今天 12:00",
  menu: [{ templateId: "tpl-cabbage-tofu-braise", displayName: "白菜豆腐煲" }],
  useFromInventory: [],
  shoppingItems: [],
  executionNotes: ["全餐少盐"],
  disclosurePolicyVersion: "min-disclosure-v1"
};

describe("GET /api/caregiver-inbox product display", () => {
  let app: Express;
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createAppContext({ config: mockAgentTestConfig() });
    app = createApp(ctx);
  });

  afterAll(() => {
    ctx.domain.close();
  });

  it("uses local task-board fields and does not claim an external send", async () => {
    ctx.domain.db
      .prepare(
        `INSERT INTO caregiver_tasks
         (id, household_id, plan_id, plan_version, recipient_label, task_card_json, channel, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'simulated_local_inbox', 'queued', ?)`
      )
      .run(
        "task-inbox-display",
        ctx.domain.householdId,
        "plan-inbox-test",
        1,
        "家庭保姆",
        JSON.stringify(TASK_CARD),
        new Date().toISOString()
      );

    const response = await request(app).get("/api/caregiver-inbox");
    expect(response.status).toBe(200);
    expect(response.body.channel).toBe("local_task_board");
    expect(response.body.simulated).toBe(true);
    expect(response.body.appMode).toBe("demo");
    expect(response.body.capability).toBe("尚未连接家庭消息渠道");
    expect(response.body.saveMessage).toBe("已保存到本地演示数据库");
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].channel).toBe("local_task_board");
    expect(response.body.items[0].taskCard.executionNotes).toEqual(["全餐少盐"]);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/simulated_local_inbox/);
    expect(serialized).not.toMatch(/模拟信箱|模拟收件箱/);
    expect(serialized).not.toMatch(/已发送|消息已送达|收件人已收到/);
  });

  it("uses household-space save copy in reviewer mode", async () => {
    const production = await createAppContext({
      config: mockAgentTestConfig({
        appMode: "production",
        accessToken: "production-test-token"
      })
    });
    try {
      const productionApp = createApp(production);
      const response = await request(productionApp)
        .get("/api/caregiver-inbox")
        .auth("privateplate", "production-test-token");
      expect(response.status).toBe(200);
      expect(response.body.saveMessage).toBe("已保存到当前家庭空间");
      expect(response.body.capability).toBe("尚未连接家庭消息渠道");
      expect(response.body.channel).toBe("local_task_board");
    } finally {
      production.domain.close();
    }
  });
});
