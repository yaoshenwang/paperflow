/** 模板 design tokens */
export type TemplateTokens = {
  pageMargin: string
  fontSize: string
  lineSpacing: string
  headerLeft?: string
  headerCenter?: string
  headerRight?: string
  footerCenter?: string
  questionNumberStyle: 'arabic' | 'chinese'
  sectionTitleStyle: 'bold' | 'underline'
  optionLayout: 'vertical' | 'horizontal-2' | 'horizontal-4'
  answerAreaSize: Record<'s' | 'm' | 'l', string>
}

export type TemplatePresetId = 'default' | 'exam_standard' | 'practice_compact' | 'teacher_annotated' | 'answer_sheet'

export const TEMPLATE_PRESETS: Record<TemplatePresetId, TemplateTokens> = {
  default: {
    pageMargin: '2cm',
    fontSize: '10.5pt',
    lineSpacing: '1.5em',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'bold',
    optionLayout: 'horizontal-4',
    answerAreaSize: { s: '2cm', m: '5cm', l: '10cm' },
  },
  exam_standard: {
    pageMargin: '2.2cm',
    fontSize: '10.5pt',
    lineSpacing: '1.6em',
    headerLeft: 'Paperflow',
    questionNumberStyle: 'chinese',
    sectionTitleStyle: 'bold',
    optionLayout: 'horizontal-4',
    answerAreaSize: { s: '2.5cm', m: '5.5cm', l: '10.5cm' },
  },
  practice_compact: {
    pageMargin: '1.6cm',
    fontSize: '10pt',
    lineSpacing: '1.35em',
    headerLeft: '随堂练习',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'underline',
    optionLayout: 'horizontal-4',
    answerAreaSize: { s: '1.5cm', m: '4cm', l: '8cm' },
  },
  teacher_annotated: {
    pageMargin: '2cm',
    fontSize: '10.5pt',
    lineSpacing: '1.55em',
    headerLeft: '教师用卷',
    headerRight: '含答案与解析',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'bold',
    optionLayout: 'vertical',
    answerAreaSize: { s: '2cm', m: '5cm', l: '10cm' },
  },
  answer_sheet: {
    pageMargin: '1.8cm',
    fontSize: '10pt',
    lineSpacing: '1.8em',
    headerLeft: '答题卡',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'bold',
    optionLayout: 'horizontal-4',
    answerAreaSize: { s: '2.5cm', m: '6cm', l: '12cm' },
  },
}

export const DEFAULT_TEMPLATE: TemplateTokens = TEMPLATE_PRESETS.default

export function resolveTemplatePreset(preset?: string): TemplateTokens {
  if (preset && preset in TEMPLATE_PRESETS) {
    return TEMPLATE_PRESETS[preset as TemplatePresetId]
  }

  return DEFAULT_TEMPLATE
}
