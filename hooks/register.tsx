import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Group, Lang, Sess, Skill, View } from '../types'

type E = EngineInterface

const PANE = 'skills-panel'
const ACCENT = '#d97757'
const NARROW_PANE = 34
const MAX_HITS = 40 // search results shown
const MAX_ROWS = 100 // rows shown per category

// ---------- texts
// English is built in. Other languages are lang/<code>.json files with the same keys, picked from the
// Claude Desktop language. A key missing from a file falls back to English.
// {x} is a placeholder; { "one": …, "other": … } picks the plural form for {n}.

type Msg = string | { one?: string; other: string }
type Dict = Record<string, Msg>

const EN: Dict = {
  title: '✦ Skills',
  hint: 'Checked skills go with your next message',
  changes: { one: '{n} change will go with your next message', other: '{n} changes will go with your next message' },
  organize: 'Organize',
  done: 'Done',
  search: 'Search skills…',
  project: 'Project ({n})',
  save: '+ Save selection',
  pickFirst: 'Check some skills first, then save them.',
  selection: 'Selection {i}',
  native: 'Claude skills',
  presetsHelp: 'Presets: rename, replace with your current selection, or delete.',
  nSkills: { one: '{n} skill', other: '{n} skills' },
  rename: 'Rename',
  replace: '↻ Current selection',
  newPreset: '+ New preset from selection',
  resetPresets: 'Default presets',
  newCat: '+ New category',
  newCatName: 'New category {i}',
  resetLayout: 'Restore original categories',
  capped: 'First {max} of {total} results: refine your search to see the rest.',
  tooBig: 'The “{cat}” category has {n} skills: only the first {limit} are shown. Search for the others, or spread them out with Organize.',
  noMatch: 'No skill matches “{q}”. Try another word.',
  noPins: 'No skill is pinned to this project. Click P next to a skill to pin it.',
  stale: { one: '{n} skill may have been lost in the context summary.', other: '{n} skills may have been lost in the context summary.' },
  reload: '⟳ Reload',
  ghosts: { one: '{n} unchecked skill is still in memory. To start clean: /clear or a new session.', other: '{n} unchecked skills are still in memory. To start clean: /clear or a new session.' },
  checked: { one: 'skill checked', other: 'skills checked' },
  pinned: '{n} pinned to the project',
  subTitle: 'Pass to subagents',
  subHelp: 'Agents that Claude starts load these skills too',
  clear: 'Uncheck all',
  refresh: '↻ Reload list',
  loading: 'Loading the skill list…',
  narrow: 'Window too narrow: widen it to see the skills.',
  desktopOnly: 'This panel is made for the Claude Desktop app.',
  noDesc: 'No description.',
  reloadNext: '⟳ Will be reloaded with the next message.',
  staleState: '○ May have been lost in the context summary.',
  memOn: '● In memory, applied.',
  memOff: '● In memory, no longer applied.',
  pinnedState: 'Pinned to the project: checked by default in its new sessions.',
  'alt.on': 'checked',
  'alt.off': 'unchecked',
  'alt.some': 'partly checked',
  'alt.open': 'collapse',
  'alt.closed': 'expand',
  'alt.pin': 'pin to project',
  'alt.pinnedAlt': 'pinned to project',
  'alt.desc': 'description',
  'alt.info': 'information',
  'alt.ok': 'in memory',
  'alt.lost': 'may be lost',
  'alt.yes': 'on',
  'alt.no': 'off',
  'cats.browser': 'Browser & computer',
  'cats.claude': 'Claude Code',
  'cats.video': 'Video & audio',
  'cats.motion': 'Animation',
  'cats.design': 'Design & UI',
  'cats.data': 'Data & charts',
  'cats.docs': 'Writing & documents',
  'cats.code': 'Code & quality',
  'cats.other': 'Other',
  command: 'Open the skills panel',
  opened: 'Skills panel opened.',
  signal: '[Skills panel: user selection]',
  load: 'Before anything else, load these skills with the Skill tool (one call per skill), then follow their instructions: {list}.',
  drop: 'The user turned off these skills: {list}. Stop following their instructions, even if they are still in your context.',
  agent: '[Skills panel] Before you start, load with the Skill tool: {list}.',
}

/** One language's texts: plain strings, or functions whose arguments follow the order of the {x}. */
function strings(code: string, dict: Dict) {
  const plurals = new Intl.PluralRules(code)
  const fixed: Record<string, unknown> = { max: MAX_HITS, limit: MAX_ROWS }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L: Record<string, any> = { code, alt: {}, cats: {} }
  for (const [key, base] of Object.entries(EN)) {
    const msg = dict[key] ?? base
    const sample = typeof base === 'string' ? base : base.other
    const params = [...sample.matchAll(/\{(\w+)\}/g)].map(m => m[1]!).filter(k => !(k in fixed))
    const fill = (vars: Record<string, unknown>) => {
      const all = { ...fixed, ...vars }
      const text = typeof msg === 'string' ? msg : (plurals.select(Number(all.n ?? 0)) === 'one' && msg.one) || msg.other
      return text.replace(/\{(\w+)\}/g, (_, k: string) => String(all[k] ?? ''))
    }
    // a plural message with no {x} ("skills checked") takes the count as its first argument
    const names = params.length ? params : typeof msg === 'string' ? [] : ['n']
    const value = names.length ? (...args: unknown[]) => fill(Object.fromEntries(names.map((k, i) => [k, args[i]]))) : fill({})
    const [group, name] = key.split('.')
    if (name) L[group!][name] = value
    else L[key] = value
  }
  return L
}
type Str = ReturnType<typeof strings>

