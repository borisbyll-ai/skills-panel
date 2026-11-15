import { expect, test } from 'claude-code/testing'

// A new user: unknown library, nothing saved.
test('first run: inferred categories, Other, one native preset, 100-row cap', async ($, on) => {
  const skills = [
    { name: 'anthropic-skills:pdf', source: 'plugin', pluginName: 'anthropic-skills', tokens: 1 },
    { name: 'mon-truc-perso', source: 'userSettings', tokens: 1 },
    ...Array.from({ length: 105 }, (_, i) => ({ name: `video-${i}`, source: 'userSettings', tokens: 1 })),
  ]
  on('command.register', () => ({ value: { command: 'skills-panel' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/projet' }))
  on('env.get', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { context: { breakdown: { skills: { skillFrontmatter: skills } } } } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'skills-panel', component: 'Pane', requestId: 'skills-panel', surface: 'desktop', props: { title: 'Skills', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as never)
  if (await ui.find({ type: 'Text', text: /Loading/ })) await ui.press({ key: 'reload-cat' })

  // a skill that matches nothing goes to Other
  expect(await ui.find({ type: 'Button', key: 'co:Other' })).toBeDefined()
  // one starting preset, the native skills, nothing personal
  const presets = (await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('pre:'))
  expect(presets.map(b => b.key)).toEqual(['pre:Claude skills'])
  // the 105-skill category is flagged, and only 100 rows are drawn when it opens
  expect(await ui.find({ type: 'Text', text: /105 skills/ })).toBeDefined()
  await ui.press({ key: 'co:Video & audio' })
  expect((await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('c:video-')).length).toBe(100)
  await ui.unmount()
})
