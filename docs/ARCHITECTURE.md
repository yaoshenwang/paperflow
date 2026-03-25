# Paperflow 架构文档

> 开源 AI-native 可视化组卷工作台

## 1. 项目概览

Paperflow 把题目当素材、把试卷当时间线、把 Typst 当排版引擎、把 Agent 当可审计助手，让教师像剪视频一样组卷。

- **仓库结构：** pnpm monorepo
- **源码规模：** 43 个源文件，约 3800 行 TypeScript/TSX
- **技术栈：** Next.js 16.2 · React 19 · Tailwind CSS 4 · Drizzle ORM · PostgreSQL 17 · Typst 0.14 · Zustand · Zod

---

## 2. 目录结构

```
paperflow/
├── apps/
│   ├── web/                    # Next.js 16.2 统一前后端
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/        # API Routes（10 个端点）
│   │   │   │   ├── studio/     # 四区布局组卷工作台
│   │   │   │   └── review/     # Review Center 审查页
│   │   │   ├── components/     # React 组件
│   │   │   │   ├── source-bin/ # 素材库（搜索+题卡）
│   │   │   │   ├── timeline/   # 组卷时间线
│   │   │   │   ├── viewer/     # 卷面预览
│   │   │   │   └── inspector/  # 属性面板+AI助手
│   │   │   ├── db/             # Drizzle ORM schema + 连接
│   │   │   ├── lib/            # 认证/权限工具
│   │   │   └── store/          # Zustand 状态管理
│   │   └── drizzle/            # 数据库迁移文件
│   └── compile-typst/          # Typst 编译 HTTP 服务
├── packages/
│   ├── schema/                 # 核心数据 schema（Zod）
│   ├── render-typst/           # AST → Typst 源码渲染器
│   ├── render-docx/            # AST → OOXML 渲染器
│   └── render-qti/             # AST → QTI 3.0 渲染器
├── infra/docker/               # Docker Compose（PostgreSQL）
├── examples/sample-papers/     # 示例数据 + 端到端验证
└── docs/                       # PRD + 架构文档
```

---

## 3. 核心数据模型（packages/schema）

6 组 Zod schema，TypeScript 类型自动推导：

| 对象 | 说明 |
|------|------|
| `Block` / `InlineNode` | 内容积木：段落、数学公式（Typst 语法）、图片、表格、代码 |
| `SourceDocument` | 来源文档：PDF/试卷来源，版权状态 |
| `QuestionItem` | 题目：题干+选项+小问+答案+解析，taxonomy，provenance，quality |
| `QuestionClip` | 题目实例：试卷中对题目的引用，含分值、锁定、隐藏部分、布局提示 |
| `Blueprint` | 组卷蓝图：学科、总分、题型结构、难度分布、来源偏好 |
| `PaperProject` | 试卷项目：蓝图 + sections + clips + 模板 + 状态 |

**设计原则：**
- 唯一真相源是结构化 JSON AST，不是 HTML/DOCX/Typst 源码
- 数学公式全部用 Typst 语法，不存 LaTeX，不做转换

---

## 4. 渲染管线

```
PaperProject AST
    ├── render-typst → Typst 源码 → typst compile → PDF/PNG
    ├── render-docx  → OOXML document.xml
    └── render-qti   → QTI 3.0 assessment XML
```

### render-typst

支持 4 种输出模式：

| 模式 | 行为 |
|------|------|
| `student` | 隐藏答案和解析 |
| `teacher` | 显示答案、解析、分值标注 |
| `answer_sheet` | 选择题涂卡区 + 主观题答题框 |
| `solution_book` | 同 teacher，用于解析册 |

模板 Token 系统控制：页边距、字号、行距、选项布局、答题区高度等。

### compile-typst 服务

- `POST /compile` — 接收 Typst 源码，返回 PDF
- 底层调用 `typst compile` CLI（v0.14.2）

---

## 5. 数据库（Drizzle ORM + PostgreSQL 17）

5 张表：

| 表 | 说明 |
|----|------|
| `source_documents` | 来源文档 |
| `question_items` | 题目（含 JSONB content、taxonomy 索引） |
| `paper_projects` | 试卷项目 |
| `organizations` | 组织/学校 |
| `users` | 用户（含角色） |

---

