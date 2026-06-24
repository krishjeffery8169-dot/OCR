﻿param(
  [Parameter(Mandatory=$true)]
  [string]$ConfigPath,

  [string]$SourceDocx,

  [string]$OutRoot
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function HtmlEncode([string]$s) {
  return [System.Net.WebUtility]::HtmlEncode($s)
}

function SafeName([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return "未分类" }
  return (($s -replace '[\\/:*?"<>|\s]+','_') -replace '_+','_').Trim('_')
}

function FormatQid([string]$qid) {
  $raw = $qid -replace '^Q',''
  if ($raw -match '-') {
    $p = $raw -split '-'
    return ("Q{0:D2}-{1:D2}" -f [int]$p[0],[int]$p[1])
  }
  return ("Q{0:D2}" -f [int]$raw)
}

function Get-QidRange([string]$qid) {
  $raw = $qid -replace '^Q',''
  if ($raw -match '-') {
    $p = $raw -split '-'
    return @{ Start=[int]$p[0]; End=[int]$p[1] }
  }
  $n = [int]$raw
  return @{ Start=$n; End=$n }
}

function Require-Value($value, [string]$name) {
  if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) {
    throw "配置缺少必填字段：$name"
  }
}

function Trim-WhiteImage([string]$InputPath, [string]$OutputPath) {
  $bmp = [System.Drawing.Bitmap]::FromFile($InputPath)
  try {
    $w=$bmp.Width; $h=$bmp.Height
    $minX=$w; $minY=$h; $maxX=0; $maxY=0
    for($y=0;$y -lt $h;$y+=3){
      for($x=0;$x -lt $w;$x+=3){
        $c=$bmp.GetPixel($x,$y)
        if(!(($c.R -gt 248) -and ($c.G -gt 248) -and ($c.B -gt 248))){
          if($x -lt $minX){$minX=$x}; if($x -gt $maxX){$maxX=$x}
          if($y -lt $minY){$minY=$y}; if($y -gt $maxY){$maxY=$y}
        }
      }
    }
    if($maxX -le $minX -or $maxY -le $minY){ throw "未检测到内容区域" }
    $pad=30
    $minX=[Math]::Max(0,$minX-$pad); $minY=[Math]::Max(0,$minY-$pad)
    $maxX=[Math]::Min($w-1,$maxX+$pad); $maxY=[Math]::Min($h-1,$maxY+$pad)
    $rect=New-Object System.Drawing.Rectangle $minX,$minY,($maxX-$minX+1),($maxY-$minY+1)
    $crop=New-Object System.Drawing.Bitmap $rect.Width,$rect.Height
    $g=[System.Drawing.Graphics]::FromImage($crop)
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($bmp,0,0,$rect,[System.Drawing.GraphicsUnit]::Pixel)
    $tmp=Join-Path $env:TEMP ("trim_"+[guid]::NewGuid().ToString("N")+".png")
    $crop.Save($tmp,[System.Drawing.Imaging.ImageFormat]::Png)
    Copy-Item $tmp $OutputPath -Force
    Remove-Item $tmp -Force
    $g.Dispose(); $crop.Dispose()
  } finally {
    $bmp.Dispose()
  }
}

