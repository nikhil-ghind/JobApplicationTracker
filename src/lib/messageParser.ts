// Email message parser: derive company, role, source, status, eventType, eventDate, confidence from Gmail message fields

export type RawGmailMessageInput = {
  subject?: string | null
  headers?: Record<string, string | string[] | undefined> | null
  snippet?: string | null
  text?: string | null
}

export type ApplicationStatusString =
  | 'Applied'
  | 'InReview'
  | 'Assessment'
  | 'PhoneScreen'
  | 'Interview'
  | 'Onsite'
  | 'Offer'
  | 'Rejected'
  | 'Withdrawn'
  | 'Ghosted'

export type ParsedEmailEvent = {
  company?: string
  role?: string
  source: string
  status: ApplicationStatusString
  eventType: string
  eventDate: Date
  confidence: number // 0..1
}

// Known ATS domains (extendable)
const ATS_DOMAINS: Record<string, RegExp[]> = {
  Greenhouse: [/greenhouse\.io/, /notifications\.greenhouse\.io/],
  Lever: [/lever\.co/, /jobs\.lever\.co/],
  Workday: [/workday\.com/, /myworkdayjobs\.com/],
  Taleo: [/taleo\.net/, /oraclecloud\.com/],
  Ashby: [/ashbyhq\.com/],
  SmartRecruiters: [/smartrecruiters\.com/],
  iCIMS: [/icims\.com/],
  Jobvite: [/jobvite\.com/],
  Workable: [/workable\.com/, /workablemail\.com/],
  BreezyHR: [/breezy\.hr/],
  BambooHR: [/bamboohr\.com/],
  SuccessFactors: [/successfactors\.com/],
}

// Status keyword mapping (lowercase; extendable)
const STATUS_KEYWORDS: Record<ApplicationStatusString, string[]> = {
  Applied: [
    'applied',
    'application received',
    'we received your application',
    'thanks for applying',
    'submission received',
    'received your application',
  ],
  InReview: [
    'under review',
    'reviewing your application',
    'considering your application',
    'shortlisted',
  ],
  Assessment: [
    'assessment',
    'take-home',
    'take home',
    'challenge',
    'coding challenge',
    'test',
  ],
  PhoneScreen: ['phone screen', 'screening call', 'recruiter call'],
  Interview: ['interview scheduled', 'interview', 'technical interview', 'panel interview'],
  Onsite: ['onsite', 'on-site', 'on site'],
  Offer: ['offer', 'offer letter'],
  Rejected: [
    'unfortunately',
    'not moving forward',
    'not selected',
    'rejection',
    'declined',
    "we're moving forward with other candidates",
    'we are moving forward with other candidates',
  ],
  Withdrawn: ['withdrawn', 'withdraw your application', 'application withdrawn', 'cancelled application'],
  Ghosted: [], // Generally not inferred from a single email
}

// Event type by status default mapping
const DEFAULT_EVENT_FOR_STATUS: Record<ApplicationStatusString, string> = {
  Applied: 'application_submitted',
  InReview: 'status_update',
  Assessment: 'assessment_assigned',
  PhoneScreen: 'phone_screen_scheduled',
  Interview: 'interview_scheduled',
  Onsite: 'interview_scheduled',
  Offer: 'offer_received',
  Rejected: 'rejection',
  Withdrawn: 'withdrawal',
  Ghosted: 'status_update',
}

function normalizeText(s?: string | null): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function lcAll(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => normalizeText(p)).filter(Boolean).join(' ').toLowerCase()
}

function getHeader(headers: RawGmailMessageInput['headers'], name: string): string | undefined {
  if (!headers) return undefined
  const v = headers[name] ?? headers[name.toLowerCase()]
  if (!v) return undefined
  return Array.isArray(v) ? v.join(' ') : v
}

function extractDomainsFromHeaders(headers: RawGmailMessageInput['headers']): string[] {
  const values: string[] = []
  if (!headers) return values
  for (const k of Object.keys(headers)) {
    const v = getHeader(headers, k)
    if (v) values.push(v)
  }
  const text = values.join(' ')
  const domains = new Set<string>()
  const regex = /([a-z0-9.-]+\.[a-z]{2,})/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(text))) {
    domains.add(m[1].toLowerCase())
  }
  return Array.from(domains)
}

function detectSource(headers: RawGmailMessageInput['headers']): string {
  const domains = extractDomainsFromHeaders(headers)
  for (const [source, patterns] of Object.entries(ATS_DOMAINS)) {
    if (patterns.some((re) => domains.some((d) => re.test(d)))) {
      return source
    }
  }
  // Fallback: use From domain if present
  const from = getHeader(headers, 'From') || getHeader(headers, 'Return-Path') || getHeader(headers, 'Sender')
  if (from) {
    const m = from.toLowerCase().match(/([a-z0-9.-]+\.[a-z]{2,})/)
    if (m) return m[1]
  }
  return 'email'
}

