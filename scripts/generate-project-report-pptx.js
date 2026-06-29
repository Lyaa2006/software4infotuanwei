#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "docs", "project-report-ppt.md");
const OUTPUT = path.join(ROOT, "docs", "project-report.pptx");

const EMU = 914400;
const SLIDE_W = 12192000;
const SLIDE_H = 6858000;

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseMarkdownSlides(markdown) {
  const slides = [];
  let current = null;
  for (const rawLine of String(markdown || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = /^##\s+(\d+)\.\s+(.+)$/.exec(line);
    if (heading) {
      if (current) slides.push(current);
      current = { number: Number(heading[1]), title: heading[2].trim(), lines: [] };
      continue;
    }
    if (/^##\s+/.test(line) && current) {
      slides.push(current);
      current = null;
      continue;
    }
    if (current) current.lines.push(rawLine);
  }
  if (current) slides.push(current);

  return slides.map((slide) => {
    const lines = [];
    for (const rawLine of slide.lines) {
      const line = rawLine.trim();
      if (!line || line === "---" || line.startsWith(">")) continue;
      if (/^\|[-:\s|]+\|$/.test(line)) continue;

      if (line.startsWith("|") && line.endsWith("|")) {
        const cells = line
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean);
        if (!cells.length || cells[0] === "模块") continue;
        if (cells.length >= 3) {
          lines.push({
            kind: "bullet",
            text: `${cells[0]}：${cells.slice(1).join("；")}`,
          });
        } else {
          lines.push({ kind: "bullet", text: cells.join(" / ") });
        }
        continue;
      }

      const strong = /^\*\*(.+?)\*\*$/.exec(line);
      if (strong) {
        lines.push({ kind: "section", text: strong[1].trim() });
        continue;
      }

      if (line.startsWith("- ")) {
        lines.push({ kind: "bullet", text: line.slice(2).trim() });
        continue;
      }

      const cleaned = line
        .replace(/^\d+\.\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .trim();
      if (cleaned) lines.push({ kind: "text", text: cleaned });
    }
    return { ...slide, lines };
  });
}

function ensureLineBudget(lines, maxLines) {
  if (lines.length <= maxLines) return lines;
  const next = lines.slice(0, maxLines - 1);
  next.push({ kind: "text", text: "其余内容见对应讲稿与 Markdown 附录。" });
  return next;
}

function paragraphXml(line, options = {}) {
  const kind = line.kind || "text";
  const text = xmlEscape(line.text);
  const size = options.size || 2200;
  const color = kind === "section" ? "1D4ED8" : "1F2937";
  const bold = kind === "section" ? ' b="1"' : "";
  const bullet = kind === "bullet"
    ? '<a:pPr marL="330000" indent="-180000"><a:buChar char="•"/></a:pPr>'
    : '<a:pPr marL="0" indent="0"/>';

  return `
        <a:p>
          ${bullet}
          <a:r>
            <a:rPr lang="zh-CN" sz="${size}"${bold}>
              <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
              <a:latin typeface="Microsoft YaHei"/>
              <a:ea typeface="Microsoft YaHei"/>
              <a:cs typeface="Microsoft YaHei"/>
            </a:rPr>
            <a:t>${text}</a:t>
          </a:r>
          <a:endParaRPr lang="zh-CN" sz="${size}"/>
        </a:p>`;
}

function textBoxXml({ id, x, y, cx, cy, paragraphs, fontSize = 2200, vertical = "top" }) {
  const anchor = vertical === "mid" ? ' anchor="ctr"' : "";
  return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id}" name="TextBox ${id}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${cx}" cy="${cy}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0"${anchor}/>
          <a:lstStyle/>
          ${paragraphs.map((line) => paragraphXml(line, { size: fontSize })).join("")}
        </p:txBody>
      </p:sp>`;
}

function rectXml({ id, name, x, y, cx, cy, color }) {
  return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id}" name="${xmlEscape(name)}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${cx}" cy="${cy}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          <a:ln><a:noFill/></a:ln>
        </p:spPr>
      </p:sp>`;
}

