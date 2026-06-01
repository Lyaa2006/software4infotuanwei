export function normalizeTagList(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[,，、\n\r\t ]+/)
  const out = []
  const seen = new Set()
  for (const item of raw) {
    const tag = String(item ?? '').trim()
    if (!tag || tag === '-') continue
    if (seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

export function tagsToText(tags) {
  const list = normalizeTagList(tags)
  return list.length ? list.join('、') : '-'
}

export function formatTagsLabel(tags) {
  const list = normalizeTagList(tags)
  return list.length ? '标签：' + list.join('、') : '标签：-'
}

export function mapStudentTags(student) {
  const tags = normalizeTagList(student?.tags)
  return { ...student, tags, tagsText: formatTagsLabel(tags), tagsTextRaw: tags.join(', ') }
}

export function collectAvailableTags(students) {
  const tagSet = new Set()
  for (const student of students || []) {
    for (const tag of normalizeTagList(student?.tags)) tagSet.add(tag)
  }
  return Array.from(tagSet)
}
