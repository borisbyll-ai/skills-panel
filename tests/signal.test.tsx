import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'skills-panel',
  component: 'Pane',
  requestId: 'skills-panel',
  props: {
    title: 'Skills',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('check, send, load: the signal goes out and the dot fills', async ($, on) => {
  // Ces hooks tiennent la place du moteur.
  on('command.register', () => ({ value: { command: 'skills-panel' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/project' }))
  on('env.get', () => ({ value: undefined }))
  on('session.usage', () => ({
    value: { context: { breakdown: { skills: { skillFrontmatter: [{ name: 'gsap-web', source: 'built-in', tokens: 1 }] } } } },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await $.session.start({ cwd: '/project', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  // the list loads in the background at start; the button reloads it and waits
  if (await ui.find({ type: 'Text', text: /chargement|Loading/ })) await ui.press({ key: 'reload-cat' })
  // open the category, then check the skill
  await ui.press({ key: 'co:Animation' })
  // the arrow of the category just opened turns (it carries its animation)
  expect((await ui.findAll({ type: 'Svg' })).some(x => x.props.alt === 'collapse' && String(x.props.source).includes('<style>'))).toBe(true)
  await ui.press({ key: 'c:gsap-web' })

  // only the drawings the click changed carry an animation (the box and its category); the rest stay still
  // (le fond de survol, sans texte alternatif, porte toujours son fondu : il est exclu)
  const animated = (await ui.findAll({ type: 'Svg' })).filter(x => x.props.alt && String(x.props.source).includes('<style>'))
  expect(animated.length).toBe(2)

  // saving the selection creates a clickable preset
  await ui.press({ key: 'pre-new' })
  expect(await ui.find({ type: 'Button', key: 'pre:Selection 1' })).toBeDefined()

  const sent = await $.prompt.submit({ text: 'salut' })
  expect(String(sent.context?.[0] ?? '')).toContain('gsap-web')

  // a second send with no change sends nothing
  const again = await $.prompt.submit({ text: 'encore' })
  expect(again.context ?? []).toEqual([])

  await $.skill.prompt({ skill: 'gsap-web', text: 'consignes' })
  expect((await ui.find({ type: 'Text', text: /●/ }))?.text).toContain('●')
  await ui.unmount()
})
