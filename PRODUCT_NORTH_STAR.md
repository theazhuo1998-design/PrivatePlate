# PrivatePlate Product North Star

> This document is the repository-level north-star guidance for interpreting the product vision behind PrivatePlate. “North Star” names the role of this guidance document, not the product. This is not an implementation specification.

## 1. 长期北极星：Household Agent

长期目标不是做一个更聪明的菜谱助手，也不是把当前 PrivatePlate 的实现范围无限放大。

真正想解决的是：

> **让 Household Agent 承担家庭中长期由某个人默默维护的无形认知劳动与协调劳动。**

这里的工作包括持续记住家庭状态、提前计划、协调不同成员需求、处理变化、做日常判断、发现缺口、分配任务，并在合适的授权边界下把执行交给家庭成员、服务、智能设备或未来的实体机器人。

Household Agent 的核心价值不是“能回答多少家庭问题”，而是让家庭少一个必须一直在脑子里记住、判断、协调和追着执行的人。

母体品牌名称尚未确定。`Household Agent` 在这里描述长期产品方向与系统角色，不应被擅自扩写成未经确认的品牌命名。

## 2. PrivatePlate 在长期方向中的位置

PrivatePlate 是这条长期方向里的**第一块餐食与营养 vertical**，也是最先落地的具体家庭事务领域。

它之所以适合作为第一块，是因为一顿家庭餐天然包含一组完整的家庭协调问题：

- 今天有哪些人吃饭；
- 每个人有哪些饮食限制、偏好和当日变化；
- 已经吃过什么，下一餐需要如何平衡；
- 家里现有什么食材，哪些应该优先使用；
- 如何规划一顿尽量共享、同时适配不同成员的餐食；
- 用户改变主意后如何继承已有状态继续调整；
- 缺什么需要采购；
- 谁负责准备、购买或执行；
- 实际结果如何进入后续状态，而不是每次重新从零开始。

因此，PrivatePlate 不是母体品牌，也不是长期产品愿景的全部。

在自己的 vertical 内，它被定位为：

> **一个面向家庭场景的私有膳食管家 Agent，能够认识家庭成员及其饮食需求，管理家中食材，规划一餐，协商调整方案，并在用户授权后继续完成采购、烹调支持或任务分发。**

推荐英文定位：

> **A private household meal orchestration agent that coordinates family needs, pantry inventory, meal planning, shopping, and cooking handoffs.**

核心不是 `meal recommendation`，而是 `meal orchestration`。

## 3. 北极星判断标准

判断一个新方向是否属于长期 Household Agent 产品线，不看“AI 能不能做”，而优先问：

> **它是否减少了真实家庭中某个人必须持续记住、判断、协调或追着执行的事情？**

如果答案是否定的，即使功能很新奇，也未必属于这条产品线。

对于 PrivatePlate 自身，则再加一层约束：它是否实质减少了家庭在餐食与日常营养上的记忆、判断、协调或执行负担。

这两个层级不要混淆：

- Household Agent 决定长期产品方向；
- PrivatePlate 决定第一块餐食与营养 vertical 的产品职责；
- 当前 PRD / implementation spec 决定现在真正开发和交付什么。

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

## 5. 产品、界面与未来执行能力

不要把某一种交互载体误认为产品本身。

智能冰箱屏幕、浏览器设备模拟器、语音入口、家庭终端以及未来硬件都属于 interface / deployment surface。它们可以变化，不应反过来定义长期产品是什么。

长期方向允许 Household Agent 把执行交给人、服务、智能家电或未来的实体机器人。未来机器人可以提供“身体”的执行能力，但长期需要持续理解家庭状态、规划和协调的“大脑”职责仍属于 Agent 层。

这不代表当前仓库已经或应该立即实现完整家务 Agent、家电控制、真实采购执行或实体机器人能力。

## 6. 当前仓库 ≠ 完整愿景

当前 public repository 是 PrivatePlate 这个 meal / nutrition vertical 在当前阶段的一个可运行、可验证实现切片。

它应当被用来回答：

- 今天实际实现了什么；
- 哪些能力已有可验证证据；
- 当前工程边界、接口和测试是什么。

它不应被用来反推出：

- 长期产品愿景只有餐食与营养；
- PrivatePlate 就是未来母体品牌；
- 当前 demo 的界面就是最终产品形态；
- 比赛范围、benchmark 或某次实现裁剪就是长期产品边界。

同样，也不要为了让当前代码“看起来配得上长期愿景”而强行加入尚未进入当前范围的未来能力。

**长期北极星用于决定方向；PrivatePlate 是第一块 vertical；当前需求与工程规格用于决定现在真正交付什么。**

## 7. 防止后续误读的规则

以后任何 AI、开发者、评委材料或产品文案在理解这条产品线时，都应遵守：

1. **不要从当前代码范围反推完整产品定义。** 当前实现窄，不代表长期方向只有这么窄。
2. **不要把 PrivatePlate 定义成普通 meal-planning / recipe chatbot。** 餐食推荐只是完整协调流程中的一小段能力。
3. **不要把 PrivatePlate 强行扩张成母体品牌。** 它是第一块 meal / nutrition vertical；母体品牌尚未确定。
4. **不要把某个硬件或 UI surface 当成产品本身。** 载体可以变化。
5. **不要让比赛叙事覆盖产品叙事。** GPU、部署环境、benchmark、评分要求等属于阶段性的实现与证明环境。
6. **不要让安全工程抢走核心价值叙事。** Privacy、typed tools、deterministic logic、confirmation、idempotency、eval 都很重要，但它们主要回答“为什么可信”，不是“为什么家庭需要它”。
7. **不要让长期愿景直接变成未授权的当前开发范围。** Product North Star 负责方向，PRD / implementation spec 负责当前交付边界。
8. **不要把未经用户确认的候选命名、母品牌、产品类别或架构假设写成 canonical fact。**

## 8. 一句话总纲

> **长期目标是让 Household Agent 承担家庭中看不见的认知与协调劳动；PrivatePlate 是从餐食与营养开始的第一块 vertical。**
