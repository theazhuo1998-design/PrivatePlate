# PrivatePlate

> 面向智能冰箱与家庭中枢的隐私优先家庭饮食智能体。
>
> **让一家人少操心一顿饭，而不是多维护一个健康面板。**

PrivatePlate 是一个以对话为入口的家庭饮食协调 Agent。家庭成员只需要告诉它今天谁吃饭、哪些食材想优先消耗、有什么忌口或临时变化，Agent 会结合家庭长期偏好、库存、饮食约束和当天已经吃过的内容，在后台完成规划、调整和记录，最终给出可以直接执行的家庭餐方案。

它不是一个“问一句、答一句”的营养聊天机器人。PrivatePlate 把模糊意图交给大模型理解，把事实、计算、硬约束和有副作用的写入交给确定性工具处理，并通过 **计划 → 确认 → 记录 → 复盘** 形成可验证的任务闭环。

## 它解决什么问题

家庭吃饭看起来是一个小问题，实际每天都在叠加很多零碎决策：

- 今天有谁在家吃饭？
- 冰箱里什么快过期了？
- 家人有哪些长期忌口、过敏或偏好？
- 午饭已经吃了什么，晚饭还应该怎么搭？
- 临时有人不回来，原计划要不要重算？
- 哪些事情可以自动做，哪些必须先让用户确认？

PrivatePlate 的目标不是让用户盯着营养数字生活，而是把这些约束藏到后台，让家庭成员只处理真正需要做决定的那一步。

## 当前可运行原型

- **多轮家庭饮食对话**：支持规划、追问、修改和重新规划。
- **长期家庭记忆**：用户确认后的偏好和健康事实写入 SQLite；开启新对话后仍可继续生效，而不是依赖聊天历史“记住”。
- **硬约束优先**：过敏、禁忌等约束由确定性领域层执行，不交给 LLM 自由发挥。
- **跨餐次日账本**：结合当天已经完成的餐次和剩余预算继续规划。
- **库存与家庭任务**：读取库存，并通过受控工具生成补货或家庭任务。
- **Preview → Confirm → Commit**：长期记忆、库存修改、完成记录等持久化副作用必须先预览并由用户确认。
- **本地 RAG**：可接入本地 embedding 服务和小型知识库，为 Agent 提供项目内知识增强。
- **多模态输入**：浏览器支持麦克风和冰箱照片输入，识别结果先进入可编辑草稿，不直接写入家庭状态。
- **可复现评测**：包含针对工具选择、参数、隐私边界和生命周期安全的脚本化测试。

## 一次完整闭环

```text
用户：今晚爸爸也回来吃饭，鸡蛋别给他吃，顺便把豆腐用掉。
                    │
                    ▼
             Agent 理解意图
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
读取家庭状态 / 库存         读取长期偏好 / 约束
        │                       │
        └───────────┬───────────┘
                    ▼
       确定性领域层筛选并计算候选方案
                    │
                    ▼
              返回可执行餐单
                    │
          用户确认需要持久化的变化
                    ▼
      写入记忆 / 库存 / 完成记录 / 家庭任务
```

如果用户在上一段对话中确认“爸爸不能吃鸡蛋”，这一信息会进入家庭持久化状态。即使清空当前会话或开启新的会话，后续规划仍会重新读取这条约束并排除含鸡蛋的候选方案。

## 为什么采用 Agent + 确定性领域层

PrivatePlate 没有让大模型直接决定所有事情。

**LLM 负责：**

- 理解自然语言和上下文
- 判断用户当前想完成什么任务
- 选择合适工具并组织多轮流程
- 把确定性结果转换成自然的用户表达

**确定性领域层负责：**

- 家庭成员、库存和当天状态的真实数据
- 营养和数量计算
- 硬性饮食约束
- 候选菜品过滤
- 持久化写入
- 确认与权限边界

这样做的目的不是削弱模型，而是让模型把精力放在它擅长的“理解和编排”上，同时让不可出错的事实和副作用保持可验证。

## 架构

