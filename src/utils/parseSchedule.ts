import type { Schedule } from '../types'

export type ParsedSchedule = Omit<Schedule, 'id' | 'notified' | 'completed'>

const pad = (n: number) => n.toString().padStart(2, '0')

const CN_NUM: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
}

const WEEKDAY: Record<string, number> = {
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
}

function cnToNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  // 支持 "十", "十一", "二十", "二十三" 等中文数字
  if (!s) return null
  const idx = s.indexOf('十')
  if (idx === -1) {
    let v = 0
    for (const ch of s) {
      if (CN_NUM[ch] === undefined) return null
      v = v * 10 + CN_NUM[ch]
    }
    return v
  }
  const tens = idx === 0 ? 1 : (CN_NUM[s[0]] ?? NaN)
  const ones = idx === s.length - 1 ? 0 : (CN_NUM[s[idx + 1]] ?? NaN)
  if (isNaN(tens) || isNaN(ones)) return null
  return tens * 10 + ones
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 从文本中解析出日期，返回 YYYY-MM-DD 及匹配到的原始片段 */
function parseDate(text: string, now: Date): { date: string; matched: string } | null {
  const addDays = (base: Date, n: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return d
  }

  // 完整日期：2026/10/12、2026-10-12、2026.10.12、2026年10月12日
  const full = text.match(/(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})\s*日?/)
  if (full) {
    const d = new Date(+full[1], +full[2] - 1, +full[3])
    if (!isNaN(d.getTime())) return { date: fmt(d), matched: full[0] }
  }

  // 无年份：10/12、10月12日、10-12（过期则顺延到明年）
  const md = text.match(/(\d{1,2})\s*[/\-.月]\s*(\d{1,2})\s*日?/)
  if (md) {
    const month = +md[1]
    const day = +md[2]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let d = new Date(now.getFullYear(), month - 1, day)
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        d = new Date(now.getFullYear() + 1, month - 1, day)
      }
      if (!isNaN(d.getTime())) return { date: fmt(d), matched: md[0] }
    }
  }

  // 相对日期：今天 / 明天 / 后天 / 大后天
  const rel = text.match(/大后天|后天|明天|明日|今天|今日/)
  if (rel) {
    const map: Record<string, number> = { 今天: 0, 今日: 0, 明天: 1, 明日: 1, 后天: 2, 大后天: 3 }
    return { date: fmt(addDays(now, map[rel[0]])), matched: rel[0] }
  }

  // 星期：下周三 / 周五 / 星期天 / 礼拜一
  const wk = text.match(/(下\s*)?(?:周|星期|礼拜)\s*([一二三四五六日天])/)
  if (wk) {
    const target = WEEKDAY[wk[2]]
    const isNext = !!wk[1]
    const cur = now.getDay()
    let diff = (target - cur + 7) % 7
    if (isNext) {
      // "下周X"：先补到本周末再进入下一周
      diff += 7
      if (diff > 7 && target === cur) diff -= 0
    } else if (diff === 0) {
      diff = 7 // 今天已过则顺延一周
    }
    return { date: fmt(addDays(now, diff)), matched: wk[0] }
  }

  return null
}

/** 从文本中解析出时间，返回 HH:MM 及匹配片段 */
function parseTime(text: string): { time: string; matched: string } | null {
  const norm = (h: number, m: number) => `${pad(h % 24)}:${pad(m)}`

  const isPM = (mer?: string) =>
    mer && /(pm|下午|晚上|傍晚|夜里|夜晚)/i.test(mer)
  const isAM = (mer?: string) =>
    mer && /(am|上午|早上|早晨|凌晨|清晨)/i.test(mer)

  function adjust(h: number, mer?: string): number {
    if (isPM(mer) && h < 12) return h + 12
    if (isAM(mer) && h === 12) return 0
    if (/(中午|正午)/.test(mer || '') && h < 12) return h === 12 ? 12 : h
    return h
  }

  // 11:59 PM / 11:59PM / 23:59 / 下午 4:45（兼容全角冒号，OCR 常见）
  const colon = text.match(
    /(凌晨|清晨|早上|早晨|上午|中午|正午|下午|傍晚|晚上|夜里|夜晚)?\s*(\d{1,2})[:：](\d{2})\s*(AM|PM|am|pm)?/
  )
  if (colon) {
    let h = +colon[2]
    const m = +colon[3]
    const mer = colon[1] || colon[4]
    if (mer) h = adjust(h, mer)
    if (h <= 23 && m <= 59) return { time: norm(h, m), matched: colon[0] }
  }

  // 中文时段 + 数字/中文时间：下午3点、上午9点半、晚上8点30分、9时15分
  const cn = text.match(
    /(凌晨|清晨|早上|早晨|上午|中午|正午|下午|傍晚|晚上|夜里|夜晚)?\s*([0-9一二三四五六七八九十两]{1,3})\s*[点时:：]\s*(半|[0-9一二三四五六七八九十]{1,3})?\s*分?/
  )
  if (cn) {
    const mer = cn[1]
    const hRaw = cnToNumber(cn[2])
    if (hRaw !== null && hRaw >= 0 && hRaw <= 23) {
      let h = adjust(hRaw, mer)
      let m = 0
      if (cn[3] === '半') m = 30
      else if (cn[3]) {
        const mm = cnToNumber(cn[3])
        if (mm !== null && mm <= 59) m = mm
      }
      return { time: norm(h, m), matched: cn[0] }
    }
  }

  return null
}

