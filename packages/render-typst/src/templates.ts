/** 模板 design tokens */
export type TemplateTokens = {
  pageMargin: string
  fontSize: string
  lineSpacing: string
  titleSize: string
  titleAlign: 'left' | 'center'
  titleDecoration: 'none' | 'double-rule' | 'banner'
  titleDecorationFill: string
  headerLeft?: string
  headerCenter?: string
  headerRight?: string
  footerCenter?: string
  questionNumberStyle: 'arabic' | 'chinese'
  sectionTitleStyle: 'bold' | 'underline' | 'boxed'
  sectionTone: string
  optionLayout: 'vertical' | 'horizontal-2' | 'horizontal-4'
  questionGap: string
  sectionGap: string
  scoreStyle: 'inline' | 'pill'
  scorePillFill: string
  answerBlockStyle: 'soft-fill' | 'outline'
  answerBlockTone: string
  analysisBlockStyle: 'plain' | 'soft-fill'
  analysisBlockTone: string
  answerSheetBubbleGap: string
  answerSheetBubbleRadius: string
  answerSheetBubbleStroke: string
  answerAreaSize: Record<'s' | 'm' | 'l', string>
}

export type TemplatePresetId = 'default' | 'exam_standard' | 'practice_compact' | 'teacher_annotated' | 'answer_sheet'

export const TEMPLATE_PRESETS: Record<TemplatePresetId, TemplateTokens> = {
  default: {
    pageMargin: '2cm',
    fontSize: '10.5pt',
    lineSpacing: '1.5em',
    titleSize: '16pt',
    titleAlign: 'center',
    titleDecoration: 'none',
    titleDecorationFill: 'luma(242)',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'bold',
    sectionTone: 'luma(244)',
    optionLayout: 'horizontal-4',
    questionGap: '1.1em',
    sectionGap: '0.85em',
    scoreStyle: 'inline',
    scorePillFill: 'luma(236)',
    answerBlockStyle: 'soft-fill',
    answerBlockTone: 'luma(240)',
    analysisBlockStyle: 'plain',
    analysisBlockTone: 'luma(247)',
    answerSheetBubbleGap: '0.9em',
    answerSheetBubbleRadius: '999pt',
    answerSheetBubbleStroke: '0.7pt + luma(180)',
    answerAreaSize: { s: '2cm', m: '5cm', l: '10cm' },
  },
  exam_standard: {
    pageMargin: '2.2cm',
    fontSize: '10.5pt',
    lineSpacing: '1.6em',
    titleSize: '18pt',
    titleAlign: 'center',
    titleDecoration: 'double-rule',
    titleDecorationFill: 'luma(242)',
    headerLeft: 'Paperflow',
    questionNumberStyle: 'chinese',
    sectionTitleStyle: 'bold',
    sectionTone: 'luma(242)',
    optionLayout: 'horizontal-4',
    questionGap: '1.2em',
    sectionGap: '1em',
    scoreStyle: 'pill',
    scorePillFill: 'luma(232)',
    answerBlockStyle: 'soft-fill',
    answerBlockTone: 'luma(238)',
    analysisBlockStyle: 'soft-fill',
    analysisBlockTone: 'luma(245)',
    answerSheetBubbleGap: '1em',
    answerSheetBubbleRadius: '6pt',
    answerSheetBubbleStroke: '0.8pt + luma(170)',
    answerAreaSize: { s: '2.5cm', m: '5.5cm', l: '10.5cm' },
  },
  practice_compact: {
    pageMargin: '1.6cm',
    fontSize: '10pt',
    lineSpacing: '1.35em',
    titleSize: '15pt',
    titleAlign: 'left',
    titleDecoration: 'none',
    titleDecorationFill: 'luma(244)',
    headerLeft: '随堂练习',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'underline',
    sectionTone: 'luma(242)',
    optionLayout: 'horizontal-4',
    questionGap: '0.65em',
    sectionGap: '0.6em',
    scoreStyle: 'inline',
    scorePillFill: 'luma(236)',
    answerBlockStyle: 'outline',
    answerBlockTone: 'luma(170)',
    analysisBlockStyle: 'plain',
    analysisBlockTone: 'luma(246)',
    answerSheetBubbleGap: '0.6em',
    answerSheetBubbleRadius: '4pt',
    answerSheetBubbleStroke: '0.6pt + luma(185)',
    answerAreaSize: { s: '1.5cm', m: '4cm', l: '8cm' },
  },
  teacher_annotated: {
    pageMargin: '2cm',
    fontSize: '10.5pt',
    lineSpacing: '1.55em',
    titleSize: '16.5pt',
    titleAlign: 'left',
    titleDecoration: 'banner',
    titleDecorationFill: 'luma(235)',
    headerLeft: '教师用卷',
    headerRight: '含答案与解析',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'boxed',
    sectionTone: 'luma(239)',
    optionLayout: 'vertical',
    questionGap: '1.25em',
    sectionGap: '0.95em',
    scoreStyle: 'pill',
    scorePillFill: 'luma(228)',
    answerBlockStyle: 'outline',
    answerBlockTone: 'luma(145)',
    analysisBlockStyle: 'soft-fill',
    analysisBlockTone: 'luma(241)',
    answerSheetBubbleGap: '0.8em',
    answerSheetBubbleRadius: '5pt',
    answerSheetBubbleStroke: '0.8pt + luma(150)',
    answerAreaSize: { s: '2cm', m: '5cm', l: '10cm' },
  },
  answer_sheet: {
    pageMargin: '1.8cm',
    fontSize: '10pt',
    lineSpacing: '1.8em',
    titleSize: '17pt',
    titleAlign: 'center',
    titleDecoration: 'banner',
    titleDecorationFill: 'luma(242)',
    headerLeft: '答题卡',
    questionNumberStyle: 'arabic',
    sectionTitleStyle: 'boxed',
    sectionTone: 'luma(245)',
    optionLayout: 'horizontal-4',
    questionGap: '0.9em',
    sectionGap: '0.8em',
    scoreStyle: 'inline',
    scorePillFill: 'luma(236)',
    answerBlockStyle: 'soft-fill',
    answerBlockTone: 'luma(240)',
    analysisBlockStyle: 'plain',
    analysisBlockTone: 'luma(247)',
    answerSheetBubbleGap: '0.7em',
    answerSheetBubbleRadius: '4pt',
    answerSheetBubbleStroke: '1pt + luma(120)',
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
