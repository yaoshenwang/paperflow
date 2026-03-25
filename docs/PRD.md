# 最终版 PRD：开源 AI-native 可视化组卷工作台

## 1. 产品一句话

一个开源的、AI-native 的**视觉组卷工作台**：
把题目当素材，把试卷当时间线，把 Typst 当排版引擎，把 Agent 当可审计助手。

对教师来说，核心体验不是"写题""写代码""折腾 Word"，而是：

**一句话提出需求 → AI 拉出组卷蓝图 → 从原题库拖拽进时间线 → 实时预览卷面 → 一键导出学生卷 / 教师卷 / 答题卡。**

## 2. 产品定位

这是一个**组卷产品**，不是泛教育平台。

只抓五件事：

1. 原题题库检索与组织
2. 可视化组卷与精修
3. 强排版与稳定输出
4. 校本题库共建
5. Agent 驱动的自动化辅助

明确不做：

1. 不把"AI 原创题"作为正式生产主路径
2. 不做重型 LMS/教务/课堂平台
3. 不做资源社区大而全门户
4. 不把 HTML、DOCX、LaTeX/Typst 源码暴露给普通教师作为主编辑方式

## 3. 产品北极星

北极星不是"题库数量"，而是：

**让教师第一次真正感到：组卷像剪视频一样顺手。**

对应四个硬指标：

1. 从一句话需求到第一版可打印试卷，尽量压到一个短会话内完成
2. 正式试卷中 100% 题目可追溯来源
3. 普通教师 0 代码
4. 同一份结构化试卷模型可导出学生卷、教师卷、答题卡、解析册、QTI、DOCX

## 4. 核心产品原则

### 4.1 来源优先，不是生成优先

任何进入正式试卷的题目，都必须带有来源、页码/定位、版权状态、审核状态。

### 4.2 可视化优先，不是表单优先

教师不应该在十几层筛选弹窗和 Word 样式面板里工作，而应该在"素材库 + 时间线 + 卷面预览 + 属性面板"里工作。

### 4.3 页面优先，不是富文本优先

这是试卷，不是博客。页面稳定性、分页、题号、答题区、OCR 友好性，比富文本自由度更重要。

### 4.4 AI 只提议，不越权

AI 可以检索、配平、替换、重排、校对；
AI 不能静默改题、不能悄悄插入无来源题、不能默认生成正式原题。

### 4.5 一个真相源，多渲染输出

系统内部唯一真相源是**结构化 JSON AST**，不是 HTML，不是 DOCX，不是 Typst 源文本。
Typst、PDF、DOCX、QTI 都只是渲染/交换结果。

### 4.6 开源的是引擎与工作台，不是默认附送商业题库

开源版应该提供空系统、demo 数据、导入工具、模板和 schema。
商业或校本题库通过适配器接入。

## 5. 核心用户

### A. 一线教师

目标：快速出一份质量过关的卷
痛点：搜题碎片化、复制粘贴、Word 排版崩、平行卷难做、来源难管理

### B. 备课组长 / 学科负责人

目标：统一题风、难度、知识覆盖和校本资源
痛点：组内协作乱、版本多、审核难、标准不一致

### C. 学校题库管理员

目标：沉淀校本题库、权限管理、资源治理
痛点：资源散落、版权不清、重复题多、元数据脏

### D. 资源审核 / 教研运营

目标：把 PDF/Word/扫描卷变成高质量结构化题库
痛点：OCR 不稳、分题不准、公式乱、审核链条长

## 6. 用户要完成的真正任务

这个产品要解决的不是"做一份文档"，而是五个连续任务：

1. 明确这份卷要考什么
2. 快速找到够好的原题
3. 组织成一份结构合理的卷
4. 让卷面稳定、专业、可打印、可扫描
5. 沉淀成可复用的学校资产

所以产品必须覆盖五层：

* 意图层：一句话需求
* 结构层：题型/分值/难度/知识分布
* 素材层：原题选择与替换
* 版式层：分页、答题区、模板
* 资产层：版本、来源、题库沉淀

