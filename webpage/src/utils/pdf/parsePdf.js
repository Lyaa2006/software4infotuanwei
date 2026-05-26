import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

function joinTextItems(items) {
  return (items || [])
    .map((item) => String(item?.str || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function parsePdfFile(file) {
  if (!file) throw new Error('未选择 PDF 文件')
  const name = String(file.name || '').toLowerCase()
  const type = String(file.type || '').toLowerCase()
  if (!name.endsWith('.pdf') && !type.includes('pdf')) {
    throw new Error('请选择 PDF 文件')
  }

  const buffer = await file.arrayBuffer()
  const task = pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  })
  const pdf = await task.promise
  const meta = await pdf.getMetadata().catch(() => null)
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const text = joinTextItems(textContent.items)
    pages.push({ pageNumber, text })
  }

  return {
    fileName: String(file.name || ''),
    numPages: pdf.numPages,
    fullText: pages.map((page) => page.text).filter(Boolean).join('\n\n'),
    pages,
    metadata: meta?.info || null,
  }
}
