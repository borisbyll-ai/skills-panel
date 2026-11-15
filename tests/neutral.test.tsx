import { expect, test } from 'claude-code/testing'

// Un nouvel utilisateur : bibliothèque inconnue, aucun réglage enregistré.
test('nouvel utilisateur : catégories déduites, « Other », préréglage natif seul, plafond de 100', async ($, on) => {
  const skills = [
    { name: 'anthropic-skills:pdf', source: 'plugin', pluginName: 'anthropic-skills', tokens: 1 },
    { name: 'mon-truc-perso', source: 'userSettings', tokens: 1 },
    ...Array.from({ length: 105 }, (_, i) => ({ name: `video-${i}`, source: 'userSettings', tokens: 1 })),
  ]
  on('command.register', () => ({ value: { command: 'panneau-skills' } }))
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

  // un skill qui ne correspond à rien va dans « Other »
  expect(await ui.find({ type: 'Button', key: 'co:Other' })).toBeDefined()
  // un seul préréglage de départ : les skills natifs ; aucun préréglage personnel
  const presets = (await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('pre:'))
  expect(presets.map(b => b.key)).toEqual(['pre:Claude skills'])
  // la catégorie de 105 skills est signalée, et seuls 100 sont dessinés une fois ouverte
  expect(await ui.find({ type: 'Text', text: /105 skills/ })).toBeDefined()
  await ui.press({ key: 'co:Video & audio' })
  expect((await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('c:video-')).length).toBe(100)
  await ui.unmount()
})