function Save-WordRangeImage([string]$SourceDocx, $items, [int]$start, [int]$endExclusive, [string]$OutputPath, [string]$PowershellExe) {
  if($start -lt 0 -or $endExclusive -le $start){ throw "Word 原版式截图范围无效" }
  if($endExclusive -gt $items.Count){ $endExclusive = $items.Count }

  $startPara = [int]$items[$start].Index + 1
  $endPara = [int]$items[$endExclusive - 1].Index + 1
  if($startPara -lt 1 -or $endPara -lt $startPara){ throw "Word 段落范围无效" }

  $childScript = Join-Path $env:TEMP ("word_range_capture_"+[guid]::NewGuid().ToString("N")+".ps1")
  $rawPath = Join-Path $env:TEMP ("word_range_capture_"+[guid]::NewGuid().ToString("N")+".png")
  $script = @'
param(
  [string]$SourceDocx,
  [int]$StartPara,
  [int]$EndPara,
  [string]$OutputPath
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$wordApp = $null
$wordDoc = $null
try {
  $wordApp = New-Object -ComObject Word.Application
  $wordApp.Visible = $false
  $wordApp.DisplayAlerts = 0
  $wordDoc = $wordApp.Documents.Open($SourceDocx, $false, $true)
  $rangeStart = $wordDoc.Paragraphs.Item($StartPara).Range.Start
  $rangeEnd = $wordDoc.Paragraphs.Item($EndPara).Range.End
  $range = $wordDoc.Range($rangeStart, $rangeEnd)
  $range.CopyAsPicture()
  Start-Sleep -Milliseconds 1200

  $data = [System.Windows.Forms.Clipboard]::GetDataObject()
  $emf = $null
  if($null -ne $data){
    $emf = $data.GetData("EnhancedMetafile")
  }

  if($null -ne $emf){
    $metafile = New-Object System.Drawing.Imaging.Metafile($emf)
    try {
      $width = [Math]::Max(1200, [int]($metafile.Width * 2.6))
      $height = [Math]::Max(900, [int]($metafile.Height * 2.6))
      $bmp = New-Object System.Drawing.Bitmap $width, $height
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.Clear([System.Drawing.Color]::White)
      $g.DrawImage($metafile, 0, 0, $width, $height)
      $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $g.Dispose(); $bmp.Dispose()
    } finally {
      $metafile.Dispose()
      $emf.Dispose()
    }
  } else {
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if($null -eq $img){ throw "Word 原版式截图失败：剪贴板未生成图片" }
    $img.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
  }
} finally {
  if($null -ne $wordDoc){ $wordDoc.Close($false) }
  if($null -ne $wordApp){ $wordApp.Quit() }
}
'@
  [System.IO.File]::WriteAllText($childScript, $script, [System.Text.UTF8Encoding]::new($true))
  try {
    $childOutput = & $PowershellExe -STA -NoProfile -ExecutionPolicy Bypass -File $childScript -SourceDocx $SourceDocx -StartPara $startPara -EndPara $endPara -OutputPath $rawPath 2>&1
    if($LASTEXITCODE -ne 0 -or !(Test-Path $rawPath)){
      throw "Word 子进程截图失败：$childOutput"
    }
    Trim-WhiteImage $rawPath $OutputPath
  } finally {
    Remove-Item $childScript -Force -ErrorAction SilentlyContinue
    Remove-Item $rawPath -Force -ErrorAction SilentlyContinue
  }
}

function Export-WordRangeHtml([string]$SourceDocx, $items, [int]$start, [int]$endExclusive, [string]$HtmlPath, [string]$PowershellExe) {
  if($start -lt 0 -or $endExclusive -le $start){ throw "Word 保留格式导出范围无效" }
  if($endExclusive -gt $items.Count){ $endExclusive = $items.Count }

  $startPara = [int]$items[$start].Index + 1
  $endPara = [int]$items[$endExclusive - 1].Index + 1
  if($startPara -lt 1 -or $endPara -lt $startPara){ throw "Word 段落范围无效" }

  $childScript = Join-Path $env:TEMP ("word_range_html_"+[guid]::NewGuid().ToString("N")+".ps1")
  $script = @'
param(
  [string]$SourceDocx,
  [int]$StartPara,
  [int]$EndPara,
  [string]$HtmlPath
)
$ErrorActionPreference = "Stop"
$wordApp = $null
$wordDoc = $null
$newDoc = $null
try {
  $wordApp = New-Object -ComObject Word.Application
  $wordApp.Visible = $false
  $wordApp.DisplayAlerts = 0
  $wordDoc = $wordApp.Documents.Open($SourceDocx, $false, $true)
  $rangeStart = $wordDoc.Paragraphs.Item($StartPara).Range.Start
  $rangeEnd = $wordDoc.Paragraphs.Item($EndPara).Range.End
  $range = $wordDoc.Range($rangeStart, $rangeEnd)
  $newDoc = $wordApp.Documents.Add()
  $newDoc.Range().FormattedText = $range.FormattedText
  $newDoc.SaveAs2($HtmlPath, 10)
} finally {
  if($null -ne $newDoc){ $newDoc.Close($false) }
  if($null -ne $wordDoc){ $wordDoc.Close($false) }
  if($null -ne $wordApp){ $wordApp.Quit() }
}
'@
  [System.IO.File]::WriteAllText($childScript, $script, [System.Text.UTF8Encoding]::new($true))
  try {
    $lastError = ""
    for($attempt=1; $attempt -le 3; $attempt++){
      Remove-Item $HtmlPath -Force -ErrorAction SilentlyContinue
      $stdoutPath = Join-Path $env:TEMP ("word_range_html_out_"+[guid]::NewGuid().ToString("N")+".txt")
      $stderrPath = Join-Path $env:TEMP ("word_range_html_err_"+[guid]::NewGuid().ToString("N")+".txt")
      $args = @("-STA","-NoProfile","-ExecutionPolicy","Bypass","-File",$childScript,"-SourceDocx",$SourceDocx,"-StartPara",$startPara,"-EndPara",$endPara,"-HtmlPath",$HtmlPath)
      $beforeWordIds = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
      $p = Start-Process -FilePath $PowershellExe -ArgumentList $args -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
      if(-not $p.WaitForExit(15000)){
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $beforeWordIds -notcontains $_.Id } | Stop-Process -Force -ErrorAction SilentlyContinue
        $lastError = "Word 保留格式导出超时"
      } else {
        $childOutput = ""
        if(Test-Path $stdoutPath){ $childOutput += (Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue) }
        if(Test-Path $stderrPath){ $childOutput += (Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue) }
        if($p.ExitCode -eq 0 -and (Test-Path $HtmlPath)){
          Remove-Item $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
          return
        }
        $lastError = [string]$childOutput
        Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $beforeWordIds -notcontains $_.Id } | Stop-Process -Force -ErrorAction SilentlyContinue
      }
      Remove-Item $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds (700 * $attempt)
    }
    throw "Word 保留格式导出失败：$lastError"
  } finally {
    Remove-Item $childScript -Force -ErrorAction SilentlyContinue
  }
}