## 6. API Routes

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/items` | GET | 题目搜索（关键词/学科/年级/题型/状态 + 分页） |
| `/api/items` | POST | 创建题目（自动提取 searchText） |
| `/api/items/[id]` | GET/PATCH/DELETE | 题目 CRUD（PATCH 有字段白名单） |
| `/api/source-documents` | GET/POST | 来源文档管理 |
| `/api/preview` | POST | 实时 PDF 预览（AST → Typst → PDF） |
| `/api/export` | POST | 多格式导出：`pdf` / `typst` / `json` / `docx_xml` / `qti` |
| `/api/agent` | POST | AI 助手：`create_blueprint` / `search_items` / `check_balance` / `suggest_replace` / `review_paper` |
| `/api/review` | POST | Review Center：12 项检查（来源、版权、答案、难度、知识覆盖等） |
| `/api/auth` | POST | 用户认证：`register` / `login` / `logout` / `me` |

---

## 7. 前端（Next.js 16.2 App Router）

### Studio 工作台（/studio）

四区布局，模拟视频剪辑软件：

```
┌─────────────────────────────────────────────┐
│                  Top Bar                     │
├──────────┬──────────────────┬───────────────┤
│          │                  │               │
│  素材库   │    卷面预览       │   属性面板     │
│ SourceBin│    Viewer        │   Inspector   │
│          │                  │               │
├──────────┴──────────────────┴───────────────┤
│              组卷时间线 Timeline              │
│  ┌──选择题──┐ ┌──填空题──┐ ┌──解答题──┐      │
│  │ 1. ■■■  │ │ 1. ■■■  │ │ 1. ■■■  │      │
│  │ 2. ■■■  │ │ 2. ■■■  │ │ 2. ■■■  │      │
│  └─────────┘ └─────────┘ └─────────┘      │
└─────────────────────────────────────────────┘
```

- **素材库：** 搜索题库 → 点击添加到对应 section
- **时间线：** 按 section 组织题目 clip，支持分值编辑、锁定、删除
- **预览：** 调用 `/api/preview` 生成 PDF 实时预览
- **属性面板：** 题目属性编辑 + AI 助手快捷操作

### Review Center（/review）

执行 12 项系统检查，可视化 pass/warn/fail 报告，判定试卷是否可发布。

---

## 8. 权限系统

4 种角色，基于 cookie 的简单认证（v1）：

| 角色 | 关键权限 |
|------|---------|
| `teacher` | 查看/创建题目和试卷，导出 |
| `reviewer` | + 审核题目 |
| `librarian` | + 编辑/删除题目，导入，管理来源文档 |
| `org_admin` | + 管理用户和组织 |

---

## 9. AI Agent 设计

统一 Orchestrator，不做多 Agent UI。3 种模式：

- **推荐模式（recommend）**：生成蓝图、搜索候选、推荐替换
- **执行模式（execute）**：生成 patch diff（待实现）
- **审核模式（review）**：检查配平、知识覆盖、答案完整性

v1 使用规则匹配解析意图，后续接 LLM。

---

## 10. 启动方式

```bash
# 1. 启动 PostgreSQL
docker compose -f infra/docker/docker-compose.yml up -d

# 2. 推送数据库 schema
cd apps/web
cp .env.example .env.local
pnpm drizzle-kit push

# 3. 启动开发服务器
pnpm dev

# 访问
# http://localhost:3000/studio  — 组卷工作台
# http://localhost:3000/review  — Review Center
```

---

## 11. Git 提交历史

```
de2b6a3 Initial monorepo setup with core schema and Typst rendering pipeline
b22a5b0 Fix render-typst: solution_book mode, hiddenParts, section ordering
f292731 Add Next.js 16.2 app with question bank API and PostgreSQL
05e29ea Fix API safety: whitelist PATCH fields, recompute searchText, clamp pagination
a71d7b6 Complete steps 4-8: Studio, Agent, Review, Auth, Export ecosystem
e3b733a Fix Codex review issues: DOCX subquestions, QTI inline items, agent params, auth org dedup
```

---

## 12. 后续迭代方向

| 优先级 | 方向 |
|--------|------|
| 高 | PDF/Word 导入管线（OCR + 自动分题） |
| 高 | 接入 LLM 做 Agent 意图解析和蓝图生成 |
| 中 | Tiptap + MathLive 富文本编辑器集成 |
| 中 | Yjs 实时协作 |
| 中 | OpenSearch 全文检索替代 PostgreSQL ILIKE |
| 低 | 完整 DOCX 输出（使用 docx.js 库） |
| 低 | 模板插件市场 |
