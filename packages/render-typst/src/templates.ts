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

export const DEFAULT_TEMPLATE: TemplateTokens = {
  pageMargin: '2cm',
  fontSize: '10.5pt',
  lineSpacing: '1.5em',
  questionNumberStyle: 'arabic',
  sectionTitleStyle: 'bold',
  optionLayout: 'horizontal-4',
  answerAreaSize: { s: '2cm', m: '5cm', l: '10cm' },
}