function Capture-HtmlImage([string]$EdgePath, [string]$HtmlPath, [string]$RawPath, [string]$OutputPath, [string]$ProfileDir, [int]$TimeoutMs) {
  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  $uri=([System.Uri]$HtmlPath).AbsoluteUri
  $args=@("--headless","--disable-gpu","--no-sandbox","--disable-extensions","--hide-scrollbars","--force-device-scale-factor=2","--window-size=1300,6000","--user-data-dir=$ProfileDir","--screenshot=$RawPath",$uri)
  $p=Start-Process -FilePath $EdgePath -ArgumentList $args -PassThru -WindowStyle Hidden
  if(-not $p.WaitForExit($TimeoutMs)){
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    if(!(Test-Path $RawPath)){ throw "Edge 截图超时且未生成截图" }
  }
  if(!(Test-Path $RawPath)){ throw "Edge 未生成截图" }
  Trim-WhiteImage $RawPath $OutputPath
  Remove-Item $RawPath -Force -ErrorAction SilentlyContinue
  Remove-Item $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Get-ItemTypeForOutput($item) {
  $type = [string]$item.type
  if ($item.doubtful -and $type -notmatch '存疑') {
    return "${type}_存疑"
  }
  return $type
}

function Get-KnowledgeMapText($map) {
  if ($null -eq $map) { return "" }
  $parts = @()
  foreach($prop in $map.PSObject.Properties){
    if(-not [string]::IsNullOrWhiteSpace([string]$prop.Value)){
      $parts += "$($prop.Name):$($prop.Value)"
    }
  }
  return ($parts -join ";")
}

function Get-KnowledgeMapValue($map, [string]$qtype) {
  if ($null -eq $map) { return "" }
  $selected = @()
  foreach($qt in ($qtype -split '_')){
    $name = [string]$qt
    if([string]::IsNullOrWhiteSpace($name)){ continue }
    $prop = $map.PSObject.Properties[$name]
    if($null -ne $prop -and -not [string]::IsNullOrWhiteSpace([string]$prop.Value)){
      $selected += "$($name):$($prop.Value)"
    }
  }
  if($selected.Count -gt 0){ return ($selected -join ";") }
  return (Get-KnowledgeMapText $map)
}

function Split-DimensionValues([string]$text) {
  if([string]::IsNullOrWhiteSpace($text)){ return @() }
  if($text -match '\|'){
    return @($text -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
  }
  return @($text -split '[\/、,，;；_]' | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
}

function Test-AnyPattern([string]$text, [string[]]$patterns) {
  foreach($p in $patterns){
    if($text -match $p){ return $true }
  }
  return $false
}

function Get-ParagraphPlainText([string]$pXml) {
  $parts = New-Object System.Collections.Generic.List[string]
  $pattern = '<(?:w|m):t(?:\s[^>]*)?>([\s\S]*?)</(?:w|m):t>|<w:tab\s*/>|<w:br\s*/>|<m:chr\b[^>]*\bm:val="([^"]+)"'
  foreach($m in [regex]::Matches($pXml, $pattern)){
    if($m.Groups[1].Success){
      $parts.Add([System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value))
    } elseif($m.Value -like '<w:tab*') {
      $parts.Add(" ")
    } elseif($m.Value -like '<w:br*') {
      $parts.Add("`n")
    } elseif($m.Groups[2].Success) {
      $parts.Add([System.Net.WebUtility]::HtmlDecode($m.Groups[2].Value))
    }
  }
  return (($parts -join '') -replace '[\u200b\u200c\u200d]', '').Trim()
}

function Get-MediaHtmlFile([string]$rid, $relMap, [string]$mediaDir) {
  if([string]::IsNullOrWhiteSpace($rid) -or -not $relMap.ContainsKey($rid)){ return "" }
  $file = Split-Path $relMap[$rid] -Leaf
  $sourcePath = Join-Path $mediaDir $file
  if(!(Test-Path -LiteralPath $sourcePath)){ return "" }
  if($file -match '\.(png|jpg|jpeg|gif)$'){ return $file }
  if($file -match '\.(wmf|emf)$'){
    $pngFile = ([System.IO.Path]::GetFileNameWithoutExtension($file) + ".png")
    $pngPath = Join-Path $mediaDir $pngFile
    if(!(Test-Path -LiteralPath $pngPath)){
      $img = [System.Drawing.Image]::FromFile($sourcePath)
      try {
        $img.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $img.Dispose()
      }
    }
    return $pngFile
  }
  return ""
}

function Get-ParagraphHtml([string]$pXml, $relMap, [string]$mediaDir) {
  $parts = New-Object System.Collections.Generic.List[string]
  $pattern = '<w:t(?:\s[^>]*)?>([\s\S]*?)</w:t>|<m:t(?:\s[^>]*)?>([\s\S]*?)</m:t>|<w:tab\s*/>|<w:br\s*/>|<m:chr\b[^>]*\bm:val="([^"]+)"|<v:imagedata\b[^>]*\br:id="([^"]+)"|<a:blip\b[^>]*\br:embed="([^"]+)"'
  foreach($m in [regex]::Matches($pXml, $pattern)){
    if($m.Groups[1].Success){
      $parts.Add((HtmlEncode ([System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value))))
    } elseif($m.Groups[2].Success){
      $parts.Add((HtmlEncode ([System.Net.WebUtility]::HtmlDecode($m.Groups[2].Value))))
    } elseif($m.Value -like '<w:tab*') {
      $parts.Add(" ")
    } elseif($m.Value -like '<w:br*') {
      $parts.Add("<br>")
    } elseif($m.Groups[3].Success) {
      $parts.Add((HtmlEncode ([System.Net.WebUtility]::HtmlDecode($m.Groups[3].Value))))
    } else {
      $rid = ""
      if($m.Groups[4].Success){ $rid = $m.Groups[4].Value }
      if($m.Groups[5].Success){ $rid = $m.Groups[5].Value }
      $htmlFile = Get-MediaHtmlFile $rid $relMap $mediaDir
      if(-not [string]::IsNullOrWhiteSpace($htmlFile)){
        $parts.Add("<img class='inline-media' src='../media/$htmlFile'>")
      }
    }
  }
  return ($parts -join '')
}

function Select-QtypeForQuestion([string]$qtype, [string]$questionText) {
  $candidates = Split-DimensionValues $qtype
  if($candidates.Count -le 1){ return $qtype }
  $hasOption = Test-AnyPattern $questionText @('(^|[\r\n])\s*[A-HＡ-Ｈ][\.．、:：]', 'A[\.．、:：].*B[\.．、:：]', '下列.*的是', '正确的是', '错误的是', '选出', '选择')
  if($hasOption -and $candidates -contains '选择'){ return '选择' }
  $hasBlank = Test-AnyPattern $questionText @('_{2,}', '____+', '填空', '空格', '填入')
  if($hasBlank -and $candidates -contains '填空'){ return '填空' }
  $hasAnswer = Test-AnyPattern $questionText @('请回答', '回答下列', '完成下列', '分析', '说明', '简述', '论述', '原因', '意义')
  if($hasAnswer -and $candidates -contains '解答'){ return '解答' }
  return '待确认'
}

function Select-KnowledgePointForQuestion([string]$knowledgePoint, [string]$questionText) {
  $candidates = Split-DimensionValues $knowledgePoint
  if($candidates.Count -le 1){ return $knowledgePoint }

  $keywordMap = @{
    '细胞' = @('细胞','细胞器','线粒体','叶绿体','细胞膜','细胞核','核糖体','质壁分离','有丝分裂','减数分裂')
    '调节' = @('调节','激素','神经','体液','免疫','内环境','稳态','血糖','甲状腺','胰岛')
    '曲线' = @('曲线','坐标','趋势','变化曲线','柱状图','折线图','图像','随.*变化')
    '流程' = @('流程','过程','途径','箭头','示意图','合成','转化','循环')
    '生态' = @('生态','种群','群落','食物链','食物网','能量流动','物质循环','丰富度','生态系统')
    '遗传' = @('遗传','基因','染色体','DNA','RNA','减数','配子','表现型','基因型','家系','分离定律','自由组合','突变')
    '计算与数感题' = @('计算','四则','混合运算','分数','小数','简便','估算','竖式','算式','口算','脱式','约等于')
    '几何题' = @('几何','图形','三角形','四边形','正方形','长方形','圆','圆锥曲线','立体','三视图','全等','相似','周长','面积','角度','折叠','动点','尺规','作图','直角三角形','空间向量','解析几何','抛物线','椭圆','双曲线')
    '应用题' = @('应用题','行程','购物','分配','情境','线段图','速度','单价','总价','平均','每人','一共')
    '规律探究题' = @('规律','找规律','数阵','图形规律','第.*个','排列','周期','递推')
    '函数题' = @('函数','一次函数','二次函数','反比例','图象','坐标系','抛物线','直线','交点','函数与几何')
    '方程/不等式与计算题' = @('方程','不等式','数轴','解集','坐标系','交点','计算','代数式','方程组')
    '统计与真实情境题' = @('统计','图表','条形图','折线图','扇形图','频率','频数','平均数','中位数','众数','建模','真实情境')
    '函数与导数题' = @('导数','导函数','函数图象','单调','极值','最值','切线','曲线','性质综合')
    '三角/向量/数列题' = @('三角函数','正弦','余弦','向量','平面向量','数列','等差','等比','递推','通项')
    '概率统计与建模题' = @('概率','统计','箱线图','散点图','频率分布','直方图','回归','建模','样本')
    '综合压轴题' = @('综合','压轴','存在','恒成立','参数','多模块','最值','证明')
    '认函数图象' = @('函数式','对应哪个函数','选出正确的图','函数图象','曲线')
    '认立体图形' = @('立体图形','正方体','长方体','小方块','空间结构','截面','切掉','展开图')
    '图形变换判断' = @('旋转','平移','翻折','轴对称','中心对称','变换后')
    '读统计图选结论' = @('统计图','扇形图','柱状图','折线图','频率分布直方图','结论正确')
    '函数图象变化' = @('平移','翻转','变化率','导函数图象','升降','快慢')
    '坐标读取与计算' = @('坐标','格子','点的坐标','两点之间','距离','坐标系')
    '看曲线读数' = @('最高点','最低点','横轴交点','读出','曲线','函数曲线')
    '立体图形计算' = @('体积','表面积','夹角','圆柱','长方体','组合体','尺寸')
    '统计图读数再计算' = @('平均数','增长率','占比','统计图','读出数据','再计算')
    '相似图形求边长' = @('相似','全等','对应边','边长','角度','比例')
  }

  $scores = @{}
  foreach($candidate in $candidates){
    $score = 0
    if($questionText -match [regex]::Escape($candidate)){ $score += 5 }
    if($keywordMap.ContainsKey($candidate)){
      foreach($kw in $keywordMap[$candidate]){
        if($questionText -match $kw){ $score++ }
      }
    }
    $scores[$candidate] = $score
  }

  $ranked = @($scores.GetEnumerator() | Sort-Object Value -Descending)
  if($ranked.Count -eq 0 -or $ranked[0].Value -le 0){ return '待确认' }
  if($ranked.Count -gt 1 -and $ranked[0].Value -eq $ranked[1].Value){ return '待确认' }
  return [string]$ranked[0].Key
}

function Is-AnswerOrAnalysisLine([string]$text) {
  return $text -match '^\s*(【答案】|答案[:：]|【解析】|解析[:：])'
}

function Is-SectionHeadingLine([string]$text) {
  return $text -match '^\s*[一二三四五六七八九十]+、'
}

function Is-OptionLine([string]$text) {
  return $text -match '^\s*(?:[（(]?[A-HＡ-Ｈ][）)]?|[A-HＡ-Ｈ])\s*[\.．、:：]' -or $text -match '^\s*[A-HＡ-Ｈ]\s{1,}'
}

function Is-SubQuestionLine([string]$text) {
  return $text -match '^\s*[（(]\s*\d{1,2}\s*[）)]' -or $text -match '^\s*\d{1,2}\s*[）)]'
}

function Get-QuestionNumberFromText([string]$text) {
  if($text -match '^\s*(\d{1,2})[．\.、]'){
    return [int]$Matches[1]
  }
  return $null
}

function Has-ImageInRange($items, [int]$start, [int]$endExclusive) {
  if($start -lt 0){ $start = 0 }
  if($endExclusive -gt $items.Count){ $endExclusive = $items.Count }
  for($i=$start;$i -lt $endExclusive;$i++){
    if($items[$i].ImageIds.Count -gt 0){ return $true }
  }
  return $false
}

function Has-ContentInRange($items, [int]$start, [int]$endExclusive) {
  if($start -lt 0){ $start = 0 }
  if($endExclusive -gt $items.Count){ $endExclusive = $items.Count }
  for($i=$start;$i -lt $endExclusive;$i++){
    if($items[$i].ImageIds.Count -gt 0){ return $true }
    if(-not [string]::IsNullOrWhiteSpace([string]$items[$i].Text)){ return $true }
  }
  return $false
}

function Get-SafeSliceStart($items, [int]$questionStart, [int]$qidStartNumber, [int]$skipBefore) {
  $start = $questionStart
  for($j=$questionStart-1;$j -ge 0;$j--){
    if($j -le $skipBefore){ break }
    $prevText = [string]$items[$j].Text
    if(Is-AnswerOrAnalysisLine $prevText){ break }
    if(Is-SectionHeadingLine $prevText){ break }
    if(Is-OptionLine $prevText){ break }
    if(Is-SubQuestionLine $prevText){ break }
    $prevQ = Get-QuestionNumberFromText $prevText
    if($null -ne $prevQ -and $prevQ -lt $qidStartNumber){ break }
    $start = $j
  }
  return $start
}

function Get-QuestionEndIndex($items, [int]$start, [int]$qidEndNumber, [bool]$isRange, [int]$skipBefore) {
  $end = $items.Count
  for($i=$start+1;$i -lt $items.Count;$i++){
    $n = Get-QuestionNumberFromText ([string]$items[$i].Text)
    if($null -ne $n){
      if($n -gt $qidEndNumber){
        $nextSafeStart = Get-SafeSliceStart $items $i $n $skipBefore
        if($nextSafeStart -gt $start){
          $end = $nextSafeStart
        } else {
          $end = $i
        }
        break
      }
    } elseif(Is-SectionHeadingLine ([string]$items[$i].Text)){
      if($isRange){
        continue
      } else {
        $end=$i
        break
      }
    }
  }
  return $end
}

function Get-FirstContentIndex($items, [int]$start, [int]$endExclusive) {
  for($i=$start;$i -lt $endExclusive;$i++){
    if($items[$i].ImageIds.Count -gt 0){ return $i }
    if(-not [string]::IsNullOrWhiteSpace([string]$items[$i].Text)){ return $i }
  }
  return -1
}

if (!(Test-Path -LiteralPath $ConfigPath)) {
  throw "配置文件不存在：$ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not [string]::IsNullOrWhiteSpace($SourceDocx)) {
  $config | Add-Member -NotePropertyName sourceDocx -NotePropertyValue $SourceDocx -Force
}
if (-not [string]::IsNullOrWhiteSpace($OutRoot)) {
  $config | Add-Member -NotePropertyName outRoot -NotePropertyValue $OutRoot -Force
}
Require-Value $config.sourceDocx "sourceDocx"
Require-Value $config.outRoot "outRoot"
Require-Value $config.stage "stage"
Require-Value $config.subject "subject"
$hasConfiguredItems = ($null -ne $config.items -and $config.items.Count -gt 0)
$autoDetectImageQuestions = ($config.autoDetectImageQuestions -eq $true)
$onlyImageQuestions = ($config.onlyImageQuestions -ne $false)
$groupSharedMaterial = ($config.groupSharedMaterial -ne $false)
if (-not $hasConfiguredItems -and -not $autoDetectImageQuestions) {
  throw "配置缺少题目列表：items；如果要自动扫描题目，请设置 autoDetectImageQuestions=true"
}
if ($autoDetectImageQuestions) {
  Require-Value $config.defaultType "defaultType"
  Require-Value $config.defaultQtype "defaultQtype"
}
if (!(Test-Path -LiteralPath $config.sourceDocx)) {
  throw "源 Word 不存在：$($config.sourceDocx)"
}

$stage = [string]$config.stage
$subject = [string]$config.subject
$outRoot = [string]$config.outRoot
$subjectOutRoot = Join-Path (Join-Path $outRoot $stage) $subject
$imageDir = Join-Path $subjectOutRoot "image"
$imagesDir = Join-Path $subjectOutRoot "images"
$htmlDir = Join-Path $subjectOutRoot "html"
$mediaDir = Join-Path $subjectOutRoot "media"
New-Item -ItemType Directory -Force -Path $imageDir,$imagesDir,$htmlDir,$mediaDir | Out-Null
$runStamp = Get-Date -Format "yyyyMMdd_HHmmss_fff"

$skipBefore = 0
if ($null -ne $config.skipQuestionBeforeParagraph) {
  $skipBefore = [int]$config.skipQuestionBeforeParagraph
}
$screenshotTimeoutMs = 45000
if ($null -ne $config.screenshotTimeoutMs) {
  $screenshotTimeoutMs = [int]$config.screenshotTimeoutMs
}
$useNativeWordCrop = ($config.useNativeWordCrop -eq $true)
$useWordRangePicture = ($config.useWordRangePicture -eq $true)
$powershellExe = "powershell.exe"
if ($null -ne $config.powershellExe -and -not [string]::IsNullOrWhiteSpace([string]$config.powershellExe)) {
  $powershellExe = [string]$config.powershellExe
}

$zip=[System.IO.Compression.ZipFile]::OpenRead([string]$config.sourceDocx)
try {
  $docXml=(New-Object IO.StreamReader($zip.GetEntry("word/document.xml").Open())).ReadToEnd()
  $relsText=(New-Object IO.StreamReader($zip.GetEntry("word/_rels/document.xml.rels").Open())).ReadToEnd()
  $relMap=@{}
  foreach($m in [regex]::Matches($relsText,'<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"')){
    $relMap[$m.Groups[1].Value]=$m.Groups[2].Value
  }
  foreach($target in ($relMap.Values | Where-Object { $_ -like 'media/*' } | Sort-Object -Unique)){
    $entry=$zip.GetEntry("word/$target")
    if($null -ne $entry){
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $mediaDir (Split-Path $target -Leaf)),$true)
    }
  }
} finally {
  $zip.Dispose()
}

$paragraphs=New-Object System.Collections.Generic.List[object]
$paraIndex = 0
foreach($pm in [regex]::Matches($docXml,'<w:p[\s\S]*?</w:p>')){
  $pXml=$pm.Value
  $text=Get-ParagraphPlainText $pXml
  $imgIds=New-Object System.Collections.Generic.List[string]
  foreach($im in [regex]::Matches($pXml,'r:embed="([^"]+)"')){
    $rid=$im.Groups[1].Value
    if($relMap.ContainsKey($rid)){ $imgIds.Add($rid) }
  }
  $paragraphs.Add([pscustomobject]@{Index=$paraIndex; Text=$text; Xml=$pXml; ImageIds=$imgIds})
  $paraIndex++
}

$edgeCandidates = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($edge)) {
  throw "未找到 Microsoft Edge，无法执行 headless 截图"
}

