import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { toApiErrorResponse } from '@/lib/api/errors'

/**
 * Agent Orchestrator API
 *
 * POST /api/agent
 * Body: { action, params }
 *
 * Actions:
 *   create_blueprint  — 从自然语言意图生成组卷蓝图
 *   search_items      — 根据蓝图搜索候选题目
 *   check_balance     — 检查难度/知识点分布平衡
 *   suggest_replace   — 推荐替换题目
 *   review_paper      — 审核试卷完整性
 */
export async function POST(request: NextRequest) {
  try {
    const { action, params } = await request.json()

    switch (action) {
      case 'create_blueprint':
        return await handleCreateBlueprint(params)
      case 'search_items':
        return await handleSearchItems(params)
      case 'check_balance':
        return await handleCheckBalance(params)
      case 'suggest_replace':
        return await handleSuggestReplace(params)
      case 'review_paper':
        return await handleReviewPaper(params)
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return toApiErrorResponse(error, '题库 Agent 服务暂不可用，请先确认 PostgreSQL 已启动。')
  }
}

/** 从自然语言意图生成组卷蓝图 */
async function handleCreateBlueprint(params: { intent: string }) {
  // 解析意图中的关键信息（v1 用规则匹配，后续接 LLM）
  const intent = params.intent

  const subjectMatch = intent.match(/(数学|语文|英语|物理|化学|生物|历史|地理|政治)/)
  const gradeMatch = intent.match(/(高一|高二|高三|初一|初二|初三)/)
  const scoreMatch = intent.match(/(\d+)\s*分/)
  const durationMatch = intent.match(/(\d+)\s*分钟/)

  // 解析题型结构
  const choiceMatch = intent.match(/选择题?\s*(\d+)\s*道/)
  const fillMatch = intent.match(/填空题?\s*(\d+)\s*道/)
  const answerMatch = intent.match(/(解答|计算)题?\s*(\d+)\s*道/)

  // 解析难度分布
  const diffMatch = intent.match(/难度\s*(\d+)\s*[:：]\s*(\d+)\s*[:：]\s*(\d+)/)

  const sections = []
  if (choiceMatch) {
    sections.push({
      questionType: 'single_choice',
      count: Number(choiceMatch[1]),
      scorePerItem: 5,
    })
  }
  if (fillMatch) {
    sections.push({
      questionType: 'fill_blank',
      count: Number(fillMatch[1]),
      scorePerItem: 5,
    })
  }
  if (answerMatch) {
    sections.push({
      questionType: 'computation',
      count: Number(answerMatch[2]),
      scorePerItem: 10,
    })
  }

  // 如果没有匹配到任何题型，给出默认结构
  if (sections.length === 0) {
    sections.push(
      { questionType: 'single_choice', count: 10, scorePerItem: 5 },
      { questionType: 'fill_blank', count: 4, scorePerItem: 5 },
      { questionType: 'computation', count: 5, scorePerItem: 12 },
    )
  }

  const blueprint = {
    subject: subjectMatch?.[1] ?? '数学',
    grade: gradeMatch?.[1] ?? '高一',
    totalScore: scoreMatch ? Number(scoreMatch[1]) : sections.reduce((s, sec) => s + sec.count * sec.scorePerItem, 0),
    duration: durationMatch ? Number(durationMatch[1]) : 120,
    sections,
    difficultyDistribution: diffMatch
      ? {
          easy: Number(diffMatch[1]) / (Number(diffMatch[1]) + Number(diffMatch[2]) + Number(diffMatch[3])),
          medium: Number(diffMatch[2]) / (Number(diffMatch[1]) + Number(diffMatch[2]) + Number(diffMatch[3])),
          hard: Number(diffMatch[3]) / (Number(diffMatch[1]) + Number(diffMatch[2]) + Number(diffMatch[3])),
        }
      : { easy: 0.6, medium: 0.3, hard: 0.1 },
  }

  return Response.json({
    mode: 'recommend',
    blueprint,
    explanation: `已根据您的需求生成组卷蓝图：${blueprint.subject} ${blueprint.grade}，总分 ${blueprint.totalScore}，共 ${sections.reduce((s, sec) => s + sec.count, 0)} 道题。`,
  })
}

/** 根据蓝图搜索候选题目 */
async function handleSearchItems(params: {
  subject?: string
  grade?: string
  questionType?: string
  difficulty?: { min: number; max: number }
  limit?: number
}) {
  const conditions = []

  if (params.subject) {
    conditions.push(eq(questionItems.subject, params.subject))
  }
  if (params.grade) {
    conditions.push(eq(questionItems.grade, params.grade))
  }
  if (params.questionType) {
    conditions.push(eq(questionItems.questionType, params.questionType as typeof questionItems.questionType.enumValues[number]))
  }
  if (params.difficulty) {
    conditions.push(sql`${questionItems.difficulty} >= ${params.difficulty.min}`)
    conditions.push(sql`${questionItems.difficulty} <= ${params.difficulty.max}`)
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const items = await db
    .select()
    .from(questionItems)
    .where(where)
    .limit(params.limit ?? 20)

  return Response.json({
    mode: 'recommend',
    candidates: items,
    explanation: `找到 ${items.length} 道候选题目。`,
  })
}

/** 检查难度/知识点分布平衡 */
async function handleCheckBalance(params: {
  clips: Array<{ questionItemId: string; score: number }>
  targetDifficulty?: { easy: number; medium: number; hard: number }
}) {
  const itemIds = params.clips.map((c) => c.questionItemId)
  if (itemIds.length === 0) {
    return Response.json({ mode: 'review', issues: [], explanation: '没有题目可检查。' })
  }

  const items = await db.select().from(questionItems).where(
    sql`${questionItems.id} = ANY(${itemIds})`,
  )

  const issues: string[] = []

  // 检查难度分布
  const difficulties = items.map((i) => i.difficulty).filter((d): d is number => d != null)
  if (difficulties.length > 0) {
    const avg = difficulties.reduce((s, d) => s + d, 0) / difficulties.length
    if (avg < 0.3) issues.push(`整体难度偏低（平均 ${(avg * 10).toFixed(1)}/10），建议增加中等难度题目`)
    if (avg > 0.7) issues.push(`整体难度偏高（平均 ${(avg * 10).toFixed(1)}/10），建议增加基础题目`)
  }

  // 检查知识点覆盖
  const allKnowledge = new Set(items.flatMap((i) => i.knowledgeIds ?? []))
  if (allKnowledge.size < 3 && items.length > 5) {
    issues.push(`知识点覆盖较少（仅 ${allKnowledge.size} 个），建议增加知识点多样性`)
  }

  // 检查答案完整性
  const unanswered = items.filter((i) => !i.answerVerified)
  if (unanswered.length > 0) {
    issues.push(`${unanswered.length} 道题目答案未验证`)
  }

  return Response.json({
    mode: 'review',
    issues,
    stats: {
      totalItems: items.length,
      avgDifficulty: difficulties.length > 0 ? difficulties.reduce((s, d) => s + d, 0) / difficulties.length : null,
      knowledgeCoverage: allKnowledge.size,
      answeredCount: items.filter((i) => i.answerVerified).length,
    },
    explanation: issues.length === 0 ? '试卷配平状态良好！' : `发现 ${issues.length} 个问题需要关注。`,
  })
}

/** 推荐替换题目 */
async function handleSuggestReplace(params: {
  questionItemId: string
  reason?: string
}) {
  // 获取原题信息
  const [original] = await db
    .select()
    .from(questionItems)
    .where(eq(questionItems.id, params.questionItemId))
    .limit(1)

  if (!original) {
    return Response.json({ mode: 'recommend', candidates: [], explanation: '未找到原题目。' })
  }

  // 搜索相同题型和学科的替换候选
  const candidates = await db
    .select()
    .from(questionItems)
    .where(
      and(
        eq(questionItems.subject, original.subject),
        eq(questionItems.grade, original.grade),
        eq(questionItems.questionType, original.questionType),
        sql`${questionItems.id} != ${original.id}`,
      ),
    )
    .limit(5)

  return Response.json({
    mode: 'recommend',
    candidates,
    explanation: `为「${original.sourceLabel}」找到 ${candidates.length} 道可替换题目（相同题型: ${original.questionType}）。`,
  })
}

/** 审核试卷完整性 */
async function handleReviewPaper(params: {
  clips: Array<{ questionItemId: string; score: number; hiddenParts: string[] }>
}) {
  const itemIds = params.clips.map((c) => c.questionItemId)
  if (itemIds.length === 0) {
    return Response.json({ mode: 'review', checks: [], explanation: '空试卷，无法审核。' })
  }

  const items = await db.select().from(questionItems).where(
    sql`${questionItems.id} = ANY(${itemIds})`,
  )

  const checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; detail: string }> = []

  // 1. 来源完整性
  const noSource = items.filter((i) => !i.sourceLabel)
  checks.push({
    name: '来源完整性',
    status: noSource.length === 0 ? 'pass' : 'fail',
    detail: noSource.length === 0 ? '所有题目均有来源' : `${noSource.length} 道题缺少来源信息`,
  })

  // 2. 审核状态
  const unapproved = items.filter((i) => !['approved', 'published'].includes(i.reviewStatus))
  checks.push({
    name: '审核状态',
    status: unapproved.length === 0 ? 'pass' : 'warn',
    detail: unapproved.length === 0 ? '所有题目均已审核' : `${unapproved.length} 道题未通过审核`,
  })

  // 3. 答案完整性
  const noAnswer = items.filter((i) => {
    const content = i.content as { answer?: unknown[] }
    return !content.answer || content.answer.length === 0
  })
  checks.push({
    name: '答案完整性',
    status: noAnswer.length === 0 ? 'pass' : 'warn',
    detail: noAnswer.length === 0 ? '所有题目均有答案' : `${noAnswer.length} 道题缺少答案`,
  })

  // 4. 版权状态
  const restricted = items.filter((i) => ['restricted', 'prohibited'].includes(i.rightsStatus))
  checks.push({
    name: '版权状态',
    status: restricted.length === 0 ? 'pass' : 'fail',
    detail: restricted.length === 0 ? '所有题目版权合规' : `${restricted.length} 道题存在版权限制`,
  })

  // 5. 总分检查
  const totalScore = params.clips.reduce((s, c) => s + c.score, 0)
  checks.push({
    name: '总分设置',
    status: totalScore > 0 ? 'pass' : 'warn',
    detail: `总分 ${totalScore} 分`,
  })

  const passCount = checks.filter((c) => c.status === 'pass').length
  const explanation = `审核完成：${passCount}/${checks.length} 项通过。`

  return Response.json({ mode: 'review', checks, explanation })
}