---

## 7. 黄金路径

这是整个产品最重要的主路径。

### 步骤 1：新建试卷

教师点击"新建试卷"，输入：

> 高一数学上学期期中卷，120 分，函数/三角/数列，难度 6:3:1，北京近三年真题优先，不要竞赛题，选择题 12 道，填空 4 道，解答 6 道。

### 步骤 2：Agent 生成组卷蓝图

系统先不急着出题，而是先产出一个**Blueprint**：

* 总分
* 时长
* 题型结构
* 每部分目标分值
* 难度分布
* 知识点覆盖
* 来源优先级
* 禁用项
* 平行卷需求
* 输出版本需求

这一步一定要先于搜题。

### 步骤 3：AI 拉出候选题素材

左侧素材库直接出现一批候选题卡，每张卡片带：

* 来源标签
* 年份/地区/考试名
* 题型
* 难度
* 知识点
* 相似题数量
* 是否已审核
* 是否有答案/解析
* 版权状态

### 步骤 4：教师像剪视频一样拖进时间线

底部时间线按"大题段"分区。教师把题卡拖进"选择题""填空题""解答题"等 section 里。

### 步骤 5：系统自动配平

拖入后系统自动：

* 编号
* 计算总分
* 检查难度偏移
* 检查知识点覆盖偏移
* 检查重复来源/重复母题
* 给出"是否需要替换一题"的建议

### 步骤 6：实时卷面预览

中间画布实时显示学生看到的卷面。
任何改动都立即触发排版刷新。

### 步骤 7：Review Center 最终校对

发布前必须经过 Review Center：

* 是否全为可追溯原题
* 是否答案齐全
* 是否存在同源重复
* 是否超页/溢出
* 是否存在不适合 OCR 的答题区
* 是否存在解析泄露到学生卷
* 是否存在未授权素材

### 步骤 8：导出多个版本

一次导出：

* 学生卷 PDF
* 教师卷 PDF（含答案）
* 答题卡 PDF
* 解析册 PDF
* DOCX 兼容版
* QTI/JSON 交换包

---

## 8. 交互系统：像视频剪辑软件一样组卷

这是产品的灵魂。

### 8.1 四区布局

**左侧：素材库 Source Bin**
搜索结果、校本题库、收藏夹、历史试卷、相似题簇

**中间：卷面监视器 Viewer**
真实纸面预览，支持缩放、页缩略图、分页定位

**底部：组卷时间线 Timeline**
按 section 组织题目 clip，支持拖拽、替换、锁定、复制、并行版本

**右侧：检查器 Inspector / AI Assistant**
属性、来源、知识点、分值、版式、相似题、AI 建议、审核状态

### 8.2 视频编辑隐喻映射

* 媒体素材箱 = 题库候选池
* 时间线 clip = 题目实例
* alt take = 相似题候选
* inspector = 题目属性/来源/分值
* monitor = 卷面预览
* ripple insert = 自动重排题号和总分
* lock clip = 锁题，AI 不得替换
* snapshot = 版本快照
* export preset = 学生卷 / 教师卷 / 答题卡模板

### 8.3 关键交互动作

每个题目 clip 支持：

* 拖入 / 拖出
* 上下移动
* 锁定
* 替换为相似题
* 复制为平行版本
* 拆分小问
* 合并为题组
* 隐藏解析
* 只显示题干/题干+答案/题干+答案+解析
* 指定分值
* 指定答题区长度
* 固定页前/页后
* 加入候选栈

### 8.4 为什么这个交互会赢

因为今天大部分组卷产品本质上还是"高级筛选表单 + 列表页 + 下载按钮"。
而你要做的是"工作台型产品"。

---

## 9. 功能模块定义

## 9.1 模块一：题库与搜索

必须支持六种找题方式：

1. 关键词搜索
2. 自然语言搜索
3. 知识点/章节筛选
4. 图片搜题 / 截图搜题
5. 以卷找题（给一份样卷生成相似结构候选）
6. 以题找题（相似题 / 平行题 / 同母题）

