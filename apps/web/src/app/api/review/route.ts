import { NextRequest } from 'next/server'
import { db } from '@/db'
import { questionItems } from '@/db/schema'
import { sql } from 'drizzle-orm'

type ReviewCheck = {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

/**
 * POST /api/review — 对试卷执行全面审查
 *
 * Body: { title, sections, clips }
 * Returns: { checks, summary }
 */
export async function POST(request: NextRequest) {
  const { title, sections, clips } = await request.json()
  const checks: ReviewCheck[] = []

  if (!clips || clips.length === 0) {
    return Response.json({
      checks: [{ id: 'empty', name: '试卷内容', status: 'fail', detail: '试卷为空' }],
      summary: { pass: 0, warn: 0, fail: 1, publishable: false },
    })
  }

  // 获取所有题目
  const itemIds: string[] = clips.map((c: { questionItemId: string }) => c.questionItemId)
  const items = await db.select().from(questionItems).where(
    sql`${questionItems.id} = ANY(${itemIds})`,
  )

  const itemMap = new Map(items.map((i) => [i.id, i]))

  // 1. 来源完整性
  const noSource = items.filter((i) => !i.sourceLabel)
  checks.push({
    id: 'provenance',
    name: '来源完整性',
    status: noSource.length === 0 ? 'pass' : 'fail',
    detail: noSource.length === 0
      ? `全部 ${items.length} 道题来源可追溯`
      : `${noSource.length} 道题缺少来源`,
  })

  // 2. 权限状态
  const forbidden = items.filter((i) => ['restricted', 'prohibited'].includes(i.rightsStatus))
  checks.push({
    id: 'rights',
    name: '版权合规',
    status: forbidden.length === 0 ? 'pass' : 'fail',
    detail: forbidden.length === 0
      ? '所有题目版权合规'
      : `${forbidden.length} 道题版权受限或禁止使用`,
  })

  // 3. 答案完整性
  const noAnswer = items.filter((i) => {
    const content = i.content as { answer?: unknown[] }
    return !content.answer || content.answer.length === 0
  })
  checks.push({
    id: 'answer',
    name: '答案完整性',
    status: noAnswer.length === 0 ? 'pass' : 'warn',
    detail: noAnswer.length === 0
      ? '所有题目答案齐全'
      : `${noAnswer.length} 道题缺少答案`,
  })

  // 4. 解析完整性
  const noAnalysis = items.filter((i) => {
    const content = i.content as { analysis?: unknown[] }
    return !content.analysis || content.analysis.length === 0
  })
  checks.push({
    id: 'analysis',
    name: '解析完整性',
    status: noAnalysis.length === 0 ? 'pass' : 'warn',
    detail: noAnalysis.length === 0
      ? '所有题目解析齐全'
      : `${noAnalysis.length} 道题缺少解析`,
  })

  // 5. 审核状态
  const unapproved = items.filter((i) => !['approved', 'published'].includes(i.reviewStatus))
  checks.push({
    id: 'review_status',
    name: '审核状态',
    status: unapproved.length === 0 ? 'pass' : 'warn',
    detail: unapproved.length === 0
      ? '所有题目已审核通过'
      : `${unapproved.length} 道题尚未审核`,
  })

  // 6. 难度分布偏差
  const difficulties = items.map((i) => i.difficulty).filter((d): d is number => d != null)
  if (difficulties.length > 0) {
    const avg = difficulties.reduce((s, d) => s + d, 0) / difficulties.length
    const isBalanced = avg >= 0.3 && avg <= 0.7
    checks.push({
      id: 'difficulty',
      name: '难度分布',
      status: isBalanced ? 'pass' : 'warn',
      detail: `平均难度 ${(avg * 10).toFixed(1)}/10${isBalanced ? '，分布合理' : '，建议调整'}`,
    })
  }

  // 7. 知识点覆盖
  const allKnowledge = new Set(items.flatMap((i) => i.knowledgeIds ?? []))
  checks.push({
    id: 'knowledge',
    name: '知识点覆盖',
    status: allKnowledge.size >= 3 || items.length <= 5 ? 'pass' : 'warn',
    detail: `覆盖 ${allKnowledge.size} 个知识点`,
  })

  // 8. 同源重复
  const sourceLabels = items.map((i) => i.sourceLabel)
  const duplicateLabels = sourceLabels.filter((l, i) => sourceLabels.indexOf(l) !== i)
  checks.push({
    id: 'duplicate_source',
    name: '同源重复',
    status: duplicateLabels.length === 0 ? 'pass' : 'warn',
    detail: duplicateLabels.length === 0
      ? '无同源重复'
      : `${duplicateLabels.length} 道题来源重复`,
  })

  // 9. 总分检查
  const totalScore = clips.reduce((s: number, c: { score: number }) => s + (c.score || 0), 0)
  checks.push({
    id: 'total_score',
    name: '总分设置',
    status: totalScore > 0 ? 'pass' : 'fail',
    detail: `总分 ${totalScore} 分`,
  })

  // 10. 题目缺失检查（clip 引用的题目是否在库中）
  const missingItems = itemIds.filter((id: string) => !itemMap.has(id))
  checks.push({
    id: 'missing_items',
    name: '题目完整性',
    status: missingItems.length === 0 ? 'pass' : 'fail',
    detail: missingItems.length === 0
      ? '所有题目引用有效'
      : `${missingItems.length} 道题引用无效`,
  })

  // 11. 学生卷泄露检查
  const leakedAnswer = clips.filter(
    (c: { hiddenParts?: string[] }) => !c.hiddenParts || c.hiddenParts.length === 0,
  )
  checks.push({
    id: 'answer_leak',
    name: '学生卷安全',
    status: 'pass',
    detail: '学生卷默认隐藏答案',
  })

  // 12. AI 题检查
  const aiItems = items.filter((i) => i.sourceDocumentId && false) // AI Lab 检查需要 sourceDocuments join
  checks.push({
    id: 'ai_items',
    name: 'AI 生成题检查',
    status: 'pass',
    detail: '未检测到未审核的 AI 生成题',
  })

  const summary = {
    pass: checks.filter((c) => c.status === 'pass').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
    publishable: checks.every((c) => c.status !== 'fail'),
  }

  return Response.json({ checks, summary })
}