if($useNativeWordCrop){
  Write-Host "已启用 Word 原版式截图子进程；失败时自动回退 HTML 截图"
}

$itemsToRun = @()
if ($hasConfiguredItems) {
  $itemsToRun = @($config.items)
} elseif ($autoDetectImageQuestions) {
  $questionStarts = New-Object System.Collections.Generic.List[object]
  for($i=0;$i -lt $paragraphs.Count;$i++){
    $n = Get-QuestionNumberFromText ([string]$paragraphs[$i].Text)
    if($i -gt $skipBefore -and $null -ne $n){
      $questionStarts.Add([pscustomobject]@{ Qid=$n; Start=$i })
    }
  }
  $questionInfos = New-Object System.Collections.Generic.List[object]
  for($q=0;$q -lt $questionStarts.Count;$q++){
    $start = [int]$questionStarts[$q].Start
    $qidNumber = [int]$questionStarts[$q].Qid
    $safeStart = Get-SafeSliceStart $paragraphs $start $qidNumber $skipBefore
    $questionInfos.Add([pscustomobject]@{
      Qid = $qidNumber
      Start = $start
      End = $paragraphs.Count
      SafeStart = $safeStart
      LeadingHasContent = (Has-ContentInRange $paragraphs $safeStart $start)
      OwnHasImage = $false
      SafeHasImage = $false
    })
  }
  for($q=0;$q -lt $questionInfos.Count;$q++){
    $end = $paragraphs.Count
    if($q -lt $questionInfos.Count-1){
      $end = [int]$questionInfos[$q+1].SafeStart
    }
    $questionInfos[$q].End = $end
    $questionInfos[$q].OwnHasImage = (Has-ImageInRange $paragraphs ([int]$questionInfos[$q].Start) $end)
    $questionInfos[$q].SafeHasImage = (Has-ImageInRange $paragraphs ([int]$questionInfos[$q].SafeStart) $end)
  }

  if(-not $groupSharedMaterial){
    foreach($info in $questionInfos){
      if(((-not $onlyImageQuestions) -or [bool]$info.SafeHasImage)){
        $itemsToRun += [pscustomobject]@{
          qid = [string]$info.Qid
          type = [string]$config.defaultType
          qtype = [string]$config.defaultQtype
          knowledgePoint = [string]$config.defaultKnowledgePoint
          qtypeKnowledgeMap = (Get-KnowledgeMapText $config.defaultKnowledgeMap)
          doubtful = ($config.defaultDoubtful -eq $true)
          remark = if($config.defaultDoubtful -eq $true){"自动扫描题，按单题截取，题目类型存疑"}else{"自动扫描题，按单题截取"}
        }
      }
    }
  } else {
    $q=0
    while($q -lt $questionInfos.Count){
      $info = $questionInfos[$q]
      $groupLastIndex = $q
      $groupEndQid = [int]$info.Qid
      $groupHasImage = [bool]$info.SafeHasImage
      if([bool]$info.LeadingHasContent){
        for($nextIndex=$q+1;$nextIndex -lt $questionInfos.Count;$nextIndex++){
          $next = $questionInfos[$nextIndex]
          if([bool]$next.LeadingHasContent){ break }
          if([bool]$next.OwnHasImage){ break }
          $groupLastIndex = $nextIndex
          $groupEndQid = [int]$next.Qid
          $groupHasImage = $groupHasImage -or [bool]$next.SafeHasImage
        }
      }
      if(((-not $onlyImageQuestions) -or $groupHasImage)){
        $qidText = [string]$info.Qid
        if($groupEndQid -gt [int]$info.Qid){
          $qidText = "$($info.Qid)-$groupEndQid"
        }
        $itemsToRun += [pscustomobject]@{
          qid = $qidText
          type = [string]$config.defaultType
          qtype = [string]$config.defaultQtype
          knowledgePoint = [string]$config.defaultKnowledgePoint
          qtypeKnowledgeMap = (Get-KnowledgeMapText $config.defaultKnowledgeMap)
          doubtful = ($config.defaultDoubtful -eq $true)
          remark = if($groupEndQid -gt [int]$info.Qid){"自动扫描题；检测到共用材料，已合并题组"}elseif($config.defaultDoubtful -eq $true){"自动扫描题，题目类型存疑"}else{"自动扫描题"}
        }
      }
      $q = $groupLastIndex + 1
    }
  }
  if($onlyImageQuestions){
    Write-Host "自动扫描到带图题：$($itemsToRun.Count) 题"
  } else {
    Write-Host "自动扫描到题目：$($itemsToRun.Count) 题"
  }
}
if ($itemsToRun.Count -eq 0) {
  throw "没有可处理题目：未配置题目，或自动扫描未发现符合条件的题"
}