每个搜索结果必须展示：

* 来源
* 年份
* 地区
* 考试名称
* 题型
* 难度
* 知识点
* 答案/解析状态
* 审核状态
* 版权状态
* 相似题数
* 是否已被当前卷使用

搜索结果默认分三层：

* 精确匹配
* 可替换候选
* 平行卷候选

## 9.2 模块二：组卷蓝图 Blueprint

Blueprint 是整个系统的大脑，不是附属表单。

字段至少包括：

* 科目
* 学段/年级
* 总分
* 时长
* 题型结构
* 分值分布
* 难度分布
* 知识点覆盖
* 来源偏好
* 禁用来源
* 禁用知识点
* 地区偏好
* 年份范围
* 是否做平行卷
* 输出版本

AI 的第一职责不是"生成内容"，而是"把用户意图结构化成 Blueprint"。

## 9.3 模块三：组卷 Studio

Studio 要支持：

* section 模板（期中卷、周测卷、月考卷、专题卷）
* clip 拖放
* 自动编号
* 自动计分
* 自动小题编号
* section 折叠/展开
* 题组管理
* 平行卷 lane
* 锁题/锁 section
* 快速替换
* 批量调分
* 批量隐藏解析
* 快速对比两个版本

## 9.4 模块四：版式与模板

模板分四类：

1. 学生卷
2. 教师卷
3. 答题卡
4. 解析册

模板要抽象为 design tokens，而不是散落的 CSS/Word 样式：

* 页边距
* 题号样式
* section 标题样式
* 字体与字号
* 行距
* 图表缩放策略
* 选项排列规则
* 答题区规则
* 页眉页脚
* 密封线
* 校名/考试名
* 二维码 / 条形码
* 水印
* OCR 锚点

## 9.5 模块五：Review Center

试卷发布前必须过系统检查。
任何一个人打开 Review Center，就知道这份卷是否可发布。

检查项：

* 来源完整性
* 权限状态
* 答案完整性
* 解析完整性
* 图片/公式丢失
* 相似题过密
* 难度分布偏差
* 知识点覆盖偏差
* 页数溢出
* 答题区冲突
* OCR 风险
* 未审核题进入正式卷
* 学生卷误带答案

## 9.6 模块六：入库与加工

系统必须把"题库建设"做成产品级能力，而不是后台脚本。

入库流程：

1. 上传 PDF / Word / 图片 / QTI / JSON
2. 解析页面与题块
3. OCR/公式识别
4. 自动分题
5. 自动抽取答案/解析
6. 自动打标签
7. 去重/聚类
8. 人工审核
9. 发布到校本题库或公共题库

## 9.7 模块七：协作与权限

角色最少四种：

* Teacher
* Reviewer
* Librarian
* Org Admin

权限至少包括：

* 查看公共题库
* 查看校本题库
* 上传资源
* 审核发布
* 模板编辑
* 导出正式卷
* 管理版权状态
* 管理成员权限

## 9.8 模块八：导出与互操作

权威输出是 PDF。
兼容输出是 DOCX。
交换输出是 JSON/QTI。

QTI 3 不是可选项，而是开放生态的底线，因为它本来就是 assessment item/test 的移植标准。

---

## 10. AI 设计：像 Claude Code，但用于组卷

采用**可审计、可批准、可回滚**的 agent 交互模型。

### 10.1 只做一个 Orchestrator，不做一群乱飞的小 Agent

系统内部可以有多个能力模块，但对用户只暴露一个统一助手：

* 计划
* 搜题
* 组卷
* 替换
* 配平
* 校对
* 导出建议

不要做五六个"搜索 agent / 排版 agent / 审核 agent"同时说话的多智能体 UI。

### 10.2 助手有三种模式

**推荐模式**
只给候选，不动卷

**执行模式**
生成 patch diff，等待教师批准

**审核模式**
扫描问题并出报告，不直接改动

### 10.3 Agent 工具面

