import { expect, test } from 'claude-code/testing'

test('full panel: 130 skills, memory, pins, size under the limit', async ($, on) => {
  const base = ['anthropic-skills:built-in-browser', 'gsap-web', 'some-plugin:helper', 'text-humanizer', 'design:ux-copy', 'remotion-video', 'logo-design', 'code-review', 'update-config']
  const names = Array.from({ length: 130 }, (_, i) => base[i % base.length] + (i < base.length ? '' : '-' + i))
  on('command.register', () => ({ value: { command: 'skills-panel' } }))
  on('store.get', (_, e) => ({ value: String(e.key).startsWith('pins:') ? ['gsap-web'] : String(e.key).startsWith('sess:') ? { on: names.slice(0, 40), mem: { 'gsap-web': 'ok', 'text-humanizer': 'stale' }, sent: ['text-humanizer'], reload: [] } : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/projet' }))
  on('env.get', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { context: { breakdown: { skills: { skillFrontmatter: names.map(name => ({ name, source: 'built-in', tokens: 1 })) } } } } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'skills-panel', component: 'Pane', requestId: 'skills-panel', surface: 'desktop', props: { title: 'Skills', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as never)
  if (await ui.find({ type: 'Text', text: /chargement|Loading/ })) await ui.press({ key: 'reload-cat' })
  for (const b of await ui.findAll({ type: 'Button' })) if (b.key?.startsWith('co:')) await ui.press({ key: b.key })
  const svgs = await ui.findAll({ type: 'Svg' })
  const bytes = svgs.reduce((n, x) => n + String(x.props.source).length, 0)
  // guard: around 250 KB of drawings the app stopped drawing the panel; about 127 KB works
  expect(bytes).toBeLessThan(160000)
  expect(svgs.length).toBeGreaterThan(5)
  await ui.unmount()
})
