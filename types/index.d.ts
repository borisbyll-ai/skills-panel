/** One skill of the session: its description, `tr` the same translated into the app's language, `native` when it ships with Claude. */
export type Skill = { name: string; source: string; desc: string; native?: boolean; tr?: string }

/** A category and the skills it holds, in order. */
export type Group = { cat: string; skills: string[] }

/**
 * The session's selection: what is checked, what Claude holds in memory
 * ('ok' seen loaded, 'stale' maybe lost to a compaction), what was last sent,
 * and what must be sent again.
 */
export type Sess = {
  on: string[]
  mem: Record<string, 'ok' | 'stale'>
  sent: string[]
  reload: string[]
}

/** How the pane is shown right now. */
export type View = {
  q: string
  open: string[]
  org: boolean
  proj: boolean
  sub: boolean
}

/** The interface language, taken from the desktop app: its code and the texts of lang/<code>.json. */
export type Lang = { code: string; dict: Record<string, string | { one?: string; other: string }> }

declare module 'claude-code' {
  interface PluginState {
    'skills-panel': {
      session: Shaped<Sess>
      catalog: Shaped<Skill[]>
      layout: Shaped<Group[]>
      presets: Shaped<Record<string, string[]>>
      pins: Shaped<string[]>
      view: Shaped<View>
      lang: Shaped<Lang>
    }
  }
}