```text
search_items(query, filters)
get_item(item_id)
get_similar_items(item_id)
create_blueprint(intent)
patch_paper(ast_patch)
replace_clip(clip_id, item_id)
rebalance_distribution(targets)
check_duplicates(paper_id)
check_provenance(paper_id)
compile_preview(paper_id, mode)
export_paper(paper_id, preset)
import_source(file_id)
request_review(item_id_or_paper_id)
```

### 10.4 Agent 的硬约束

1. 不得默认创建"正式原题"
2. 不得插入 `review_status != approved` 的题
3. 不得插入 `rights_status` 不合规的题
4. 不得修改被锁定的 clip
5. 所有写操作都必须生成 patch diff
6. 所有 patch 都支持 undo
7. 每次推荐必须给出一句来源理由
8. 每次替换必须给出"为什么更合适"

### 10.5 AI 生成题的策略

把 AI 生成题放进单独的 `AI Lab` 命名空间：

* 默认关闭
* 默认不进入正式搜索结果
* 默认不能直接进正式试卷
* 必须加红色标签 `AI_GENERATED`
* 必须经过人工重写/审核后，才能以"教师原创题"重新入库

**正式考试卷的主流程 = 原题检索与组装，不是生成。**

---

## 11. 数据模型：系统真正的心脏

整个系统最重要的不是 UI，而是 canonical schema。

### 11.1 SourceDocument

```ts
type SourceDocument = {
  id: string
  sourceType: 'provider' | 'school_upload' | 'teacher_upload' | 'curated' | 'ai_lab'
  title: string
  subject: string
  grade: string
  region?: string
  year?: number
  examName?: string
  paperType?: string
  fileRef: string
  pageCount: number
  rightsStatus: 'public_domain' | 'cc' | 'school_owned' | 'licensed' | 'restricted' | 'prohibited'
  ownerOrgId?: string
  uploadedBy?: string
  createdAt: string
}
```

### 11.2 QuestionItem

```ts
type QuestionItem = {
  id: string
  canonicalId: string
  sourceDocumentId: string
  sourceLocator: {
    page: number
    bbox?: [number, number, number, number]
    questionNo?: string
  }

  taxonomy: {
    subject: string
    grade: string
    textbookVersion?: string
    knowledgeIds: string[]
    abilityTags: string[]
    questionType: string
    difficulty?: number
  }

  content: {
    stem: Block[]
    options?: Option[]
    subquestions?: BlockQuestion[]
    answer?: Block[]
    analysis?: Block[]
    assets: AssetRef[]
    math: {
      latex?: string[]
      typst?: string[]
      mathjson?: unknown[]
      spokenText?: string[]
    }
  }

  provenance: {
    examName?: string
    region?: string
    school?: string
    year?: number
    sourceLabel: string
  }

  quality: {
    reviewStatus: 'draft' | 'parsed' | 'tagged' | 'checked' | 'approved' | 'published' | 'archived'
    answerVerified: boolean
    duplicateClusterId?: string
    ocrConfidence?: number
    reviewerId?: string
  }

  rightsStatus: 'public_domain' | 'cc' | 'school_owned' | 'licensed' | 'restricted' | 'prohibited'
}
```

### 11.3 PaperProject

```ts
type PaperProject = {
  id: string
  orgId: string
  title: string
  blueprint: Blueprint
  sections: SectionNode[]
  clips: QuestionClip[]
  templatePreset: string
  outputModes: ('student' | 'teacher' | 'answer_sheet' | 'solution_book')[]
  version: number
  status: 'draft' | 'reviewing' | 'approved' | 'published'
}
```

### 11.4 QuestionClip

```ts
type QuestionClip = {
  id: string
  questionItemId: string
  sectionId: string
  order: number
  score: number
  locked: boolean
  hiddenParts: ('answer' | 'analysis')[]
  altItemIds: string[]
  layoutHints?: {
    keepWithNext?: boolean
    forcePageBreakBefore?: boolean
    answerAreaSize?: 's' | 'm' | 'l'
  }
}
```

### 11.5 为什么一定要这样做

因为一旦你把系统真相源放在 HTML/Word 上，整个产品最后一定会变成"复制粘贴+样式崩坏"的老路。