function slideXml(slide, index) {
  if (index === 0) {
    const bodyTitle = slide.lines.find((line) => line.kind === "section")?.text || "信息学院学生综合服务与党团管理平台";
    const subtitle = slide.lines
      .filter((line) => line.kind !== "section")
      .map((line) => ({ ...line, kind: "text" }));
    return baseSlideXml(`
      ${rectXml({ id: 2, name: "Top Accent", x: 0, y: 0, cx: SLIDE_W, cy: 180000, color: "1D4ED8" })}
      ${rectXml({ id: 3, name: "Left Accent", x: 0, y: 180000, cx: 170000, cy: SLIDE_H - 180000, color: "0EA5E9" })}
      ${textBoxXml({
        id: 4,
        x: 930000,
        y: 1800000,
        cx: 10300000,
        cy: 1100000,
        paragraphs: [{ kind: "section", text: bodyTitle }],
        fontSize: 3900,
        vertical: "mid",
      })}
      ${textBoxXml({
        id: 5,
        x: 940000,
        y: 3150000,
        cx: 9800000,
        cy: 1700000,
        paragraphs: subtitle,
        fontSize: 2100,
      })}
    `);
  }

  const lines = ensureLineBudget(slide.lines, 15);
  const bulletCount = lines.length;
  const bodySize = bulletCount > 12 ? 1650 : bulletCount > 9 ? 1850 : 2050;

  return baseSlideXml(`
      ${rectXml({ id: 2, name: "Top Accent", x: 0, y: 0, cx: SLIDE_W, cy: 135000, color: "1D4ED8" })}
      ${textBoxXml({
        id: 3,
        x: 650000,
        y: 300000,
        cx: 9000000,
        cy: 700000,
        paragraphs: [{ kind: "section", text: slide.title }],
        fontSize: 2850,
      })}
      ${textBoxXml({
        id: 4,
        x: 660000,
        y: 1180000,
        cx: 10800000,
        cy: 5000000,
        paragraphs: lines,
        fontSize: bodySize,
      })}
      ${textBoxXml({
        id: 5,
        x: 690000,
        y: 6320000,
        cx: 7000000,
        cy: 230000,
        paragraphs: [{ kind: "text", text: "信息学院学生综合服务与党团管理平台" }],
        fontSize: 1050,
      })}
      ${textBoxXml({
        id: 6,
        x: 10900000,
        y: 6280000,
        cx: 700000,
        cy: 250000,
        paragraphs: [{ kind: "text", text: String(index + 1).padStart(2, "0") }],
        fontSize: 1200,
      })}
    `);
}

function baseSlideXml(shapes) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function slideRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
}

function presentationXml(slides) {
  const slideIds = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="wide"/>
  <p:notesSz cx="${7.5 * EMU}" cy="${10 * EMU}"/>
  <p:defaultTextStyle>
    <a:defPPr>
      <a:defRPr lang="zh-CN"/>
    </a:defPPr>
  </p:defaultTextStyle>
</p:presentation>`;
}

function presentationRelsXml(slides) {
  const rels = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
  ];
  slides.forEach((_, i) => {
    rels.push(`<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join("\n  ")}
</Relationships>`;
}

function contentTypesXml(slides) {
  const slideOverrides = slides
    .map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function appXml(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
  <PresentationFormat>宽屏</PresentationFormat>
  <Slides>${slideCount}</Slides>
  <Notes>0</Notes>
  <HiddenSlides>0</HiddenSlides>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>幻灯片标题</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${slideCount}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${slideCount}" baseType="lpstr">
      ${Array.from({ length: slideCount }, (_, i) => `<vt:lpstr>Slide ${i + 1}</vt:lpstr>`).join("")}
    </vt:vector>
  </TitlesOfParts>
  <Company>Information College</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>信息学院学生综合服务与党团管理平台项目汇报</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function slideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3200" b="1"><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:defRPr></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr algn="l"><a:defRPr sz="2200"><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:defRPr></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr algn="l"><a:defRPr sz="1800"><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:defRPr></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;
}

function slideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

function slideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function slideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ProjectReportTheme">
  <a:themeElements>
    <a:clrScheme name="Project">
      <a:dk1><a:srgbClr val="111827"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F2937"/></a:dk2>
      <a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="1D4ED8"/></a:accent1>
      <a:accent2><a:srgbClr val="0EA5E9"/></a:accent2>
      <a:accent3><a:srgbClr val="16A34A"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="7C3AED"/></a:accent5>
      <a:accent6><a:srgbClr val="EF4444"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink>
      <a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="ProjectFonts">
      <a:majorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Microsoft YaHei"/></a:majorFont>
      <a:minorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Microsoft YaHei"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="ProjectFmt">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="110000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`;
}

function makeCrc32Table() {
  const table = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralOffset = offset;
  const centralData = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralData, end]);
}

function buildPptx(slides) {
  const entries = [
    { name: "[Content_Types].xml", data: contentTypesXml(slides) },
    { name: "_rels/.rels", data: rootRelsXml() },
    { name: "docProps/app.xml", data: appXml(slides.length) },
    { name: "docProps/core.xml", data: coreXml() },
    { name: "ppt/presentation.xml", data: presentationXml(slides) },
    { name: "ppt/_rels/presentation.xml.rels", data: presentationRelsXml(slides) },
    { name: "ppt/theme/theme1.xml", data: themeXml() },
    { name: "ppt/slideMasters/slideMaster1.xml", data: slideMasterXml() },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: slideMasterRelsXml() },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: slideLayoutXml() },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: slideLayoutRelsXml() },
  ];
  slides.forEach((slide, i) => {
    entries.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(slide, i) });
    entries.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: slideRelsXml() });
  });
  return createZip(entries);
}

function main() {
  const markdown = fs.readFileSync(INPUT, "utf8");
  const slides = parseMarkdownSlides(markdown).slice(0, 14);
  if (!slides.length) throw new Error("No slides parsed from Markdown.");
  const pptx = buildPptx(slides);
  fs.writeFileSync(OUTPUT, pptx);
  console.log(`Generated ${path.relative(ROOT, OUTPUT)} with ${slides.length} slides.`);
}

main();
