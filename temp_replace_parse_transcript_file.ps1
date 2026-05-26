$path = 'server/index.js'
$content = Get-Content $path -Raw
$pattern = 'async function parseTranscriptFile\([\s\S]*?\n\}\n\nfunction parseTrainingPlanFromCsvText'
$replacement = @'
async function parseTranscriptFile({ filename, mime, buffer }) {
  const name = String(filename ?? "");
  const ext = path.extname(name).toLowerCase();
  const type = String(mime ?? "").toLowerCase();

  if (ext === ".csv" || type.includes("csv")) {
    return { format: "csv", courses: parseTranscriptFromCsvText(buffer.toString("utf8")) };
  }
  if (ext === ".txt" || type.includes("text/plain")) {
    return { format: "txt", courses: parseTranscriptFromCsvText(buffer.toString("utf8")) };
  }
  if (ext === ".html" || ext === ".htm" || type.includes("text/html")) {
    return { format: "html", courses: parseTranscriptFromHtml(buffer.toString("utf8")) };
  }
  if (ext === ".pdf" || type.includes("pdf")) {
    let PDFParse;
    try {
      ({ PDFParse } = require("pdf-parse"));
    } catch {
      const err = new Error("暂不支持PDF解析，请导出HTML或CSV成绩单后再上传");
      err.code = "PDF_PARSE_UNSUPPORTED";
      throw err;
    }
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy().catch(() => {});
    const text = String(parsed?.text ?? "");
    return { format: "pdf", courses: parseTranscriptFromPdfText(text) };
  }
  const err = new Error("不支持的文件类型：请上传 HTML / CSV / TXT / PDF");
  err.code = "UNSUPPORTED_FILE";
  throw err;
}

function parseTrainingPlanFromCsvText
'@
$new = [regex]::Replace($content, $pattern, $replacement)
Set-Content $path $new -Encoding UTF8
