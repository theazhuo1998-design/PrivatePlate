# PrivatePlate Product North Star

> This document is the repository-level north-star guidance for interpreting PrivatePlate's product vision and positioning. “North Star” names the role of this guidance document, not the product. This is not an implementation specification.

## 1. 产品定义

PrivatePlate 不是普通饮食问答机器人，也不是现有饮食软件接上一个聊天框。

它被定位为：

> **一个面向家庭场景的私有膳食管家 Agent，能够认识家庭成员及其饮食需求，管理家中食材，规划一餐，协商调整方案，并在用户授权后继续完成采购、烹调支持或任务分发。**

推荐英文定位：

> **A private household meal orchestration agent that coordinates family needs, pantry inventory, meal planning, shopping, and cooking handoffs.**

核心不是 `meal recommendation`，而是 `meal orchestration`：PrivatePlate 不只回答“吃什么”，而是持续协调围绕一顿家庭餐发生的成员需求、食材、营养、采购和执行工作。

## 2. 核心用户价值

PrivatePlate 要解决的不是单次给答案，而是减少家庭成员为了吃饭这件事反复承担的认知与协调工作。

它应当能够围绕一顿家庭餐持续处理这样的事务：

- 今天有哪些人吃饭；
- 每个人有哪些饮食限制、偏好和当日变化；
- 已经吃过什么，下一餐需要如何平衡；
- 家里现有什么食材，哪些应该优先使用；
- 如何规划一顿尽量共享、同时适配不同成员的餐食；
- 用户改变主意后如何继承已有状态继续调整；
- 缺什么需要采购；
- 谁负责准备、购买或执行；
- 实际结果如何进入后续状态，而不是每次重新从零开始。

判断一个新功能是否真正属于 PrivatePlate，优先问：

> **它是否实质减少了家庭在餐食与日常营养上的记忆、判断、协调或执行负担？**

如果答案是否定的，即使功能很新奇，也不应仅因为“AI 能做”就进入产品方向。

## 3. 家庭，而不是孤立的单个用户

PrivatePlate 面对的是一个家庭系统，而不是一个单独的健康档案。

- 家庭中可能有多个成员；
- 每个成员的目标、限制与偏好可能不同；
- 一顿饭通常需要在共享菜品与个体适配之间取得平衡；
- 决策者、采购者、做饭者和用餐者可能不是同一个人；
- 执行可能被交给伴侣、家人、照护者、服务、智能设备，或未来的实体机器人。

因此，产品价值来自对家庭餐食事务的持续协调，而不是仅生成一份菜单。

## 4. 营养角色

PrivatePlate 的长期愿景包含承担家庭日常、非临床的营养协调工作，但不等同于替代临床营养师或医疗专业人员。

适合交给系统的是例如：

- 家庭饮食是否长期失衡；
- 不同年龄和成员的日常份量差异；
- 已经吃过什么与下一餐如何平衡；
- 盐、油、糖、能量等日常 guardrail；
- 明确忌口与过敏约束；
- 如何结合家庭库存安排一餐。

诊断、治疗、处方、调药以及医学营养治疗不属于普通自动决策范围。

## 5. 产品演化方向

PrivatePlate 的产品形态可以随部署环境演化，但交互载体不是产品本身。

- **远期方向**：成为未来家政机器人可搭载的家庭膳食管理模块，让机器人承担实体执行能力，而 PrivatePlate 负责餐食与营养相关的持续理解、规划和协调。
- **近期方向**：可以通过带显示屏、语音交互的家庭终端等形态进入真实家庭场景。
- **当前实现**：以可运行的软件形态验证家庭膳食协调闭环。

智能冰箱屏幕、浏览器设备模拟器、语音入口或未来硬件都属于 interface / deployment surface，不应反过来定义 PrivatePlate 是什么产品。

## 6. 当前仓库 ≠ 完整产品愿景

当前 public repository 只是 PrivatePlate 当前阶段的一个可运行、可验证实现切片。

它应当被用来回答：

- 今天实际实现了什么；
- 哪些能力已有可验证证据；
- 当前工程边界、接口和测试是什么。

它不应被用来反推出：

- PrivatePlate 的完整产品愿景只有当前这些功能；
- 当前 demo 的界面就是最终产品形态；
- 比赛范围、benchmark 或某次实现裁剪就是长期产品边界。

同样，也不要为了让当前代码“看起来配得上长期愿景”而强行加入尚未进入当前范围的能力。

**长期愿景用于决定方向；当前需求与工程规格用于决定现在真正交付什么。**

## 7. 防止后续误读的规则

以后任何 AI、开发者、评委材料或产品文案在理解 PrivatePlate 时，都应遵守：

1. **不要从当前代码范围反推完整产品定义。** 当前实现范围可以窄于产品愿景。
2. **不要把 PrivatePlate 定义成普通 meal-planning / recipe chatbot。** 餐食推荐只是完整协调流程中的一小段能力。
3. **不要把某个硬件或 UI surface 当成产品本身。** 载体可以变化，家庭膳食协调这个产品职责不因此改变。
4. **不要让比赛叙事覆盖产品叙事。** GPU、部署环境、benchmark、评分要求等属于阶段性的实现与证明环境。
5. **不要让安全工程抢走核心价值叙事。** Privacy、typed tools、deterministic logic、confirmation、idempotency、eval 都很重要，但它们主要回答“为什么可信”，不是“为什么家庭需要它”。
6. **不要让长期愿景直接变成未授权的当前开发范围。** Product North Star 负责方向，PRD / implementation spec 负责当前交付边界。
7. **不要把未经用户确认的候选命名、母品牌、产品类别或架构假设写成 canonical fact。**

## 8. 一句话总纲

> **PrivatePlate 要成为家庭里的私有膳食管家 Agent：不只推荐一餐，而是持续协调家庭成员、库存、营养、采购与执行，让围绕“吃饭”产生的家庭事务真正被接住。**