function pickBestStatus(contentLc: string): ApplicationStatusString {
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS) as [ApplicationStatusString, string[]][]) {
    if (keywords.some((kw) => contentLc.includes(kw))) {
      return status
    }
  }
  // If no keyword matched, assume InReview for neutral updates
  return 'InReview'
}

function decideEventType(status: ApplicationStatusString, contentLc: string): string {
  // Override defaults if explicit phrases exist
  if (contentLc.includes('interview') && contentLc.includes('scheduled')) return 'interview_scheduled'
  if (contentLc.includes('assessment')) return 'assessment_assigned'
  if (contentLc.includes('offer')) return 'offer_received'
  if (contentLc.includes('phone screen')) return 'phone_screen_scheduled'
  return DEFAULT_EVENT_FOR_STATUS[status]
}

function parseDateFromHeaders(headers: RawGmailMessageInput['headers']): Date {
  const dh = getHeader(headers, 'Date') || getHeader(headers, 'date')
  if (dh) {
    const d = new Date(dh)
    if (!isNaN(d.getTime())) return d
  }
  // Fallback: try Received headers
  const received = getHeader(headers, 'Received') || getHeader(headers, 'received')
  if (received) {
    // Extract last date-like token
    const m = received.match(/[A-Z][a-z]{2},? \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} [+-]\d{4}/)
    if (m) {
      const d = new Date(m[0])
      if (!isNaN(d.getTime())) return d
    }
  }
  return new Date()
}

function extractCompany(subject?: string | null, headers?: RawGmailMessageInput['headers'], content?: string): string | undefined {
  const from = getHeader(headers, 'From')
  if (from) {
    // Try display name part: "Company <noreply@...>"
    const nameMatch = from.match(/^([^<]+)</)
    const name = nameMatch ? nameMatch[1].trim() : undefined
    if (name && !/noreply|no-reply|notifications|do\s*not\s*reply/i.test(name)) {
      // Remove common suffixes
      return name.replace(/\b(inc\.?|llc|corp\.?|co\.?|company)\b/i, '').trim()
    }
  }
  const s = normalizeText(subject)
  const c = normalizeText(content)
  const combined = `${s} ${c}`
  // Patterns like "at {Company}", "from {Company}", "to {Company}"
  const atMatch = combined.match(/\b(?:at|from|to)\s+([A-Z][A-Za-z0-9&'\-]*(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,3})\b/)
  if (atMatch) return atMatch[1].trim()
  // Fallback: subject leading capitalized words
  const leadMatch = s.match(/^([A-Z][A-Za-z0-9&'\-]*(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,3})\b/)
  if (leadMatch) return leadMatch[1].trim()
  return undefined
}

function cleanRole(raw: string): string {
  return raw.replace(/[\s\-–—]+$/, '').replace(/^[\s\-–—]+/, '').trim()
}

function extractRole(subject?: string | null, content?: string): string | undefined {
  const s = normalizeText(subject)
  const c = normalizeText(content)
  const combined = `${s} ${c}`
  // Common patterns
  const patterns: RegExp[] = [
    /\b(?:for|the)\s+(?:role|position|job)\s+(?:of\s+)?([^.,;\n]+)\b/i,
    /\b(?:role|position|job)[:\s\-]+([^.,;\n]+)\b/i,
    /\bapplicati(?:on|ons)\s+for\s+([^.,;\n]+)\b/i,
  ]
  for (const re of patterns) {
    const m = combined.match(re)
    if (m) return cleanRole(m[1])
  }
  // Fallback: extract between "for" and "at"
  const m2 = combined.match(/for\s+([^.,;\n]+?)\s+at\s+/i)
  if (m2) return cleanRole(m2[1])
  return undefined
}

function computeConfidence(source: string, statusMatched: boolean, role?: string, company?: string): number {
  let score = 0.3 // base
  // Source matched to known ATS increases confidence
  if (Object.keys(ATS_DOMAINS).includes(source)) score += 0.25
  // Status keyword found
  if (statusMatched) score += 0.25
  if (role) score += 0.1
  if (company) score += 0.1
  if (score > 1) score = 1
  return Number(score.toFixed(2))
}

export function parseGmailMessage(input: RawGmailMessageInput): ParsedEmailEvent {
  const subject = input.subject ?? ''
  const text = input.text ?? ''
  const snippet = input.snippet ?? ''
  const allLc = lcAll(subject, snippet, text)

  const source = detectSource(input.headers ?? null)
  const status = pickBestStatus(allLc)
  const eventType = decideEventType(status, allLc)
  const eventDate = parseDateFromHeaders(input.headers ?? null)

  const company = extractCompany(subject, input.headers ?? null, `${snippet} ${text}`)
  const role = extractRole(subject, `${snippet} ${text}`)

  const statusMatched = STATUS_KEYWORDS[status].some((kw) => allLc.includes(kw))
  const confidence = computeConfidence(source, statusMatched, role, company)

  return { company, role, source, status, eventType, eventDate, confidence }
}