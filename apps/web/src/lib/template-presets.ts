export const TEMPLATE_PRESET_META = [
  {
    id: 'default',
    label: '默认模板',
    description: '通用试卷版式，适合大多数演示和基础导出。',
  },
  {
    id: 'exam_standard',
    label: '考试标准卷',
    description: '更像正式考试卷，版心更稳，分区标题更突出。',
  },
  {
    id: 'practice_compact',
    label: '紧凑练习卷',
    description: '页边距更小，适合讲义、周练和课后练习。',
  },
  {
    id: 'teacher_annotated',
    label: '教师批注卷',
    description: '适合教师卷和答案版，信息密度更高。',
  },
  {
    id: 'answer_sheet',
    label: '答题卡模板',
    description: '为答题区和客观题作答留出更稳定的空间。',
  },
] as const

export const PREVIEW_MODE_META = [
  { id: 'student', label: '学生卷' },
  { id: 'teacher', label: '教师卷' },
  { id: 'answer_sheet', label: '答题卡' },
] as const

export const EXPORT_TARGETS = [
  { format: 'pdf', mode: 'student', label: '学生卷 PDF', hint: '正式打印版' },
  { format: 'pdf', mode: 'teacher', label: '教师卷 PDF', hint: '含答案与解析' },
  { format: 'pdf', mode: 'answer_sheet', label: '答题卡 PDF', hint: '适合扫描录入' },
  { format: 'typst', mode: 'student', label: '学生卷 Typst', hint: '排版源码' },
  { format: 'docx_xml', mode: 'student', label: 'DOCX XML', hint: '兼容导出底稿' },
  { format: 'qti', mode: 'student', label: 'QTI XML', hint: '测评互操作交换' },
  { format: 'json', mode: 'student', label: 'JSON AST', hint: '结构化真相源' },
] as const
