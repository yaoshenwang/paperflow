#set page(margin: 2cm, header: [
  #align(center)[*高一数学期中测试卷*]
], footer: [
  #align(center)[#context counter(page).display()]
])
#set text(size: 10.5pt)
#set par(leading: 1.5em)

#align(center)[#text(size: 16pt, weight: "bold")[高一数学期中测试卷]]

#v(1em)
== *一、选择题（每小题5分）*

*1.* （5分） 函数 $f(x) = sqrt(x - 1)$ 的定义域是

#grid(columns: (1fr, 1fr, 1fr, 1fr), [A. $[1, +infinity)$], [B. $(1, +infinity)$], [C. $(-infinity, 1]$], [D. $(-infinity, 1)$])

#block(fill: luma(240), inset: 8pt, radius: 4pt)[*答案：* A]

#block(inset: 8pt)[_解析：_ 要使 $sqrt(x - 1)$ 有意义，需 $x - 1 >= 0$，即 $x >= 1$。故选A。]

== *二、填空题（每小题5分）*

*2.* （5分） $sin 30degree + cos 60degree$ = ________。

#block(fill: luma(240), inset: 8pt, radius: 4pt)[*答案：* $1$]

#block(inset: 8pt)[_解析：_ $sin 30degree = 1/2$，$cos 60degree = 1/2$，故原式 $= 1/2 + 1/2 = 1$。]

== *三、解答题（共20分）*

*3.* （20分） 已知函数 $f(x) = x^2 - 2x + 3$。

（1）求函数 $f(x)$ 的最小值；

（2）判断 $f(x)$ 在 $[1, +infinity)$ 上的单调性，并证明。

#block(fill: luma(240), inset: 8pt, radius: 4pt)[*答案：* （1）$f(x) = (x-1)^2 + 2$，当 $x = 1$ 时取最小值 $f(1) = 2$。

（2）$f(x)$ 在 $[1, +infinity)$ 上单调递增。]

#block(inset: 8pt)[_解析：_ 配方法可得 $f(x) = (x-1)^2 + 2$，顶点为 $(1, 2)$。对于单调性证明，取 $x_1 > x_2 >= 1$，则 $f(x_1) - f(x_2) = (x_1 - x_2)(x_1 + x_2 - 2) > 0$。]
