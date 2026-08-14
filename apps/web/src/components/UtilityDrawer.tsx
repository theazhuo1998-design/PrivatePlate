import { useEffect, useRef, useState } from "react";
import type { DayContext, HouseholdContext, RuntimeStatus, UiOnly } from "../api";
import {
  foodName,
  formatGrams,
  ROLE_NAMES
} from "../formatters";
import { isSharedSafeCue, INPUT_SOURCE_FRIDGE_SIM } from "../device-surface";
import { householdCueLines } from "../hub-loop";
import type { InboxSnapshot } from "../types";
import {
  CAPABILITY_LINE,
  COPY_TASK_LABEL,
  COPIED,
  SHARE_OPENED,
  SHARE_TASK_LABEL,
  TASK_BOARD_LABEL,
  canWebShare,
  copyTaskText,
  formatTaskCardPlainText,
  shareTaskText
} from "../task-board";
import {
  appModeLabel,
  modelStatusLabel,
  ragStatusLabel,
  storageClassLabel,
  MODEL_OFFLINE_RECOVERY
} from "../runtime-copy";
import type { DrawerTarget } from "./Sidebar";
import { InventoryImageIntake } from "./InventoryImageIntake";
import { SourceIcon } from "./SourceIcon";

type UtilityView = Exclude<DrawerTarget, "plan">;

type UtilityDrawerProps = {
  view: UtilityView;
  context: HouseholdContext | null;
  dayContext: DayContext | null;
  inbox: InboxSnapshot | null;
  busy: boolean;
  confirmationPending: boolean;
  operable: boolean;
  uiOnly: UiOnly | null;
  runtime: RuntimeStatus | null;
  onClose: () => void;
  onRefresh: () => void;
  onSendToAgent: (text: string) => void;
  onConfirm: () => void;
  onCancelPending: () => void;
};

export function UtilityDrawer({
  view,
  context,
  dayContext,
  inbox,
  busy,
  confirmationPending,
  operable,
  uiOnly,
  runtime,
  onClose,
  onRefresh,
  onSendToAgent,
  onConfirm,
  onCancelPending
}: UtilityDrawerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [view]);

  return (
    <aside className="utility-drawer" aria-label={viewTitle(view)}>
      <div className="drawer-header">
        <div>
          <p className="eyebrow">家庭空间</p>
          <h2>{viewTitle(view)}</h2>
        </div>
        <button
          className="drawer-close"
          type="button"
          ref={closeRef}
          onClick={onClose}
        >
          收起
        </button>
      </div>

      <div className="drawer-scroll">
        {view === "members" ? (
          <MembersView
            context={context}
            dayContext={dayContext}
            uiOnly={uiOnly}
            busy={busy}
            onConfirm={onConfirm}
            onCancelPending={onCancelPending}
          />
        ) : null}
        {view === "inventory" ? (
          <InventoryView
            context={context}
            busy={busy}
            confirmationPending={confirmationPending}
            operable={operable}
            uiOnly={uiOnly}
            onSendToAgent={onSendToAgent}
            onConfirm={onConfirm}
            onCancelPending={onCancelPending}
          />
        ) : null}
        {view === "inbox" ? <InboxView inbox={inbox} /> : null}
        {view === "settings" ? (
          <SettingsView runtime={runtime} onRefresh={onRefresh} />
        ) : null}
      </div>
    </aside>
  );
}

