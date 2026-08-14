# PrivatePlate Product North Star

> This document defines the canonical product interpretation for PrivatePlate. The current repository is only one implemented vertical and must not be treated as the complete product vision.

## 1. 母命题

真正想解决的不是“今天吃什么”，也不是做一个更聪明的菜谱助手。

长期目标是：

> **用 Household Agent 接管家庭中长期由某个人默默承担的无形认知劳动与协调劳动。**

这里的“无形劳动”包括持续记住家庭状态、提前计划、协调不同成员需求、处理变化、做日常判断、发现缺口、分配任务，并把执行交给合适的人、设备或未来的实体机器人。

家庭不应该永远依赖某一个人充当全家的“外置大脑”。

## 2. Household Agent 的长期角色

Household Agent 应当持续理解一个家庭，而不是只响应一次请求。

它最终应具备的核心职责是：

- 维护持续的家庭状态，而不是每次从零开始；
- 认识不同家庭成员及其需求、偏好、限制与当日变化；
- 记住需要被记住的家庭事务；
- 在多个约束之间做日常协调与规划；
- 主动发现缺口、冲突和待办；
- 在授权后把任务交给家庭成员、服务、智能家电或实体机器人；
- 让实体机器人承担“身体”的执行能力，而 Household Agent 继续作为持续决策与协调的“大脑”。

工作类别暂称 **Household Agent / Household Intelligence**。母体品牌名称尚未确定，不应把 `PrivatePlate` 强行扩张为整个母品牌。

## 3. PrivatePlate 在这棵树上的位置

PrivatePlate 是这个长期愿景的**第一个垂直能力：家庭餐食与营养协调**。

餐食是合适的第一块，因为一顿家庭餐天然同时包含：

- 谁今天吃饭；
- 每个人有什么饮食限制与偏好；
- 冰箱里有什么、什么应优先使用；
- 上一餐已经发生了什么；
- 如何规划一顿共享餐；
- 不同成员如何做份量与约束适配；
- 缺什么需要采购；
- 谁负责准备或执行；
- 用户改变主意后如何继承已有状态继续重规划；
- 实际结果如何进入下一轮家庭状态。

因此，PrivatePlate 不是“菜谱推荐器”，而是对**家庭餐食这件持续家庭事务**进行 orchestration 的 Agent vertical。

推荐英文定位：

> **PrivatePlate is the meal and nutrition coordination vertical of a broader Household Agent vision for reducing invisible domestic cognitive labor.**

更贴近当前产品能力的短句：

> **It does not just recommend a meal. It coordinates the household work around the meal.**

## 4. 营养角色

长期愿景包含对家庭日常营养工作的承担，但不等同于替代临床营养师或医疗专业人员。

适合交给系统的是日常、非临床的营养协调，例如：

- 家庭饮食是否长期失衡；
- 不同年龄和成员的日常份量差异；
- 已经吃过什么与下一餐如何平衡；
- 盐、油、糖、能量等日常 guardrail；
- 明确忌口与过敏约束；
- 如何结合现有库存安排一餐。

诊断、治疗、处方、调药以及医学营养治疗不属于该产品的普通自动决策范围。

## 5. 当前仓库 ≠ 完整愿景

当前 GoAI / public repository 是一个可运行、可验证的实现切片。

它主要证明餐食 vertical 中已经能成立的一部分能力，例如：

- 多成员家庭上下文；
- 库存与当天状态；
- 多轮餐食规划与修改；
- 确定性营养、约束和库存逻辑；
- 结构化 Agent tools；
- shopping gap；
- household task handoff；
- preview → confirmation → commit；
- SQLite 持久化；
- privacy-safe projection；
- local RAG / local-model-compatible architecture。

这些实现不是母命题的全部，也不意味着当前就已经实现了完整家务 Agent、清洁、洗衣、家庭日程、真实采购执行、智能家电控制或实体机器人能力。

**不要为了让当前代码“看起来配得上长期愿景”而强行加入这些未来能力。**

长期愿景用于决定方向；当前实现范围用于决定现在真正交付什么。

## 6. 防止误读的规则

以后任何 AI、开发者、评委材料或产品文案在理解 PrivatePlate 时，都应遵守：

1. **不要从代码范围反推完整产品定义。** 当前实现窄，是因为它是第一个 vertical，不是因为愿景只有这么大。
2. **不要把 PrivatePlate 定义成普通 meal-planning / recipe chatbot。** 餐食推荐只是它内部的一小段能力。
3. **不要把智能冰箱或浏览器设备模拟器当成产品本身。** 它们只是交互和部署 surface。
4. **不要把 Home Hub 当成既定方向。** 除非用户未来明确重新选择，否则它不是 canonical architecture / product framing。
5. **不要让比赛叙事覆盖产品叙事。** AMD / ROCm、本地推理、benchmark、GOAI 评分要求都属于阶段性实现与证明环境。
6. **不要让安全工程抢走核心价值叙事。** Privacy、typed tools、deterministic Domain、confirmation、idempotency、eval 都很重要，但它们回答的是“为什么可信”，不是“为什么家庭需要它”。
7. **任何路线图必须区分三层：**长期 Household Agent 北极星、PrivatePlate meal/nutrition vertical、当前仓库已实现能力。

## 7. 未来判断新功能的标准

一个新功能是否属于这条产品线，不看“AI 能不能做”，而看它是否减少了真实家庭中的认知与协调负担。

优先问：

> **它是否让家庭少一个必须由某个人一直记住、判断、协调或追着执行的事情？**

如果答案是否定的，它即使很酷，也未必属于这个北极星。

## 8. 一句话总纲

> **长期目标：让 Household Agent 承担家庭中看不见的认知与协调劳动；PrivatePlate 是从餐食与营养开始的第一块可运行大脑。**