// Starting categories, matched on the skill's name first, then on its description; the rest goes to Other.
// Order matters: the first match wins.
const CATS: [string, RegExp][] = [
  ['browser', /\bbrowser|chrome|computer[- ]use|desktop app|screenshot/],
  ['claude', /claude code|claude\.md|\bhooks?\b|settings\.json|keybinding|permission|\bmcp\b|\bplugins?\b|\bmods?\b|skill[- ]creator|find-skills/],
  ['video', /video|audio|music|soundtrack|caption|subtitle|podcast|remotion|after effects|youtube|tiktok|voice-?over|text-to-speech/],
  ['motion', /animat|motion|easing|transition|gsap|lottie|keyframe|\bsvg\b/],
  ['design', /design|\bui\b|\bux\b|interface|logo|brand|typograph|figma|illustrat|\bicons?\b|glass|colou?r/],
  ['data', /\bdata\b|chart|dashboard|analytic|\bcsv\b|\bsql\b|statistic/],
  ['docs', /docx|\bpdf\b|pptx|xlsx|spreadsheet|document|writ|\bcopy\b|translat|research|humani|\bslides?\b/],
  ['code', /\bcode\b|coding|review|debug|\btests?\b|refactor|\bgit\b|security|\bapi\b|\brepo|\bbugs?\b|lint|deploy|typescript|python|swift/],
]
// The name says what a skill is; a description can mention other topics in passing.
const category = (s: Skill, L: Str) => {
  const match = (text: string) => CATS.find(([, rx]) => rx.test(text.toLowerCase()))?.[0]
  return L.cats[match(s.name) ?? match(s.desc) ?? 'other']
}

// Skills that ship with Claude and have no readable file: a short description, translated like the others.
const BUILTIN: Record<string, string> = {
  'anthropic-skills:built-in-browser': "Use the Claude app's built-in browser.",
  'anthropic-skills:chrome-browser': 'Drive Chrome through Claude in Chrome.',
  'anthropic-skills:computer-use': 'Control apps on the computer.',
  'anthropic-skills:consolidate-memory': 'Tidy up memories.',
  'anthropic-skills:deep-research': 'Deep multi-source research.',
  'anthropic-skills:docs': 'Create and edit Claude Docs.',
  'anthropic-skills:docx': 'Create and edit Word documents.',
  'anthropic-skills:explain-usage': 'Explain usage and limits.',
  'anthropic-skills:google-workspace': 'Work with Drive, Docs, Sheets and mail.',
  'anthropic-skills:import-memory': 'Import memories.',
  'anthropic-skills:morning': 'Morning briefing: calendar, messages, priorities.',
  'anthropic-skills:pdf': 'Read, fill in and produce PDFs.',
  'anthropic-skills:pptx': 'Create and edit PowerPoint decks.',
  'anthropic-skills:setup-claude': 'Guided setup: plugins, tools, first skill.',
  'anthropic-skills:skill-creator': 'Create, test and improve a skill.',
  'anthropic-skills:xlsx': 'Create and edit Excel workbooks.',
  'update-config': 'Configure Claude Code: hooks, permissions, variables.',
  'keybindings-help': 'Customize keyboard shortcuts.',
  'code-review': 'Review a diff or PR for bugs.',
  simplify: 'Clean up changed code.',
  'fewer-permission-prompts': 'Reduce repeated permission prompts.',
  loop: 'Run a command on an interval.',
  schedule: 'Schedule recurring cloud agents.',
  'claude-api': 'Claude API and Anthropic SDK reference.',
  run: "Run the project's app to check a change.",
  'plugin-authoring': 'Make a mod: panel, command, hook.',
  init: 'Create a CLAUDE.md for the project.',
  'security-review': 'Security review of the code.',
}

// ---------- drawings (SVG)
// A drawing carries its animation <style> only when its state just changed (the `fresh` set): the app
// redraws the whole panel on every click, and only the drawing that changed should move. Interactive
// mode plays the animation but reloads its frame on each redraw, so still drawings stay images.

const EASE = 'cubic-bezier(0.32,0.72,0,1)'
const POP = 'cubic-bezier(0.34,1.56,0.64,1)'
const css = (rules: string) =>
  `<style>${rules}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>`
