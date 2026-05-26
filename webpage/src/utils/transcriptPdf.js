function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function splitMeaningfulLines(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => String(line || '').trim())
    .filter(Boolean)
}

function normalizeSemester(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const match = text.match(/(20\d{2})\s*[-/]\s*(20\d{2}).{0,6}?([12一二])(?:学期)?/)
  if (match) {
    const term = match[3] === '一' ? '1' : match[3] === '二' ? '2' : match[3]
    return `${match[1]}-${match[2]}-${term}`
  }
  return text
}

function findSemesterInLine(line) {
  const direct = line.match(/20\d{2}\s*[-/]\s*20\d{2}.{0,8}?(?:第?\s*[12一二]\s*学期|[12一二]学期)/)
  if (direct) return normalizeSemester(direct[0])
  const compact = line.match(/20\d{2}\s*[-/]\s*20\d{2}\s*[-/]\s*[12]/)
  if (compact) return compact[0].replace(/\s+/g, '')
  return ''
}

function looksLikeCourseCode(token) {
  const value = String(token || '').trim()
  return /^[A-Za-z0-9_-]{4,20}$/.test(value) && /[A-Za-z]/.test(value)
}

function parseCredits(token) {
  const value = String(token || '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const num = Number(value)
  if (num < 0 || num > 20) return null
  return num
}

function parseScore(token) {
  const value = String(token || '').trim()
  if (!/^\d{1,3}$/.test(value)) return null
  const num = Number(value)
  if (num < 0 || num > 100) return null
  return num
}

function parseGrade(token) {
  const value = String(token || '').trim()
  if (!value) return ''
  if (/^(优秀|良好|中等|及格|不及格|通过|不通过|合格|不合格|A\+?|A-|B\+?|B-|C\+?|C-|D|F|P|NP)$/i.test(value)) return value
  return ''
}

function shouldSkipLine(line) {
  return /^(序号|学号|姓名|学院|专业|课程类别|成绩单|Transcript|GPA|平均学分绩点)/i.test(line)
}

function extractCourseRow(line, currentSemester) {
  if (shouldSkipLine(line)) return null
  const parts = line.split(/\s{2,}|\t+/).map((item) => String(item || '').trim()).filter(Boolean)
  if (parts.length < 3) return null

  let semester = findSemesterInLine(line) || currentSemester || ''
  const scoreToken = [...parts].reverse().find((item) => parseScore(item) !== null)
  const creditToken = [...parts].reverse().find((item) => parseCredits(item) !== null)
  const gradeToken = [...parts].reverse().find((item) => parseGrade(item))
  const courseCode = parts.find((item) => looksLikeCourseCode(item)) || ''

  const score = scoreToken ? parseScore(scoreToken) : null
  const credits = creditToken ? parseCredits(creditToken) : null
  const grade = gradeToken || ''

  const used = new Set([courseCode, scoreToken, creditToken, gradeToken].filter(Boolean))
  const nameParts = parts.filter((item) => !used.has(item) && !findSemesterInLine(item))
  const courseName = nameParts.join(' ').trim()

  if (!courseName) return null
  if (!courseCode && score === null && credits === null) return null

  return {
    semester,
    courseCode,
    courseName,
    credits,
    score,
    grade,
    rawText: line,
  }
}

function dedupeRows(rows) {
  const seen = new Set()
  const result = []
  for (const row of rows || []) {
    const key = [row.semester, row.courseCode, row.courseName, row.credits, row.score, row.grade].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

function isPassing(row) {
  if (typeof row.score === 'number') return row.score >= 60
  if (row.grade && /^(优秀|良好|中等|及格|通过|合格|A\+?|A-|B\+?|B-|C\+?|C-|D|P)$/i.test(row.grade)) return true
  return false
}

export function extractTranscriptFromPdfText(text) {
  const lines = splitMeaningfulLines(text)
  const rows = []
  const semesters = []
  let currentSemester = ''

  for (const line of lines) {
    const foundSemester = findSemesterInLine(line)
    if (foundSemester) {
      currentSemester = foundSemester
      if (!semesters.includes(foundSemester)) semesters.push(foundSemester)
    }
    const row = extractCourseRow(line, currentSemester)
    if (row) rows.push(row)
  }

  const uniqueRows = dedupeRows(rows)
  const warnings = []
  if (!uniqueRows.length) warnings.push('未识别到课程行，可能是扫描件 PDF，或当前成绩单排版需要补充规则。')
  if (!semesters.length) warnings.push('未识别出学期，预览中的学期列可能为空。')

  const totalCredits = uniqueRows.reduce((sum, row) => sum + (typeof row.credits === 'number' ? row.credits : 0), 0)
  const earnedCredits = uniqueRows.reduce((sum, row) => sum + (isPassing(row) && typeof row.credits === 'number' ? row.credits : 0), 0)

  return {
    rows: uniqueRows,
    semesters,
    warnings,
    summary: {
      totalCourses: uniqueRows.length,
      totalCredits: Number(totalCredits.toFixed(2)),
      earnedCredits: Number(earnedCredits.toFixed(2)),
    },
  }
}