---

## 12. 数学语义层

MathLive 已经能把数学内容导出为 Typst 和 MathJSON。

v1 的作用主要有四个：

1. 公式可搜索
2. 同母题/相似题聚类
3. 公式等价与答案核验辅助
4. 后续变量题模板的基础设施

语义层是为了让题库更强，不是为了让 AI 乱出题。

---

## 13. 检索与排序策略

检索不能只靠向量，也不能只靠关键词。

推荐使用**混合检索**：

### 第一层：硬过滤

* subject
* grade
* questionType
* rightsStatus
* reviewStatus
* region
* year
* source preference

### 第二层：文本召回

* 题干 OCR
* 标题
* 知识点标签
* 来源字段
* 教师输入自然语言解析后的关键词

### 第三层：语义召回

* embedding
* mathjson canonical features
* duplicate/similar clusters

### 第四层：重排

综合以下因素：

* lexical match
* blueprint fit
* provenance quality
* answer completeness
* similarity diversity
* teacher behavior history

初版重排公式：

```text
final_score =
0.35 * lexical_match +
0.20 * blueprint_fit +
0.15 * provenance_quality +
0.10 * review_quality +
0.10 * semantic_similarity +
0.10 * diversity_bonus
```

注意：
`rightsStatus` 和 `reviewStatus` 应该是硬门槛，不是软分。

---

## 14. 排版引擎：Typst 是内核，不是用户界面

### 14.1 渲染链路

```text
Paper AST
 -> Layout Resolver
 -> Template Tokens
 -> Typst Source
 -> Typst Compile Service
 -> PDF / PNG Preview
```

### 14.2 渲染器抽象

```ts
interface RenderBackend {
  renderStudentPaper(ast): Output
  renderTeacherPaper(ast): Output
  renderAnswerSheet(ast): Output
  renderDocx(ast): Output
  renderQti(ast): Output
}
```

### 14.3 专家模式

普通教师永远不见 Typst。
只有模板开发者、技术管理员、生态贡献者，才进入"模板开发模式"。

---

## 15. 答题卡与 OCR 友好设计

### 15.1 答题卡引擎必须一等公民

不能把答题卡当"导出后另做"。

### 15.2 需要的布局 token

* `scan_safe_margin`
* `anchor_marks`
* `bubble_size`
* `bubble_pitch`
* `subjective_box_padding`
* `question_region_gap`
* `page_qr_code`
* `student_info_block`
* `version_marker`

### 15.3 设计规则

* 每题一个明确答题区域
* 区域之间不要重叠
* 学生卷模板与答题卡模板严格版本绑定
* 客观题区域统一规格
* 主观题区域按题型预设高度
* 支持多个卷版本的版式映射
* 所有扫描锚点都由模板层统一生成

### 15.4 输出物

* 学生卷
* 教师卷
* 客观题答题卡
* 主观题答题页
* 扫描版定位模板

---

## 16. 技术架构

### 16.1 推荐栈

**前端**

* Next.js / React
* Tiptap（基于 ProseMirror）
* dnd-kit
* MathLive
* Zustand 或 TanStack Query
* PDF viewer / canvas preview

**协作**

* Yjs
* Hocuspocus

**后端**

* NestJS 或同级 TypeScript API 层
* Agent Orchestrator
* Worker Queue

**编译**

* Rust Typst Compile Service

**数据**

* PostgreSQL（事务真相源）
* OpenSearch（全文检索 + 过滤 + 可选向量）
* Redis（队列/缓存）
* MinIO / S3（对象存储）

### 16.2 服务划分

1. Web App
2. API / Agent Gateway
3. Collaboration Service
4. Compile Service
5. Worker / Import Service
6. Search Index

### 16.3 服务关系

```text
Browser
  -> Web App
  -> Collaboration WS

Web App
  -> API Gateway

API Gateway
  -> Postgres
  -> OpenSearch
  -> Redis
  -> Object Storage
  -> Agent Orchestrator
  -> Typst Compile Service
  -> Worker / Import Pipeline
```