const svg = (w: number, h: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`

const box = (state: 0 | 1 | 2) => {
  if (state === 0)
    return svg(16, 16, css('.e{animation:e 140ms ease-out backwards}@keyframes e{from{opacity:.4}}') +
      '<rect class="e" x="1" y="1" width="14" height="14" rx="4" fill="none" stroke="#ffffff47" stroke-width="1.5"/>')
  const mark = state === 1
    ? '<path class="k" d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1"/>'
    : '<path class="k" d="M5 8h6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" pathLength="1" stroke-dasharray="1"/>'
  return svg(16, 16,
    css(`.b{transform-origin:8px 8px;animation:b 180ms ${POP} backwards}@keyframes b{from{transform:scale(.82);fill-opacity:.2}}` +
      `.k{animation:k 200ms ${EASE} 60ms backwards}@keyframes k{from{stroke-dashoffset:1}}`) +
    `<rect class="b" x="1" y="1" width="14" height="14" rx="4" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="1.5"/>` + mark)
}
const BOX = [box(0), box(1), box(2)] as const

const DOT = {
  ok: svg(14, 14,
    css(`.d{transform-origin:7px 7px;animation:d 260ms ${POP} backwards}@keyframes d{from{transform:scale(.3);opacity:0}}` +
      `.r{transform-origin:7px 7px;opacity:0;animation:r 700ms ${EASE} 120ms}@keyframes r{from{transform:scale(.6);opacity:.55}to{transform:scale(1.9);opacity:0}}`) +
    `<circle class="r" cx="7" cy="7" r="3.5" fill="none" stroke="${ACCENT}" stroke-width="1.2"/><circle class="d" cx="7" cy="7" r="3.5" fill="${ACCENT}"/>`),
  stale: svg(14, 14,
    css(`.s{animation:s 600ms ${EASE} backwards}@keyframes s{from{fill-opacity:1}}`) +
    `<circle class="s" cx="7" cy="7" r="3" fill="${ACCENT}" fill-opacity="0" stroke="${ACCENT}" stroke-width="1.3"/>`),
} as const

const pinPill = (on: boolean) =>
  svg(20, 16,
    (on ? css(`.f{animation:f 220ms ${EASE} backwards}@keyframes f{from{transform:translateY(13px)}}`) : '') +
    '<defs><clipPath id="c"><rect x="0.75" y="1.75" width="18.5" height="12.5" rx="6.25"/></clipPath></defs>' +
    `<rect x="0.75" y="1.75" width="18.5" height="12.5" rx="6.25" fill="none" stroke="${on ? ACCENT : '#ffffff2e'}" stroke-width="1"/>` +
    (on ? `<g clip-path="url(#c)"><rect class="f" x="0" y="1" width="20" height="14" fill="${ACCENT}"/></g>` : '') +
    `<text x="10" y="11.4" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="${on ? '#ffffff' : '#ffffff59'}">P</text>`)
const PIN = { on: pinPill(true), off: pinPill(false) } as const

// The resting rotation sits in the <g> attribute, so it survives when the <style> is stripped.
const chev = (open: boolean) =>
  svg(14, 14,
    css(`.c{transform-origin:7px 7px;animation:c 240ms ${EASE} backwards}@keyframes c{from{transform:rotate(${open ? -90 : 90}deg)}}`) +
    `<g transform="rotate(${open ? 90 : 0} 7 7)"><path class="c" d="M5.5 3.5L9 7l-3.5 3.5" fill="none" stroke="#ffffff80" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`)
const CHEV = { open: chev(true), closed: chev(false) } as const

const INFO = svg(16, 16,
  '<circle cx="8" cy="8" r="6.5" fill="none" stroke="#ffffff2e" stroke-width="1"/>' +
  '<text x="8" y="11.3" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="9" font-weight="700" fill="#ffffff59">i</text>')

const sw = (on: boolean) =>
  svg(28, 16,
    css(`.k{animation:k 220ms ${EASE} backwards}@keyframes k{from{transform:translateX(${on ? -12 : 12}px)}}.t{animation:t 220ms ease backwards}@keyframes t{from{fill-opacity:${on ? 0.25 : 1}}}`) +
    `<rect class="t" x="1" y="1.5" width="26" height="13" rx="6.5" fill="${on ? ACCENT : '#ffffff26'}"/>` +
    `<circle class="k" cx="${on ? 20.5 : 7.5}" cy="8" r="5" fill="#ffffff"/>`)
const SWITCH = { on: sw(true), off: sw(false) } as const

let fresh = new Set<string>()
const touch = (...keys: string[]) => { fresh = new Set(keys) }
const still = (source: string) => source.replace(/<style>[\s\S]*?<\/style>/, '')
const moving = (source: string) => (source.includes('<style>') ? true : undefined)

// ---------- state

const EMPTY: Sess = { on: [], mem: {}, sent: [], reload: [] }
const VIEW: View = { q: '', open: [], org: false, proj: false, sub: false }

const sessA = atom({ plugin: 'skills-panel', key: 'session' } as const, EMPTY, { shape: 'sess-1' })
const catA = atom({ plugin: 'skills-panel', key: 'catalog' } as const, [] as Skill[], { shape: 'cat-2' })
const layoutA = atom({ plugin: 'skills-panel', key: 'layout' } as const, [] as Group[], { shape: 'layout-1' })
const pinsA = atom({ plugin: 'skills-panel', key: 'pins' } as const, [] as string[], { shape: 'pins-1' })
const viewA = atom({ plugin: 'skills-panel', key: 'view' } as const, VIEW, { shape: 'view-1' })
const presetsA = atom({ plugin: 'skills-panel', key: 'presets' } as const, {} as Record<string, string[]>, { shape: 'presets-1' })
const langA = atom({ plugin: 'skills-panel', key: 'lang' } as const, { code: 'en', dict: {} } as Lang, { shape: 'lang-2' })
const textsOf = async ($: E) => { const l = await read($, langA); return strings(l.code, l.dict as Dict) }

const uniq = (a: string[]) => [...new Set(a)]
const toggle = (list: string[], n: string) => (list.includes(n) ? list.filter(x => x !== n) : [...list, n])

function firstSentence(md: string): string {
  const fm = /^---\s*\n([\s\S]*?)\n---/.exec(md)?.[1] ?? ''
  const d = /^description:\s*([\s\S]*?)(?=^\w[\w-]*:|$(?![\s\S]))/m.exec(fm)?.[1] ?? ''
  let s = d.replace(/^[>|][-+]?\s*/, '').split(/\s+/).join(' ').trim().replace(/^["']|["']$/g, '')
  s = s.replace(/^This skill should be used when the user asks to /, 'When you ask to ')
  s = s.split(/(?<=\.)\s/)[0] ?? s
  return s.length > 180 ? s.slice(0, 177).trimEnd() + '…' : s
}

/** The saved layout, plus any skills it doesn't know about yet. */
function groups(cat: Skill[], lay: Group[], L: Str): Group[] {
  const names = new Set(cat.map(s => s.name))
  const seen = new Set<string>()
  const out = lay.map(g => ({ cat: g.cat, skills: g.skills.filter(n => names.has(n) && !seen.has(n) && (seen.add(n), true)) }))
  for (const s of cat) {
    if (seen.has(s.name)) continue
    const c = category(s, L)
    let g = out.find(x => x.cat === c)
    if (!g) out.push((g = { cat: c, skills: [] }))
    g.skills.push(s.name)
  }
  if (lay.length) return out
  // no saved layout: categories in CATS order, Other last
  const order = [...CATS.map(([k]) => L.cats[k]), L.cats.other]
  return out.filter(g => g.skills.length).sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat))
}

const sessKey = async ($: E) => 'sess:' + (await $.session.id())
const pinsKey = async ($: E) => 'pins:' + (await $.session.cwd())

async function setSess($: E, fn: (s: Sess) => Sess) {
  await update($, sessA, s => fn(s ?? EMPTY))
  await $.store.set(await sessKey($), await read($, sessA))
}
async function setView($: E, fn: (v: View) => View) {
  await update($, viewA, v => fn(v ?? VIEW))
}
async function setLayout($: E, fn: (g: Group[]) => Group[]) {
  const cur = groups(await read($, catA), await read($, layoutA), await textsOf($))
  const next = fn(cur.map(g => ({ cat: g.cat, skills: [...g.skills] })))
  await update($, layoutA, () => next)
  await $.store.set('layout', next)
}

const home = async ($: E) => (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''

// The Claude Desktop language is in its config.json; then LANG; then English.
async function detectLang($: E): Promise<Lang> {
  const root = await home($)
  const local = (await $.env.get('LOCALAPPDATA')) ?? ''
  const roaming = (await $.env.get('APPDATA')) ?? ''
  const configs = [
    `${local}/Claude-Data/claude_pzs8sxrjxfjjc/config.json`, // Windows (Microsoft Store)
    `${roaming}/Claude/config.json`, // Windows
    `${root}/Library/Application Support/Claude/config.json`, // macOS
    `${root}/.config/Claude/config.json`, // Linux
  ]
  let locale = ''
  for (const path of configs) {
    locale = await $.fs.read(path).then(t => String(JSON.parse(t).locale ?? ''), () => '')
    if (locale) break
  }
  const code = (locale || (await $.env.get('LANG')) || 'en').toLowerCase().slice(0, 2)
  if (code === 'en') return { code, dict: {} }
  const dict = await $.fs.read(`${$.plugin.root}/lang/${code}.json`).then(t => JSON.parse(t) as Dict, () => undefined)
  return dict ? { code, dict } : { code: 'en', dict: {} }
}

// Descriptions translated by Claude into the app's language, once per skill, cached in the store.
// A skill whose description changes is translated again.
async function translate($: E) {
  const { code } = await read($, langA)
  if (code === 'en') return
  const key = 'tr:' + code
  const cache = ((await $.store.get(key)) as Record<string, [string, string]> | undefined) ?? {}
  const todo = (await read($, catA)).filter(x => x.desc && cache[x.name]?.[0] !== x.desc)
  for (let i = 0; i < todo.length; i += 40) {
    const batch = Object.fromEntries(todo.slice(i, i + 40).map(x => [x.name, x.desc]))
    const r = await $.model.complete({
      model: 'haiku',
      system: `Translate each value of the JSON object into the language with code "${code}". Keep the keys, product names and code identifiers unchanged. Answer with the JSON object only.`,
      prompt: JSON.stringify(batch),
      maxTokens: 8000,
      timeoutMs: 120000,
    })
    if (!r.isAnswered) return
    let out: Record<string, string> = {}
    try {
      out = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1))
    } catch {
      return
    }
    for (const [name, src] of Object.entries(batch)) if (typeof out[name] === 'string') cache[name] = [src, out[name]!]
    await $.store.set(key, cache)
    await update($, catA, cat => (cat ?? []).map(x => (cache[x.name]?.[0] === x.desc ? { ...x, tr: cache[x.name]![1] } : x)))
  }
}

async function loadCatalog($: E) {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const listed = usage.context.breakdown?.skills?.skillFrontmatter ?? []
  if (!listed.length) return
  const L = await textsOf($)
  const tr = ((await $.store.get('tr:' + L.code)) as Record<string, [string, string]> | undefined) ?? {}
  const root = await home($)
  let plugins: Record<string, { installPath?: string }[]> = {}
  try {
    plugins = JSON.parse(await $.fs.read(`${root}/.claude/plugins/installed_plugins.json`)).plugins ?? {}
  } catch {
    // no plugins installed
  }
  const out: Skill[] = []
  for (const s of listed) {
    const short = s.name.slice(s.name.lastIndexOf(':') + 1)
    let path: string | undefined
    if (s.source === 'userSettings') path = `${root}/.claude/skills/${s.name}/SKILL.md`
    else if (s.pluginName) {
      const key = Object.keys(plugins).find(k => k.split('@')[0] === s.pluginName)
      const dir = key ? plugins[key]?.[0]?.installPath : undefined
      if (dir) path = `${dir}/skills/${short}/SKILL.md`
    }
    let desc = ''
    if (path) desc = await $.fs.read(path).then(firstSentence, () => '')
    // native: ships with Claude, not installed by the user or a third-party plugin
    const native = s.name.startsWith('anthropic-skills:') || (!s.pluginName && s.source !== 'userSettings' && s.source !== 'projectSettings')
    desc ||= BUILTIN[s.name] ?? BUILTIN[short] ?? ''
    out.push({ name: s.name, source: String(s.source), desc, native, tr: tr[s.name]?.[0] === desc ? tr[s.name]![1] : undefined })
  }
  await update($, catA, () => out)
  // first run: one preset with the native skills; the rest is up to the user
  if ((await $.store.get('presets')) === undefined) {
    const natives = out.filter(x => x.native).map(x => x.name)
    await update($, presetsA, () => (natives.length ? { [L.native]: natives } : {}))
  }
  void translate($).catch(() => undefined)
}

// ---------- the mod

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    const lang = await detectLang($)
    await update($, langA, () => lang)
    await $.command.register({ name: 'skills-panel', description: strings(lang.code, lang.dict as Dict).command })
    const pins = ((await $.store.get(await pinsKey($))) as string[] | undefined) ?? []
    const saved = (await $.store.get(await sessKey($))) as Sess | undefined
    await update($, pinsA, () => pins)
    const lay = ((await $.store.get('layout')) as Group[] | undefined) ?? []
    await update($, layoutA, () => lay)
    const presets = (await $.store.get('presets')) as Record<string, string[]> | undefined
    if (presets) await update($, presetsA, () => presets)
    const sub = (await $.store.get('sub')) as boolean | undefined
    await setView($, v => ({ ...v, sub: sub ?? false }))
    // resumed session: saved state; new session: the project's pinned skills, checked
    await update($, sessA, s => saved ?? (s && (s.on.length || s.sent.length) ? s : { ...EMPTY, on: [...pins] }))
    void loadCatalog($).catch(() => undefined)
    return ran
  })

  on('command.run', { command: 'skills-panel' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Skills' })
    return { text: (await textsOf($)).opened }
  })

  // On send, the difference between checked and already sent goes with the message, out of sight.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    if (!(await read($, catA)).length) void loadCatalog($).catch(() => undefined)
    const L = await textsOf($)
    const s = await read($, sessA)
    const load = uniq([...s.on.filter(n => !s.sent.includes(n)), ...s.reload.filter(n => s.on.includes(n))])
    const drop = s.sent.filter(n => !s.on.includes(n))
    if (!load.length && !drop.length) return next(e)
    const lines = [L.signal]
    if (load.length) lines.push(L.load(load.join(', ')))
    if (drop.length) lines.push(L.drop(drop.join(', ')))
    await setSess($, x => ({ ...x, sent: [...x.on], reload: [] }))
    return next({ ...e, context: [...(e.context ?? []), lines.join('\n')] })
  }).catch(($, e, next) => next(e))

  // A skill counts as loaded once the engine has actually loaded it.
  on('skill.prompt', async ($, e, next) => {
    const ran = await next(e)
    if ((await read($, sessA)).mem[e.skill] !== 'ok') touch('dot:' + e.skill)
    await setSess($, x => ({ ...x, mem: { ...x.mem, [e.skill]: 'ok' } }))
    return ran
  })

  // After a context summary, skill instructions may be gone.
  on('session.compact', async ($, e, next) => {
    const ran = await next(e)
    if (!e.agentId) {
      touch(...Object.keys((await read($, sessA)).mem).map(n => 'dot:' + n))
      await setSess($, x => ({ ...x, mem: Object.fromEntries(Object.keys(x.mem).map(n => [n, 'stale' as const])) }))
    }
    return ran
  })

  // Option (off by default): subagents receive the selection.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const s = await read($, sessA)
    if (!(await read($, viewA)).sub || !s.on.length || e.subagent_type === 'fork') return next(e)
    return next({ ...e, prompt: `${e.prompt}\n\n${(await textsOf($)).agent(s.on.join(', '))}` })
  }).catch(($, e, next) => next(e))

  // The ✦ n button under the prompt box. This area won't color buttons and refuses SVG,
  // so a filled star means a skill is loaded and a hollow one means none is.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const s = await read($, sessA)
    const { Box, Button } = $.ui.resolve(e)
    const engine = await next(e)
    const flip = async () => {
      if ((await $.ui.panes()).some(p => p.id === PANE)) await $.ui.close({ id: PANE })
      else await $.ui.open({ id: PANE, title: 'Skills' })
    }
    const loaded = Object.values(s.mem).some(st => st === 'ok')
    return (
      <Box flexDirection="row" gap="sm" alignItems="center">
        {engine}
        <Button key="sk-icon" plain onPress={() => void flip()}>{`${loaded ? '✦' : '✧'} ${s.on.length}`}</Button>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text, Input, Select, Svg } = $.ui.resolve(e)
    const L = await textsOf($)
    if (e.surface !== 'desktop') return <Text dimColor>{L.desktopOnly}</Text>
    if (e.props.bodyColumns < NARROW_PANE) return <Text dimColor>{L.narrow}</Text>
    const s = await read($, sessA)
    const v = await read($, viewA)
    const cat = await read($, catA)
    const pins = await read($, pinsA)
    const presets = await read($, presetsA)
    if (!cat.length)
      return (
        <Box flexDirection="column" gap="sm">
          <Text dimColor>{L.loading}</Text>
          <Button key="reload-cat" label={L.refresh} onPress={() => void loadCatalog($)} />
        </Box>
      )

    const desc = Object.fromEntries(cat.map(x => [x.name, x.tr ?? x.desc]))
    const all = groups(cat, await read($, layoutA), L)
    const q = v.q.trim().toLowerCase()
    const filtering = !!q || v.proj
    const openCat = v.open.at(-1) // one open category: past a certain size the app freezes the panel
    const hit = (n: string) => (!q || n.toLowerCase().includes(q) || (desc[n] ?? '').toLowerCase().includes(q)) && (!v.proj || pins.includes(n))
    const hits = filtering ? all.flatMap(g => g.skills.filter(hit)) : []
    const shown = new Set(hits.slice(0, MAX_HITS))
    const ghosts = Object.keys(s.mem).filter(n => !s.on.includes(n))
    const stale = Object.entries(s.mem).filter(([n, st]) => st === 'stale' && s.on.includes(n)).map(([n]) => n)
    const changes = s.on.filter(n => !s.sent.includes(n)).length + s.sent.filter(n => !s.on.includes(n)).length + s.reload.length
    const tooBig = all.filter(g => g.skills.length > MAX_ROWS)

    const setPresets = async (fn: (p: Record<string, string[]>) => Record<string, string[]>) => {
      await update($, presetsA, p => fn({ ...(p ?? {}) }))
      await $.store.set('presets', await read($, presetsA))
    }
    const saveSelection = () => {
      if (!s.on.length) return void $.ui.toast(L.pickFirst)
      void setPresets(p => { let i = 1; while (p[L.selection(i)]) i++; return { ...p, [L.selection(i)]: [...s.on] } })
    }
    // Before each change, note which drawings actually change state: only those animate.
    const setOn = (fn: (cur: string[]) => string[], extra: string[] = []) => {
      const next = uniq(fn(s.on))
      const state = (sel: string[], g: Group) => { const k = g.skills.filter(n => sel.includes(n)).length; return !k ? 0 : k === g.skills.length ? 1 : 2 }
      touch(
        ...cat.filter(x => s.on.includes(x.name) !== next.includes(x.name)).map(x => 'cb:' + x.name),
        ...all.filter(g => state(s.on, g) !== state(next, g)).map(g => 'ca:' + g.cat),
        ...extra,
      )
      return setSess($, x => ({ ...x, on: uniq(fn(x.on)) }))
    }
    const pin = async (n: string) => {
      touch('p:' + n)
      await update($, pinsA, p => toggle(p ?? [], n))
      const p = await read($, pinsA)
      await $.store.set(await pinsKey($), p)
      if (p.includes(n) && !s.on.includes(n)) await setOn(cur => [...cur, n], ['p:' + n])
    }
    const anim = (key: string, source: string) => (fresh.has(key) ? source : still(source))
    const fold = (c: string) => {
      touch('cv:' + c, ...(openCat && openCat !== c ? ['cv:' + openCat] : []))
      void setView($, x => ({ ...x, open: x.open.at(-1) === c ? [] : [c] }))
    }
    const toggleSub = async () => {
      touch('sw')
      await setView($, x => ({ ...x, sub: !x.sub }))
      await $.store.set('sub', (await read($, viewA)).sub)
    }
    const moveRow = (n: string, dir: -1 | 1) =>
      setLayout($, gs => {
        const gi = gs.findIndex(g => g.skills.includes(n))
        const g = gs[gi]!
        const i = g.skills.indexOf(n)
        const j = i + dir
        if (j >= 0 && j < g.skills.length) [g.skills[i], g.skills[j]] = [g.skills[j]!, g.skills[i]!]
        else if (gs[gi + dir]) {
          g.skills.splice(i, 1)
          dir < 0 ? gs[gi + dir]!.skills.push(n) : gs[gi + dir]!.skills.unshift(n)
        }
        return gs
      })
    const moveTo = (n: string, c: string) =>
      setLayout($, gs => {
        for (const g of gs) g.skills = g.skills.filter(x => x !== n)
        gs.find(g => g.cat === c)?.skills.push(n)
        return gs
      })
    const moveCat = (c: string, dir: -1 | 1) =>
      setLayout($, gs => {
        const i = gs.findIndex(g => g.cat === c)
        const j = i + dir
        if (j >= 0 && j < gs.length) [gs[i], gs[j]] = [gs[j]!, gs[i]!]
        return gs
      })

    // An SVG doesn't take clicks; a transparent button laid over it does.
    const svgBtn = (source: string, alt: string, w: number, key: string, press: () => void) => (
      <Box key={'sb' + key} position="relative" flexShrink={0}>
        <Svg alt={alt} width={w} height={16} source={source} isInteractive={moving(source)} />
        <Box position="absolute" top={0} left={0}>
          <Button key={key} plain onPress={press}>{' '.repeat(Math.ceil(w / 4))}</Button>
        </Box>
      </Box>
    )
    // Row-wide click area; positioned elements laid after it keep their own action.
    const zone = (key: string, press: () => void) => (
      <Box position="absolute" top={0} left={0}>
        <Button key={key} plain onPress={press}>{' '.repeat(Math.max(8, Math.floor((e.props.bodyColumns - 8) * 0.47)))}</Button>
      </Box>
    )
    const svgImg = (key: string, source: string, alt: string, w: number, ht = 16) => (
      <Svg alt={alt} width={w} height={ht} source={anim(key, source)} isInteractive={moving(anim(key, source))} />
    )

    const row = (n: string) => {
      const isOn = s.on.includes(n)
      const st = s.mem[n]
      const pinned = pins.includes(n)
      const pre = n.includes(':') ? n.slice(0, n.lastIndexOf(':')) : ''
      if (v.org)
        return (
          <Box key={'r:' + n} flexDirection="row" gap="xs" alignItems="center" paddingLeft={2}>
            <Text wrap="truncate">{n}</Text>
            <Box flexGrow={1} />
            <Button key={'up:' + n} plain label="↑" onPress={() => void moveRow(n, -1)} />
            <Button key={'dn:' + n} plain label="↓" onPress={() => void moveRow(n, 1)} />
            <Select key={'to:' + n} options={all.map(g => ({ value: g.cat, label: g.cat }))} value={all.find(g => g.skills.includes(n))?.cat} onSelect={c => void moveTo(n, c)} />
          </Box>
        )
      const state = [
        s.reload.includes(n) ? L.reloadNext : st === 'stale' ? L.staleState : st === 'ok' ? (isOn ? L.memOn : L.memOff) : '',
        pinned ? L.pinnedState : '',
      ].filter(Boolean).join('  ·  ')
      return (
        <Box key={'r:' + n} flexDirection="column" paddingX="xs" paddingY="xs" hover={{ backgroundColor: isOn ? '#d977571f' : '#ffffff08' }} backgroundColor={isOn ? '#d9775714' : undefined}>
          <Box flexDirection="row" gap="sm" alignItems="center" position="relative">
            {zone('c:' + n, () => void setOn(cur => toggle(cur, n)))}
            {svgImg('cb:' + n, BOX[isOn ? 1 : 0], isOn ? L.alt.on : L.alt.off, 16)}
            <Text weight={isOn ? 'medium' : 'regular'} dimColor={!isOn}>{n.slice(n.lastIndexOf(':') + 1)}</Text>
            {pre && <Text size="caption" dimColor wrap="truncate">{pre}</Text>}
            {st && svgImg('dot:' + n, DOT[st], st === 'ok' ? L.alt.ok : L.alt.lost, 14, 14)}
            <Box flexGrow={1} />
            {/* the (i) bubble opens upward, over the rows already drawn */}
            <Box key={'di:' + n} position="relative" flexShrink={0}>
              <Svg alt={L.alt.desc} width={16} height={16} source={INFO} />
              <Box position="absolute" bottom={1} right={0} width={34} display="none" hover={{ display: 'flex' }} flexDirection="column" gap="xs" padding="sm" borderStyle="round" borderColor="#ffffff24" backgroundColor="#262626">
                <Text size="caption" wrap="wrap">{desc[n] || L.noDesc}</Text>
                {state && <Text size="caption" dimColor wrap="wrap">{state}</Text>}
              </Box>
            </Box>
            {svgBtn(anim('p:' + n, pinned ? PIN.on : PIN.off), pinned ? L.alt.pinnedAlt : L.alt.pin, 20, 'p:' + n, () => void pin(n))}
          </Box>
        </Box>
      )
    }

    const categoryBox = (g: Group) => {
      const names = g.skills.filter(hit)
      if (filtering && !names.length) return null
      const open = filtering || openCat === g.cat
      const k = g.skills.filter(n => s.on.includes(n)).length
      const st: 0 | 1 | 2 = !k ? 0 : k === g.skills.length ? 1 : 2
      const visible = (v.org ? g.skills : names).filter(n => !filtering || shown.has(n)).slice(0, MAX_ROWS)
      return (
        <Box key={'g:' + g.cat} flexDirection="column" gap="xs" padding="sm" borderStyle="round" borderColor="#ffffff12" backgroundColor="#ffffff05">
          {v.org ? (
            <Box flexDirection="row" gap="xs" alignItems="center">
              <Input key={'name:' + g.cat} value={g.cat} submitLabel={L.rename} onSubmit={val => void setLayout($, gs => gs.map(x => (x.cat === g.cat ? { ...x, cat: val.trim() || x.cat } : x)))} />
              <Button key={'cu:' + g.cat} plain label="↑" onPress={() => void moveCat(g.cat, -1)} />
              <Button key={'cd:' + g.cat} plain label="↓" onPress={() => void moveCat(g.cat, 1)} />
              <Button key={'co:' + g.cat} plain label={open ? '▾' : '▸'} onPress={() => fold(g.cat)} />
              {!g.skills.length && <Button key={'cx:' + g.cat} plain label="×" onPress={() => void setLayout($, gs => gs.filter(x => x.cat !== g.cat))} />}
            </Box>
          ) : (
            <Box flexDirection="row" gap="sm" alignItems="center" position="relative">
              {filtering ? null : zone('co:' + g.cat, () => fold(g.cat))}
              {svgBtn(anim('ca:' + g.cat, BOX[st]), st === 1 ? L.alt.on : st === 2 ? L.alt.some : L.alt.off, 16, 'ca:' + g.cat,
                () => void setOn(cur => (k === g.skills.length ? cur.filter(n => !g.skills.includes(n)) : [...cur, ...g.skills])))}
              <Text weight="semibold">{g.cat}</Text>
              {filtering ? null : svgImg('cv:' + g.cat, open ? CHEV.open : CHEV.closed, open ? L.alt.open : L.alt.closed, 14, 14)}
              <Box flexGrow={1} />
              <Text size="caption" tabular weight="semibold" color={k ? '#ffffff' : '#ffffff66'} backgroundColor={k ? '#d97757aa' : '#ffffff0a'}>{` ${k}/${g.skills.length} `}</Text>
            </Box>
          )}
          {open && visible.map(row)}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="row" gap="sm" alignItems="center">
          <Box flexDirection="column">
            <Text size="heading" weight="semibold">{L.title}</Text>
            {changes ? <Text size="caption" color={ACCENT}>{L.changes(changes)}</Text> : <Text size="caption" dimColor>{L.hint}</Text>}
          </Box>
          <Box flexGrow={1} />
          <Button key="org" variant={v.org ? 'primary' : 'secondary'} label={v.org ? L.done : L.organize} onPress={() => void setView($, x => ({ ...x, org: !x.org }))} />
        </Box>
        <Input key="q" placeholder={L.search} value={v.q} onInput={val => void setView($, x => ({ ...x, q: val }))} onSubmit={() => undefined} />
        {!v.org && (
          <Box flexDirection="row" gap="xs" flexWrap="wrap">
            {Object.entries(presets).map(([p, list]) => {
              const ns = list.filter(n => desc[n] !== undefined)
              if (!ns.length) return null // preset with none of its skills installed here
              const active = ns.every(n => s.on.includes(n))
              return <Button key={'pre:' + p} variant={active ? 'primary' : 'secondary'} label={p} onPress={() => void setOn(cur => (active ? cur.filter(n => !ns.includes(n)) : [...cur, ...ns]))} />
            })}
            <Button key="proj" variant={v.proj ? 'primary' : 'secondary'} label={L.project(pins.length)} onPress={() => void setView($, x => ({ ...x, proj: !x.proj }))} />
            <Button key="pre-new" plain label={L.save} onPress={saveSelection} />
          </Box>
        )}
        {v.org && (
          <Box flexDirection="column" gap="xs">
            <Text size="caption" dimColor>{L.presetsHelp}</Text>
            {Object.entries(presets).map(([p, list]) => (
              <Box key={'po:' + p} flexDirection="row" gap="xs" alignItems="center">
                <Input key={'pn:' + p} value={p} submitLabel={L.rename} onSubmit={val => { const name = val.trim(); if (name && name !== p && !presets[name]) void setPresets(x => Object.fromEntries(Object.entries(x).map(([k, l]) => [k === p ? name : k, l]))) }} />
                <Text size="caption" dimColor>{L.nSkills(list.length)}</Text>
                <Box flexGrow={1} />
                <Button key={'pu:' + p} plain label={L.replace} onPress={() => { if (s.on.length) void setPresets(x => ({ ...x, [p]: [...s.on] })) }} />
                <Button key={'px:' + p} plain label="×" onPress={() => void setPresets(x => { const { [p]: _, ...rest } = x; return rest })} />
              </Box>
            ))}
            <Box flexDirection="row" gap="sm" flexWrap="wrap">
              <Button key="pre-add" label={L.newPreset} onPress={saveSelection} />
              <Button key="pre-reset" plain label={L.resetPresets} onPress={() => { const natives = cat.filter(x => x.native).map(x => x.name); void setPresets(() => (natives.length ? { [L.native]: natives } : {})) }} />
            </Box>
            <Box flexDirection="row" gap="sm" flexWrap="wrap">
              <Button key="newcat" label={L.newCat} onPress={() => void setLayout($, gs => [...gs, { cat: L.newCatName(gs.length + 1), skills: [] }])} />
              <Button key="resetlay" plain label={L.resetLayout} onPress={async () => { await update($, layoutA, () => []); await $.store.delete('layout') }} />
            </Box>
          </Box>
        )}
        <Box flexDirection="column" gap="xs">{all.map(categoryBox)}</Box>
        {hits.length > MAX_HITS && <Text size="caption" dimColor>{L.capped(MAX_HITS, hits.length)}</Text>}
        {filtering && !hits.length && <Text size="caption" dimColor wrap="wrap">{q ? L.noMatch(v.q.trim()) : L.noPins}</Text>}
        {tooBig.map(g => (
          <Box key={'big:' + g.cat} flexDirection="row" gap="sm" alignItems="center" padding="sm" borderStyle="round" borderColor="#ffffff12">
            <Svg alt={L.alt.info} width={16} height={16} source={INFO} />
            <Text size="caption" dimColor wrap="wrap">{L.tooBig(g.cat, g.skills.length)}</Text>
          </Box>
        ))}
        {stale.length > 0 && (
          <Box flexDirection="row" gap="sm" alignItems="center" padding="sm" borderStyle="round" borderColor="#d977574d" backgroundColor="#d977570f">
            <Svg alt={L.alt.lost} width={14} height={14} source={still(DOT.stale)} />
            <Text size="caption" wrap="wrap">{L.stale(stale.length)}</Text>
            <Box flexGrow={1} />
            <Button key="reload" label={L.reload} onPress={() => void setSess($, x => ({ ...x, reload: uniq([...x.reload, ...stale]) }))} />
          </Box>
        )}
        {ghosts.length > 0 && (
          <Box flexDirection="row" gap="sm" alignItems="center" padding="sm" borderStyle="round" borderColor="#ffffff12">
            <Svg alt={L.alt.info} width={16} height={16} source={INFO} />
            <Text size="caption" dimColor wrap="wrap">{L.ghosts(ghosts.length)}</Text>
          </Box>
        )}
        <Box flexDirection="column" gap="sm" padding="sm" borderStyle="round" borderColor="#ffffff12" backgroundColor="#ffffff05">
          <Box flexDirection="row" gap="xs" alignItems="center">
            <Text weight="semibold" color={s.on.length ? ACCENT : undefined}>{`${s.on.length}`}</Text>
            <Text size="caption" dimColor>{L.checked(s.on.length) + (pins.length ? ` · ${L.pinned(pins.length)}` : '')}</Text>
          </Box>
          <Box flexDirection="row" gap="sm" alignItems="center" position="relative">
            {zone('sub', () => void toggleSub())}
            {svgImg('sw', v.sub ? SWITCH.on : SWITCH.off, v.sub ? L.alt.yes : L.alt.no, 28)}
            <Box flexDirection="column">
              <Text size="caption">{L.subTitle}</Text>
              <Text size="caption" dimColor>{L.subHelp}</Text>
            </Box>
          </Box>
          <Box flexDirection="row" gap="sm">
            <Button key="clear" label={L.clear} onPress={() => void setOn(() => [])} />
            <Button key="refresh" label={L.refresh} onPress={() => void loadCatalog($)} />
          </Box>
        </Box>
      </Box>
    )
  }).catch(($, e, next) => {
    // if rendering fails, show why instead of an empty panel
    const { Text } = $.ui.resolve(e)
    return <Text size="caption" wrap="wrap">{'⚠ ' + JSON.stringify(next.error).slice(0, 1500)}</Text>
  })
}
