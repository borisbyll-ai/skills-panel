# Technical notes

For anyone reading or changing the code. Everything lives in `hooks/register.tsx`, a Claude Code mod (a plugin with a hooks module). It has no dependencies beyond the `claude-code` API.

## Files

| File | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest |
| `.claude-plugin/marketplace.json` | Makes the repository installable with one line |
| `hooks/register.tsx` | State, hooks, and the drawing of the panel and the footer button |
| `types/index.d.ts` | Shape of the mod's `$.state` |
| `lang/*.json` | Translations; English is built into `register.tsx` |
| `tests/*.test.tsx` | Run with `claude plugin test .` |

## How it works

| Event | What the mod does |
| --- | --- |
| `session.start` | Detects the language, registers `/skills-panel`, restores saved state, checks pinned skills in a new session, reads the skill catalog |
| `prompt.submit` | Adds an instruction to the message's `context`: load the skills checked since the last message, stop following the ones unchecked |
| `skill.prompt` | Marks a skill as loaded |
| `session.compact` | Marks every loaded skill as possibly lost |
| `tool.call` (`Agent`) | When the option is on, appends the checked skills to the subagent's prompt |
| `ui.render` `SessionMode` | The `✦ n` button under the prompt box |
| `ui.render` `Pane` | The panel itself |

## Storage

| `$.store` key | Scope | Content |
| --- | --- | --- |
| `sess:<session id>` | session | checked, loaded, already sent, to resend |
| `pins:<folder>` | project | pinned skills |
| `layout` | global | category names and order, skill placement |
| `presets` | global | the user's presets |
| `sub` | global | the subagent option |
| `tr:<language>` | global | translated descriptions, keyed by skill, with the source text |

Files read: Claude Desktop's `config.json` for the language, `~/.claude/plugins/installed_plugins.json`, and the `SKILL.md` files. Nothing is written outside `$.store`.

## Categories

Without a saved layout, each skill is matched by keyword against its name and description (`CATS`), in this order: browser, Claude Code, video, animation, design, data, writing, code. The first match wins and the rest goes to Other. Skills installed later get sorted the same way. A layout saved with Organize always wins.

## Languages

English is built in. `lang/<code>.json` overrides it key by key, picked from `locale` in Claude Desktop's `config.json` (then `LANG`, then English). `{x}` is a placeholder; `{ "one": …, "other": … }` picks a plural form through `Intl.PluralRules`.

Outside English, `translate()` sends new or changed descriptions to `$.model.complete` (Haiku) in batches of 40 and caches the answer in `tr:<code>`. Categories always use the original text; the panel shows the translation. If a call fails, the original stays.

## Desktop app constraints

None of these show up in the API types. They came out of testing in Claude Desktop:

- **Size.** Past about 250 KB of SVG the panel freezes without an error. That's why there are three drawings per row at most, one open category, 40 search results, 100 rows per category, and a size check in `tests/live.test.tsx`.
- **Buttons** ignore text color, size and background, and a `label` replaces their children. Color has to come from an SVG, or a `Text` placed outside the button.
- **Clicks on drawings.** An SVG doesn't take clicks. A transparent button laid over it does, and a row-wide one makes whole rows and headers clickable.
- **Hover** can only reveal an element (`display: none` to `flex`), and it's instant.
- **Animation** uses CSS inside the SVG; SMIL doesn't play. Image mode freezes animation, and interactive mode reloads its frame on every redraw, which flickers. So only a drawing whose state just changed carries its `<style>` and goes interactive (the `fresh` set). Everything else stays a still image. `prefers-reduced-motion` turns animation off.
- **The footer area** (`SessionMode`) refuses SVG and ignores absolute positioning, so the button there is plain text.

## Tests

`claude plugin test .` runs three files: selection and signal, a 130-skill panel with the size check, and a first run on an unknown library (Other, one preset, the 100-row cap). GitHub Actions runs validation and tests on Windows, macOS and Linux on every push. The tests build the panel as a tree of elements and press buttons by key. They don't draw pixels, so they can't tell you how it looks.