/** 从文本中提取标题 */
function parseTitle(text: string, consumed: string[]): string | null {
  // 1. 显式标签：日程表 / 标题 / 事项 / 任务 / 会议 / 提醒 / title 等，后接 : ：
  const labelRe =
    /(?:日程表|日程安排|日程|标题|事项|事件|任务|待办|会议|主题|提醒|安排|活动|title|subject|topic|event|todo|task)\s*[:：]\s*([^\n]+)/i
  const lm = text.match(labelRe)
  if (lm) {
    const t = lm[1].trim()
    if (t) return t
  }

  // 2. 无标签：取第一行不含日期/时间信息的有效文本
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    const stripped = stripDateTime(line, consumed)
    if (stripped && stripped.length >= 2 && !isLabelOnly(stripped)) {
      return stripped
    }
  }
  return null
}

function stripDateTime(line: string, consumed: string[]): string {
  let s = line
  for (const c of consumed) {
    if (c) s = s.split(c).join('')
  }
  // 去掉常见前缀标签（仅当后接冒号时，避免误删正文中的普通词）
  s = s.replace(
    /(截止日期|截止时间|到期时间|到期日|时间|日期|deadline|due\s*date|due|dt)\s*[:：]/gi,
    ''
  )
  // 去掉残留的日期/时间片段
  s = s.replace(/(\d{4}|\d{1,2})\s*[/\-.年月]\s*\d{1,2}\s*[/\-.月日]?\s*\d{0,2}\s*日?/g, '')
  s = s.replace(/\d{1,2}[:：]\d{2}\s*(AM|PM|am|pm)?/g, '')
  s = s.replace(/\d{1,2}\s*[点时]\s*(半|\d{1,2})?\s*分?/g, '')
  s = s.replace(/[，,、\s:：\-—~/]+$/g, '').replace(/^[，,、\s:：\-—~/]+/g, '')
  return s.trim()
}

function isLabelOnly(s: string): boolean {
  return /^(截止日期|截止时间|到期|时间|日期|备注|描述|deadline|due)$/i.test(s)
}

/** 提取描述：显式备注标签，或剩余的补充信息 */
function parseDescription(text: string, consumed: string[], title: string | null): string | undefined {
  const noteRe = /(?:备注|描述|说明|详情|内容|地点|位置|note|notes|desc|description|detail|details|location)\s*[:：]\s*([^\n]+)/i
  const nm = text.match(noteRe)
  if (nm) return nm[1].trim()

  // 收集标题与日期时间以外的信息行作为描述
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const rest: string[] = []
  for (const line of lines) {
    if (title && line.includes(title)) continue
    const stripped = stripDateTime(line, consumed)
    if (stripped && !isLabelOnly(stripped) && stripped !== title) rest.push(stripped)
  }
  return rest.length ? rest.join('；') : undefined
}

/**
 * 自适应解析一段自由文本为日程。
 * 可识别多种日期/时间/标题写法，返回 null 表示未能识别出有效日程。
 */
export function parseSchedule(text: string): ParsedSchedule | null {
  if (!text || !text.trim()) return null
  const now = new Date()

  const dateInfo = parseDate(text, now)
  const timeInfo = parseTime(text)

  // 至少要能识别出日期或标题，否则视为无效
  const consumed = [dateInfo?.matched, timeInfo?.matched].filter(Boolean) as string[]
  const title = parseTitle(text, consumed)

  if (!dateInfo && !title) return null

  const date = dateInfo?.date ?? fmt(now)
  const time = timeInfo?.time ?? '09:00'
  const description = parseDescription(text, consumed, title)

  return {
    title: title ?? '未命名日程',
    date,
    time,
    description,
  }
}
