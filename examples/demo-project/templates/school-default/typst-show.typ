#show: doc => paperflow_exam(
$if(title)$
  title: [$title$],
$endif$
$if(subject)$
  subject: [$subject$],
$endif$
$if(grade)$
  grade: [$grade$],
$endif$
$if(papersize)$
  paper: "$papersize$",
$endif$
$if(margin)$
  margin: ($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$),
$endif$
$if(fontsize)$
  fontsize: $fontsize$,
$endif$
$if(linestretch)$
  linestretch: $linestretch$,
$endif$
  pagenumbering: $if(page-numbering)$"$page-numbering$"$else$none$endif$,
  doc,
)
