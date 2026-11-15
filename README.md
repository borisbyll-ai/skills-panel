# Skills panel

A panel for the Claude Desktop app that lets you pick which skills Claude should use. Check a few, send your next message, and Claude loads them before it answers. Uncheck one and Claude stops following it.

## Install

The panel runs in the **Claude Desktop** app (Code tab).

In the app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `borisbyll-ai/skills-panel`, then **Add plugin**.

From a terminal, at the Claude Code prompt:

```
/plugin install skills-panel --marketplace borisbyll-ai/skills-panel
```

Or from a shell:

```bash
claude plugin install skills-panel --marketplace borisbyll-ai/skills-panel
```

Answer `y` to add the marketplace, then pick a scope (user is the default). The panel works right away and in every new session.

## First run

Nothing is set up in advance. The panel reads your own skill library and sorts it into categories from each skill's name and description: Code & quality, Design & UI, Writing & documents, and so on. Whatever it can't place goes into **Other**. You start with a single preset, **Claude skills**, which holds the skills that ship with Claude.

The interface follows the language of Claude Desktop. English, French, Spanish, German, Portuguese, Italian and Japanese are included; any other language falls back to English. Outside English, Claude translates the skill descriptions once, keeps the result, and translates new skills as you install them.

## Using it

Click **✦ n** under the prompt box, left of the model name, to open or close the panel (`n` is how many skills are checked). The star is filled when at least one skill is loaded. You can also type `/skills-panel`.

- Click a category header to open it. One category stays open at a time.
- Click anywhere on a skill's row to check or uncheck it. The box on a category header checks the whole category.
- Hover the **(i)** badge to read a skill's description.
- **P** pins a skill to the current folder, so it starts checked in every new session there.
- A filled orange dot means Claude has loaded the skill. A hollow one means it may have been dropped when the context was summarized; **⟳ Reload** at the bottom sends it again.

Nothing is sent until your next message. An orange line at the top tells you how many changes will go with it.

## Presets and Organize

A preset checks a group of skills in one click. **+ Save selection** turns what you've checked into a new preset.

**Organize** lets you rename, replace or delete presets, and rename, reorder, create or delete categories. You can also move a skill to another category there. Your layout and presets carry over between sessions.

## Subagents

**Pass to subagents**, at the bottom of the panel, sends the checked skills to the agents Claude starts as well. It is off by default.

## Privacy

The panel reads the skill list, the first sentence of each `SKILL.md`, and the language setting in Claude Desktop's `config.json`. Your selection is added to your message as an instruction for Claude, out of sight in the conversation. Translating descriptions goes through your own Claude account, like any other request. Nothing else leaves your machine.

## Add a language

Copy a file from `lang/` (say `fr.json`), name it after the language code (`nl.json`, `ko.json`) and translate the values. Keep `{n}`, `{q}`, `{cat}` and the other placeholders as they are. Any missing line shows in English.

## Limits

- Claude Desktop only. In a terminal the panel just shows a short message.
- A category shows at most 100 skills. A note at the bottom of the panel names any category over that.
- The automatic sorting works on keywords, so a few skills may land in a loose category or in Other. Organize fixes that.
- Unchecking a skill tells Claude to stop following it, but its instructions stay in context until `/clear` or a new session.

## License

MIT