### 16.4 最小 API 契约

```text
POST /blueprints
GET  /search/items
POST /papers
POST /papers/:id/patch
POST /papers/:id/compile
POST /papers/:id/export
POST /imports
POST /agent-runs
POST /reviews/:id/approve
```

---

## 17. 编辑层技术选型

Tiptap/ProseMirror + Yjs/Hocuspocus + MathLive

关键价值：**编辑状态始终保持结构化。**

---

## 18. 开源策略

### 18.1 开源边界

开源的是：

* 工作台前端
* 后端服务
* schema
* Typst 模板包
* 导入器
* 插件接口
* SDK
* demo 数据集

不开源默认附送的：

* 任何有版权争议的商业题库内容

### 18.2 推荐许可证拆分

* `core server / web / collab / agent`: **AGPLv3**
* `schema / sdk / renderer interface / template packs`: **Apache-2.0**
* 文档与教程：**CC BY 4.0**

### 18.3 仓库结构

```text
apps/
  web/
  api/
  collab/
  worker/
  compile-typst/

packages/
  schema-question/
  schema-paper/
  editor-kit/
  agent-tools/
  render-core/
  render-typst/
  render-docx/
  render-qti/
  importers/
  template-packs/
  sdk/

infra/
  docker/
  helm/

examples/
  demo-bank/
  sample-papers/
```

### 18.4 插件点

1. Source Adapters（题库源适配）
2. Renderer（PDF / DOCX / QTI）
3. Template Packs（模板）
4. Taxonomy Packs（知识点体系）

---

## 19. 资源治理与发布规则

### 19.1 题目状态机

`draft -> parsed -> tagged -> checked -> approved -> published -> archived`

### 19.2 版权状态

* `public_domain`
* `cc`
* `school_owned`
* `licensed`
* `restricted`
* `prohibited`

### 19.3 发布硬规则

正式试卷只能包含：

* `reviewStatus in (approved, published)`
* `rightsStatus in (public_domain, cc, school_owned, licensed)`

### 19.4 AI Lab 隔离

`sourceType = ai_lab` 的内容：

* 默认不参与正式检索
* 默认不可进入正式导出
* 必须人工转正

---

## 20. 从零搭建的实施顺序

### 第一步：先冻结 schema

先定这四个对象：

* SourceDocument
* QuestionItem
* QuestionClip
* PaperProject

### 第二步：做 Typst 编译 POC

先证明三件事：

* 同一份 AST 能生成学生卷
* 同一份 AST 能生成教师卷
* 同一份 AST 能生成答题卡

### 第三步：做题库入库与检索闭环

* 导入
* 分题
* 审核
* 检索
* 插入

### 第四步：做 Studio 主工作台

四区布局：

* 素材库
* 卷面监视器
* 时间线
* 属性/AI 面板

### 第五步：再接 Agent

Agent 只接：

* Blueprint 生成
* 搜题
* 替换
* 配平
* Review

### 第六步：做 Review Center

### 第七步：做校本题库与权限

### 第八步：做 QTI / DOCX / 模板生态

---

## 21. 第一阶段绝对不要分散去做的东西

1. 学生端超级 App
2. 全量在线考试系统
3. 全自动 AI 阅卷闭环
4. 教研内容社区
5. 花哨多智能体聊天界面
6. 大量低质量模板市场
7. 把 AI 生成题塞进正式题库

---

## 22. 这个产品真正的护城河

1. **有来源的原题资产层**
2. **像剪视频一样的组卷工作台**
3. **稳定、专业、可扫描的 Typst 排版层**
4. **可审计、可批准、可回滚的 Agent 自动化层**

---

## 23. 最终产品主张

**"不是让老师写卷子，而是让老师指挥系统把卷子组出来。"**

三条铁律：

* 正式题目，来源必须可信
* 编辑体验，必须像工作台，不像后台表单
* AI 只能增强教师，不替代教师做高风险决定

**先冻结 `QuestionItem schema` 和 `Studio 交互稿`。**