```text
浏览器对话界面
      │ HTTP + SSE
      ▼
Express Server
      │
      ▼
PrivatePlate Agent Runtime ───── OpenAI-compatible Chat Model
      │                              on loopback
      │
      ├── Typed Tools
      ├── Confirmation Boundary
      │
      ▼
Deterministic Domain Service
      │
      ├── SQLite / Household Memory
      ├── Inventory / Day Ledger
      ├── Planning / Nutrition Rules
      │
      └── Local RAG Embedding Endpoint (optional)
```

浏览器只接收经过裁剪的展示数据。更详细的健康标签和营养规划输入留在服务端领域层，不直接暴露到家庭共享屏幕。

## 隐私与本地部署

PrivatePlate 采用 local-first 的设计思路，但“本地地址”不等于天然“完全本地”。

应用只接受 loopback 模型地址，例如：

- Chat Model：`127.0.0.1:8000`
- Embedding Model：`127.0.0.1:8001`

只有当聊天模型、embedding 模型、PrivatePlate 服务和 SQLite 数据库都运行在家庭设备上时，才能称为严格的端侧处理。如果 `127.0.0.1` 实际通过 SSH Tunnel 转发到远程自托管服务器，则仍属于远程处理，应如实披露。

## 演示数据边界

`fixtures/` 中的数据是专门为 PrivatePlate 原型创建的 **AI-assisted synthetic demo data**，包括虚构家庭、演示食材、菜谱模板、知识卡和评测用例。

这些数据：

- 不是真实家庭记录
- 不是临床数据
- 不是权威营养数据库
- 不构成医疗建议
- 不重新分发第三方食品数据库

其中的营养和数量值仅用于工程演示。来源与许可边界见 [`fixtures/PROVENANCE.md`](fixtures/PROVENANCE.md) 和 [`DATA_LICENSE.md`](DATA_LICENSE.md)。

## 快速运行

### 环境要求

- Node.js 22.13+
- npm
- 一个 OpenAI-compatible Chat Model endpoint：`127.0.0.1:8000`
- 可选的 OpenAI-compatible Embedding endpoint：`127.0.0.1:8001`

模型权重和生产级食品数据库不包含在本仓库中。

### 安装依赖

```bash
npm ci
```

### 创建配置

```bash
cp .env.example .env
```

编辑 `.env` 后加载到当前终端：

```bash
set -a; source .env; set +a
```

### 启动 API

```bash
npm run dev:server
```

### 启动 Web

在另一个已经加载相同 `.env` 的终端运行：

```bash
npm run dev:web
```

浏览器打开：

```text
http://127.0.0.1:5173
```

## 验证

```bash
npm run check
```

测试使用 `ScriptedProductProvider` 作为确定性的模型替身。测试通过意味着代码路径、工具契约和安全边界满足预期，但不代表任意真实模型都具有同样的生成质量。

## 开源边界

本仓库开放的是可独立运行和复现的 PrivatePlate 核心，包括：

- Web 与 Server 应用
- Agent orchestration
- 领域数据契约
- 通用饮食约束与规划逻辑
- AI 辅助生成的 synthetic demo fixtures
- 公开评测脚手架

不在本仓库中的内容，例如真实用户或家庭数据、生产数据、私有评测材料、模型权重、内部工作文档以及未来的私有商业或硬件集成，不因本仓库开源而自动获得授权。完整边界见 [`OPEN_SOURCE_SCOPE.md`](OPEN_SOURCE_SCOPE.md)。

## License

本仓库中的 PrivatePlate 源代码采用 [Apache License 2.0](LICENSE)。

`fixtures/` 下的 AI-assisted synthetic demo data 采用 [CC0 1.0 Universal](DATA_LICENSE.md)，完整法律文本位于 `fixtures/LICENSES/CC0-1.0.txt`。

第三方依赖、模型和运行时保留各自的许可证与使用条款，见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

---

## English Summary

PrivatePlate is a privacy-first household meal coordination Agent for smart-fridge screens and home hubs. It combines an LLM for intent understanding and tool orchestration with a deterministic domain layer for household state, hard dietary constraints, calculation, confirmation, and persistent writes. Confirmed household memory survives conversation resets and is reloaded in future sessions. The repository includes a runnable browser prototype, local-first model interfaces, synthetic demo fixtures, and scripted evaluation scaffolding.