function MembersView({
  context,
  dayContext,
  uiOnly,
  busy,
  onConfirm,
  onCancelPending
}: {
  context: HouseholdContext | null;
  dayContext: DayContext | null;
  uiOnly: UiOnly | null;
  busy: boolean;
  onConfirm: () => void;
  onCancelPending: () => void;
}) {
  const memoryPreview =
    uiOnly?.actionType === "member_memory_change" ? uiOnly : null;

  if ((!context || context.members.length === 0) && !memoryPreview) {
    return <EmptyDrawerState text="还没有家庭成员资料。" />;
  }

  return (
    <div className="utility-content">
      {memoryPreview ? (
        <MemberMemoryPreviewCard
          uiOnly={memoryPreview}
          busy={busy}
          onConfirm={onConfirm}
          onCancelPending={onCancelPending}
        />
      ) : null}
      <p className="drawer-intro">
        这里保存每个人的用餐偏好。需要安排本餐时，可以直接在对话上方选择成员。
      </p>
      {context && context.members.length > 0 ? (
        <div className="member-detail-list">
          {context.members.map((member) => {
            const cues = memberDrawerCues(member.id, context, dayContext);
            return (
            <article className="member-detail" key={member.id}>
              <div className="member-detail-avatar">
                {member.displayName.slice(0, 1)}
              </div>
              <div className="member-detail-main">
                <div className="member-detail-title">
                  <strong>{member.displayName}</strong>
                  <span>{ROLE_NAMES[member.roleLabel] ?? "家庭成员"}</span>
                </div>
                {cues.length > 0 ? (
                  <div className="tag-row">
                    {cues.map((cue) => (
                      <span className="soft-tag" key={cue}>
                        {cue}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted compact-line">暂无额外执行提示</span>
                )}
              </div>
            </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function InventoryView({
  context,
  busy,
  confirmationPending,
  operable,
  uiOnly,
  onSendToAgent,
  onConfirm,
  onCancelPending
}: {
  context: HouseholdContext | null;
  busy: boolean;
  confirmationPending: boolean;
  operable: boolean;
  uiOnly: UiOnly | null;
  onSendToAgent: (text: string) => void;
  onConfirm: () => void;
  onCancelPending: () => void;
}) {
  const inventory = context?.inventory ?? [];
  const restockPreview =
    uiOnly?.actionType === "inventory_restock" ? uiOnly : null;

  return (
    <div className="utility-content">
      {restockPreview ? (
        <InventoryRestockPreviewCard
          uiOnly={restockPreview}
          busy={busy}
          onConfirm={onConfirm}
          onCancelPending={onCancelPending}
        />
      ) : (
        <p className="drawer-intro">
          {INPUT_SOURCE_FRIDGE_SIM}。只在打开库存时查看详情；本餐规划会优先考虑快到期和需要优先消耗的食材。
        </p>
      )}
      {inventory.length > 0 ? (
        <div className="inventory-detail-list">
          {inventory.map((item) => (
            <div className="inventory-detail-row" key={item.id}>
              <div>
                <strong>{foodName(item.foodId)}</strong>
                {item.priorityConsume ? (
                  <span className="soft-tag accent-tag">优先吃</span>
                ) : null}
              </div>
              <span className="muted">
                {item.quantity.normalized.estimateG != null
                  ? `${formatGrams(item.quantity.normalized.estimateG)} g`
                  : item.quantity.rawExpression}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyDrawerState text="当前还没有可用库存。" />
      )}
      <InventoryImageIntake
        busy={busy}
        confirmationPending={confirmationPending}
        operable={operable}
        onSendToAgent={onSendToAgent}
      />
    </div>
  );
}

function InventoryRestockPreviewCard({
  uiOnly,
  busy,
  onConfirm,
  onCancelPending
}: {
  uiOnly: UiOnly;
  busy: boolean;
  onConfirm: () => void;
  onCancelPending: () => void;
}) {
  const preview = asRecord(uiOnly.preview);
  const foodId = stringField(preview, "foodId");
  const label =
    stringField(preview, "foodName") ||
    (foodId ? foodName(foodId) : "食材");
  const rawExpression = stringField(preview, "rawExpression");
  const deltaG = numberField(preview, "deltaG");
  const beforeG = numberField(preview, "beforeEstimateG");
  const afterG = numberField(preview, "afterEstimateG");
  const note = stringField(preview, "note") || "确认入库前不会修改库存。";
  const confirmLabel = uiOnly.confirmLabel || "确认入库";

  return (
    <section className="inventory-preview-card" aria-label="入库预览">
      <div className="inventory-preview-head">
        <div>
          <strong>入库预览</strong>
          <span className="soft-tag accent-tag">待确认</span>
        </div>
        <p className="muted compact-line">{note}</p>
      </div>
      <div className="inventory-preview-item">
        <strong>{label}</strong>
        <span>{rawExpression || "数量见下方变化"}</span>
      </div>
      <div className="inventory-preview-facts">
        <div>
          <span>确认前</span>
          <strong>{beforeG == null ? "—" : `${formatGrams(beforeG)}g`}</strong>
        </div>
        <div>
          <span>确认后</span>
          <strong>{afterG == null ? "—" : `${formatGrams(afterG)}g`}</strong>
        </div>
        <div>
          <span>增量</span>
          <strong>{deltaG == null ? "—" : `+${formatGrams(deltaG)}g`}</strong>
        </div>
      </div>
      <div className="inventory-preview-actions">
        <button
          className="drawer-confirm-button"
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          <SourceIcon name="check" size={18} />
          <span>{confirmLabel}</span>
        </button>
        <button
          className="drawer-adjust-button"
          type="button"
          disabled={busy}
          onClick={onCancelPending}
        >
          先不写入
        </button>
      </div>
      <p className="muted compact-line">
        下方列表仍是当前真实库存；只有点确认后数字才会变化。
      </p>
    </section>
  );
}

function MemberMemoryPreviewCard({
  uiOnly,
  busy,
  onConfirm,
  onCancelPending
}: {
  uiOnly: UiOnly;
  busy: boolean;
  onConfirm: () => void;
  onCancelPending: () => void;
}) {
  const preview = asRecord(uiOnly.preview);
  const memberName = stringField(preview, "memberName") || "家庭成员";
  const kind = stringField(preview, "kind");
  const rawSummary = stringField(preview, "summary") || "资料变更";
  const summary = isSharedSafeCue(rawSummary) ? rawSummary : "已记录一项用餐约束";
  const polarity = stringField(preview, "polarity");
  const note = stringField(preview, "note") || "确认保存前不会改写家庭资料。";
  const confirmLabel = uiOnly.confirmLabel || "确认保存家庭资料";
  const kindLabel =
    kind === "preference" ? "偏好" : "用餐资料";

  return (
    <section className="inventory-preview-card" aria-label="家庭资料预览">
      <div className="inventory-preview-head">
        <div>
          <strong>资料预览</strong>
          <span className="soft-tag accent-tag">待确认</span>
        </div>
        <p className="muted compact-line">{note}</p>
      </div>
      <div className="inventory-preview-item">
        <strong>{memberName} · {kindLabel}</strong>
        <span>{summary}</span>
        {polarity ? <span>极性：{polarity}</span> : null}
      </div>
      <div className="inventory-preview-actions">
        <button
          className="drawer-confirm-button"
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          <SourceIcon name="check" size={18} />
          <span>{confirmLabel}</span>
        </button>
        <button
          className="drawer-adjust-button"
          type="button"
          disabled={busy}
          onClick={onCancelPending}
        >
          取消
        </button>
      </div>
    </section>
  );
}

function InboxView({ inbox }: { inbox: InboxSnapshot | null }) {
  const items = inbox?.items ?? [];
  const shareSupported = canWebShare();
  const [actionNote, setActionNote] = useState<string | null>(null);

  async function onCopy(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const result = await copyTaskText(formatTaskCardPlainText(item.taskCard));
    setActionNote(
      result === "copied" ? COPIED : "复制失败，请手动选择任务内容。"
    );
  }

  async function onShare(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const result = await shareTaskText(formatTaskCardPlainText(item.taskCard));
    if (result === "opened") {
      setActionNote(SHARE_OPENED);
      return;
    }
    if (result === "unsupported") {
      setActionNote("当前浏览器不支持系统分享。");
      return;
    }
    setActionNote("无法打开系统分享面板。");
  }

  return (
    <div className="utility-content">
      <div className="inbox-intro-card">
        <span className="inbox-mark" aria-hidden="true" />
        <div>
          <strong>{TASK_BOARD_LABEL}</strong>
          <p className="inbox-capability">{inbox?.capability ?? CAPABILITY_LINE}</p>
          <p>确认本餐安排后，任务会保存在这里，不会走外部消息渠道。</p>
        </div>
      </div>
      {actionNote ? (
        <p className="inbox-action-note" role="status">
          {actionNote}
        </p>
      ) : null}
      {items.length === 0 ? (
        <EmptyDrawerState text="确认本餐安排后，任务会出现在这里。" />
      ) : (
        <div className="inbox-detail-list">
          {items.map((item) => (
            <article className="inbox-detail-item" key={item.id}>
              <div className="inbox-item-topline">
                <strong>{item.recipient_label}</strong>
                <span className="soft-tag">
                  {item.status === "sent" || item.status === "queued"
                    ? "待执行"
                    : item.status}
                </span>
              </div>
              {item.taskCard.serveAt && item.taskCard.serveAt !== "unspecified" ? (
                <p>开饭 {item.taskCard.serveAt}</p>
              ) : null}
              <p>
                {item.taskCard.menu.map((menuItem) => menuItem.displayName).join("、")}
              </p>
              {item.taskCard.shoppingItems.length > 0 ? (
                <div className="inbox-shopping-note">
                  采购 {item.taskCard.shoppingItems.map((shoppingItem) => foodName(shoppingItem.foodId)).join("、")}
                </div>
              ) : (
                <div className="inbox-shopping-note">无需额外采购</div>
              )}
              {item.taskCard.executionNotes?.length > 0 ? (
                <ul className="inbox-execution-notes">
                  {item.taskCard.executionNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              <div className="inbox-task-actions">
                <button type="button" onClick={() => void onCopy(item.id)}>
                  {COPY_TASK_LABEL}
                </button>
                {shareSupported ? (
                  <button type="button" onClick={() => void onShare(item.id)}>
                    {SHARE_TASK_LABEL}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({
  runtime,
  onRefresh
}: {
  runtime: RuntimeStatus | null;
  onRefresh: () => void;
}) {
  const model = modelStatusLabel(runtime);
  const rag = ragStatusLabel(runtime);
  const mode = appModeLabel(runtime?.appMode);
  const storage = storageClassLabel(runtime?.databaseStorageClass);

  return (
    <div className="utility-content settings-content">
      <p className="drawer-intro">
        运行状态来自当前本机进程。相机和麦克风来自当前浏览器，不是家电传感器。
      </p>
      <div className="settings-list">
        <div className="settings-row">
          <div>
            <strong>家庭空间</strong>
            <span>小林一家</span>
          </div>
          <span className="settings-state">{mode}</span>
        </div>
        <div className="settings-row">
          <div>
            <strong>Agent 模型</strong>
            <span>{model.detail}</span>
          </div>
          <span
            className={`settings-state ${model.ready ? "is-on" : "is-off"}`}
          >
            {model.state}
          </span>
        </div>
        <div className="settings-row">
          <div>
            <strong>本地 RAG</strong>
            <span>{rag.detail}</span>
          </div>
          <span className={`settings-state ${rag.ready ? "is-on" : "is-off"}`}>
            {rag.state}
          </span>
        </div>
        <div className="settings-row">
          <div>
            <strong>相机 / 麦克风</strong>
            <span>来自当前浏览器</span>
          </div>
          <span className="settings-state">当前浏览器</span>
        </div>
        <div className="settings-row">
          <div>
            <strong>数据库</strong>
            <span>{storage}</span>
          </div>
          <span className="settings-state">
            {runtime?.databaseStorageClass == null
              ? "—"
              : runtime.databaseStorageClass === "memory"
                ? "memory"
                : "local_sqlite_file"}
          </span>
        </div>
        <div className="settings-row">
          <div>
            <strong>安全确认</strong>
            <span>保存前始终需要你确认</span>
          </div>
          <span className="settings-state is-on">开启</span>
        </div>
      </div>
      <p className="settings-boundary">
        {runtime?.capabilityBoundary ??
          "未接入冰箱门控、温度、唤醒词或真实家电 API；任务不会发到外部消息渠道。"}
      </p>
      {!model.ready && runtime ? (
        <p className="settings-recovery" role="status">
          {MODEL_OFFLINE_RECOVERY}
        </p>
      ) : null}
      <button className="secondary drawer-refresh-button" type="button" onClick={onRefresh}>
        刷新家庭状态
      </button>
    </div>
  );
}

function EmptyDrawerState({ text }: { text: string }) {
  return <p className="drawer-empty">{text}</p>;
}

function viewTitle(view: UtilityView): string {
  if (view === "members") return "家庭成员";
  if (view === "inventory") return "库存";
  if (view === "inbox") return TASK_BOARD_LABEL;
  return "设置";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function memberDrawerCues(
  memberId: string,
  context: HouseholdContext,
  dayContext: DayContext | null
): string[] {
  const lookup = new Map(
    context.members.map((member) => [member.id, member.displayName])
  );
  const line = householdCueLines(dayContext, context, lookup).find((item) =>
    item.startsWith(`${lookup.get(memberId) ?? ""}：`)
  );
  if (line) {
    const [, cues] = line.split("：");
    return (cues ?? "")
      .split("、")
      .map((cue) => cue.trim())
      .filter(isSharedSafeCue);
  }
  return context.constraints
    .filter(
      (constraint) =>
        constraint.memberId === memberId && constraint.kind === "avoid_ingredient"
    )
    .map((constraint) => `避${foodName(constraint.targetId)}`)
    .filter(isSharedSafeCue);
}