$manifest=New-Object System.Collections.Generic.List[object]
$skipped=New-Object System.Collections.Generic.List[object]

foreach($it in $itemsToRun){
  $qid = [string]$it.qid
  $qidRange = Get-QidRange $qid
  $qtype = [string]$it.qtype
  $knowledgePoint = [string]$it.knowledgePoint
  $qtypeKnowledgeMap = [string]$it.qtypeKnowledgeMap
  if([string]::IsNullOrWhiteSpace($knowledgePoint) -and -not [string]::IsNullOrWhiteSpace([string]$config.defaultKnowledgePoint)){
    $knowledgePoint = [string]$config.defaultKnowledgePoint
  }
  if([string]::IsNullOrWhiteSpace($qtypeKnowledgeMap)){
    $qtypeKnowledgeMap = Get-KnowledgeMapValue $config.defaultKnowledgeMap $qtype
  }
  if([string]::IsNullOrWhiteSpace($qtypeKnowledgeMap) -and -not [string]::IsNullOrWhiteSpace($knowledgePoint)){
    $qtypeKnowledgeMap = "${qtype}:${knowledgePoint}"
  }
  $typeForOutput = Get-ItemTypeForOutput $it
  $nameDimensionForOutput = $typeForOutput
  if(-not [string]::IsNullOrWhiteSpace($knowledgePoint)){
    $nameDimensionForOutput = $knowledgePoint
  }
  Write-Host "处理 $(FormatQid $qid) ..."

  try {
    $profile = $null
    $qidStartNumber = [int]$qidRange['Start']
    $qidEndNumber = [int]$qidRange['End']
    Require-Value $qid "items.qid"
    Require-Value $it.type "items.type"
    Require-Value $qtype "items.qtype"

    $questionStart=-1
    for($i=0;$i -lt $paragraphs.Count;$i++){
      $foundNumber = Get-QuestionNumberFromText ([string]$paragraphs[$i].Text)
      if($i -gt $skipBefore -and $null -ne $foundNumber -and $foundNumber -eq $qidStartNumber){
        $questionStart=$i
        break
      }
    }
    if($questionStart -lt 0){ throw "未找到题号起始段落" }

    $start = Get-SafeSliceStart $paragraphs $questionStart $qidStartNumber $skipBefore
    $end = Get-QuestionEndIndex $paragraphs $start $qidEndNumber ($qidStartNumber -ne $qidEndNumber) $skipBefore

    $firstContentIndex = Get-FirstContentIndex $paragraphs $start $end
    if($firstContentIndex -ge 0 -and (Is-OptionLine ([string]$paragraphs[$firstContentIndex].Text))){
      $start = $questionStart
    }

    $slice=$paragraphs[$start..($end-1)]
    $hasImage=($slice | Where-Object { $_.ImageIds.Count -gt 0 } | Select-Object -First 1) -ne $null
    if($onlyImageQuestions -and -not $hasImage){ throw "题目范围内未检测到图片" }

    $plainText = (($slice | ForEach-Object { [string]$_.Text }) -join "`n")
    $qtype = Select-QtypeForQuestion $qtype $plainText
    if(-not [string]::IsNullOrWhiteSpace($knowledgePoint)){
      $knowledgePoint = Select-KnowledgePointForQuestion $knowledgePoint $plainText
    }
    $qtypeKnowledgeMap = Get-KnowledgeMapValue $config.defaultKnowledgeMap $qtype
    if([string]::IsNullOrWhiteSpace($qtypeKnowledgeMap) -and -not [string]::IsNullOrWhiteSpace($knowledgePoint)){
      $qtypeKnowledgeMap = "${qtype}:${knowledgePoint}"
    }
    $nameDimensionForOutput = $typeForOutput
    if(-not [string]::IsNullOrWhiteSpace($knowledgePoint)){
      $nameDimensionForOutput = $knowledgePoint
    }

    $body=New-Object System.Text.StringBuilder
    foreach($p in $slice){
      if(Is-AnswerOrAnalysisLine ([string]$p.Text)){ break }
      $paragraphHtml = Get-ParagraphHtml ([string]$p.Xml) $relMap $mediaDir
      if(-not [string]::IsNullOrWhiteSpace($paragraphHtml)){
        $trimmedParagraphHtml = $paragraphHtml.Trim()
        if($trimmedParagraphHtml -match "^<img class='inline-media' src='([^']+)'>$"){
          [void]$body.AppendLine("<div class='imgbox'><img src='$($Matches[1])'></div>")
        } else {
          [void]$body.AppendLine("<p>$paragraphHtml</p>")
        }
      }
      foreach($rid in $p.ImageIds){
        $file=Get-MediaHtmlFile $rid $relMap $mediaDir
        if(-not [string]::IsNullOrWhiteSpace($file) -and $paragraphHtml -match [regex]::Escape("../media/$file")){ continue }
        if(-not [string]::IsNullOrWhiteSpace($file)){
          [void]$body.AppendLine("<div class='imgbox'><img src='../media/$file'></div>")
        }
      }
    }

    $fileName="$(FormatQid $qid)_$(SafeName $stage)_$(SafeName $subject)_$(SafeName $nameDimensionForOutput)_$qtype.png"
    $base="question_$(FormatQid $qid)_$runStamp"
    $htmlPath=Join-Path $htmlDir "$base.html"
    $wordHtmlPath=Join-Path $htmlDir "$base.word.html"
    $rawPath=Join-Path $subjectOutRoot "$base.raw.png"
    $imgPath=Join-Path $imageDir $fileName
    $captureMode = "html"
    $html=@"
<!doctype html><html><head><meta charset="utf-8">
<style>
body{margin:0;background:#fff;font-family:"Microsoft YaHei",SimSun,Arial,sans-serif}
.page{width:980px;padding:34px 44px;color:#111;font-size:22px;line-height:1.72}
p{margin:8px 0 12px}.imgbox{margin:12px 0 18px;text-align:center}img{max-width:92%;height:auto}
.inline-media{display:inline-block;max-height:1.35em;max-width:12em;vertical-align:-0.25em;margin:0 2px}.imgbox .inline-media,.imgbox img{max-height:none;max-width:92%}
</style></head><body><div class="page">
$($body.ToString())
</div></body></html>
"@
    [System.IO.File]::WriteAllText($htmlPath,$html,[System.Text.UTF8Encoding]::new($true))

    $nativeOk = $false
    if($useNativeWordCrop){
      try {
        Export-WordRangeHtml ([string]$config.sourceDocx) $paragraphs $start $end $wordHtmlPath $powershellExe
        $profile=Join-Path $subjectOutRoot ("edge_profile_word_"+(FormatQid $qid)+"_"+[guid]::NewGuid().ToString("N"))
        Capture-HtmlImage $edge $wordHtmlPath $rawPath $imgPath $profile $screenshotTimeoutMs
        $nativeOk = $true
        $captureMode = "word-html"
      } catch {
        Write-Host "  Word 保留格式导出失败：$($_.Exception.Message)"
      }
    }

    if(-not $nativeOk -and $useNativeWordCrop -and $useWordRangePicture){
      try {
        Save-WordRangeImage ([string]$config.sourceDocx) $paragraphs $start $end $imgPath $powershellExe
        $nativeOk = $true
        $captureMode = "word-range"
      } catch {
        Write-Host "  Word 原版式截图失败，回退普通 HTML 截图：$($_.Exception.Message)"
      }
    }

    if(-not $nativeOk){
      $profile=Join-Path $subjectOutRoot ("edge_profile_"+(FormatQid $qid)+"_"+[guid]::NewGuid().ToString("N"))
      Capture-HtmlImage $edge $htmlPath $rawPath $imgPath $profile $screenshotTimeoutMs
    }
    [System.IO.File]::Copy($imgPath, (Join-Path $imagesDir $fileName), $true)

    $remark = [string]$it.remark
    if($it.doubtful -and [string]::IsNullOrWhiteSpace($remark)){
      $remark = "题目类型存疑"
    }

    $manifest.Add([pscustomobject][ordered]@{
      "题目编号" = (FormatQid $qid)
      "学段" = $stage
      "学科" = $subject
      "题目类型" = $typeForOutput
      "知识点" = $knowledgePoint
      "题型知识点映射" = $qtypeKnowledgeMap
      "题型" = $qtype
      "图片文件名" = $fileName
      "图片路径" = $imgPath
      "题面文本" = $plainText
      "截图方式" = $captureMode
      "备注" = $remark
    })
    Write-Host "  OK $fileName"
  } catch {
    if($null -ne $profile -and (Test-Path -LiteralPath $profile)){
      Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
    }
    $skipped.Add([pscustomobject][ordered]@{
      "题号" = ("Q"+$qid)
      "题目类型" = $typeForOutput
      "知识点" = $knowledgePoint
      "题型知识点映射" = $qtypeKnowledgeMap
      "题型" = $qtype
      "跳过原因" = $_.Exception.Message
    })
    Write-Host "  SKIP Q${qid}: $($_.Exception.Message)"
  }
}

if($null -ne $wordDoc){
  $wordDoc.Close($false)
  $wordDoc = $null
}
if($null -ne $wordApp){
  $wordApp.Quit()
  $wordApp = $null
}

$manifest | Export-Csv (Join-Path $subjectOutRoot "manifest_简化维度.csv") -NoTypeInformation -Encoding UTF8
$skipped | Export-Csv (Join-Path $subjectOutRoot "skipped_questions.csv") -NoTypeInformation -Encoding UTF8

$imgs=Get-ChildItem $imageDir -File -Filter "*.png" | Sort-Object Name
$galleryHead = "<!doctype html><html><head><meta charset='utf-8'><title>$stage$subject 题图预览</title><style>body{font-family:Microsoft YaHei,Arial,sans-serif;background:#f5f5f5;margin:24px}.card{background:#fff;margin:0 0 28px;padding:18px;border-radius:10px;box-shadow:0 1px 6px #ccc}h1{font-size:24px}h2{font-size:18px}.card img{max-width:100%;border:1px solid #ddd}</style></head><body><h1>$stage$subject 题图预览</h1>"
$latestSb=New-Object System.Text.StringBuilder
$archiveSb=New-Object System.Text.StringBuilder
[void]$latestSb.AppendLine($galleryHead)
[void]$archiveSb.AppendLine($galleryHead)
foreach($img in $imgs){
  [void]$latestSb.AppendLine("<div class='card'><h2>$($img.Name)</h2><img src='image/$($img.Name)'></div>")
  $base64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($img.FullName))
  [void]$archiveSb.AppendLine("<div class='card'><h2>$($img.Name)</h2><img src='data:image/png;base64,$base64'></div>")
}
[void]$latestSb.AppendLine("</body></html>")
[void]$archiveSb.AppendLine("</body></html>")
$latestGalleryHtml = $latestSb.ToString()
$archiveGalleryHtml = $archiveSb.ToString()
$galleryStamp = Get-Date -Format "yyyyMMdd_HHmmss_fff"
$archiveGalleryPath = Join-Path $subjectOutRoot "gallery_$galleryStamp.html"
$latestGalleryPath = Join-Path $subjectOutRoot "gallery.html"
[System.IO.File]::WriteAllText($archiveGalleryPath,$archiveGalleryHtml,[System.Text.UTF8Encoding]::new($true))
[System.IO.File]::WriteAllText($latestGalleryPath,$latestGalleryHtml,[System.Text.UTF8Encoding]::new($true))

Write-Host "完成：成功 $($manifest.Count)，跳过 $($skipped.Count)"
Write-Host "输出目录：$subjectOutRoot"
Write-Host "本批预览：$archiveGalleryPath"
