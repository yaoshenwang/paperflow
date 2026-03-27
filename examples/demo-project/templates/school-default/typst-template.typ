#let paperflow_exam(
  title: none,
  subject: none,
  grade: none,
  margin: (x: 2.2cm, y: 2.4cm),
  paper: "a4",
  fontsize: 11pt,
  linestretch: 1.45,
  pagenumbering: none,
  doc,
) = {
  let meta-line = if subject != none and grade != none {
    [#subject · #grade]
  } else if subject != none {
    [#subject]
  } else if grade != none {
    [#grade]
  } else {
    none
  }

  set page(
    paper: paper,
    margin: margin,
    numbering: pagenumbering,
  )
  set text(size: fontsize)
  set par(
    justify: false,
    leading: linestretch * 0.7em,
  )
  set heading(numbering: none)

  show heading.where(level: 1): it => block(
    above: 1.2em,
    below: 0.7em,
    fill: luma(245),
    inset: (x: 0.75em, y: 0.45em),
    radius: 6pt,
  )[
    #text(weight: "bold")[#it.body]
  ]

  if title != none {
    align(center)[
      #block(below: 1.5em)[
        #text(weight: "bold", size: 1.55em)[#title]
        #if meta-line != none {
          parbreak()
          text(size: 0.95em, fill: luma(40%))[#meta-line]
        }
      ]
    ]
  }

  doc
}
