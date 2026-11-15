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

test('cocher, envoyer, charger : le signal part et le point se remplit', async ($, on) => {
  // Ces hooks tiennent la place du moteur.
  on('command.register', () => ({ value: { command: 'panneau-skills' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/projet' }))
  on('env.get', () => ({ value: undefined }))
  on('session.usage', () => ({
    value: { context: { breakdown: { skills: { skillFrontmatter: [{ name: 'gsap-web', source: 'built-in', tokens: 1 }] } } } },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await $.session.start({ cwd: '/projet', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  // la liste se charge en arrière-plan au démarrage ; le bouton la recharge et attend
  if (await ui.find({ type: 'Text', text: /chargement|Loading/ })) await ui.press({ key: 'reload-cat' })
  // ouvrir la catégorie puis cocher le skill
  await ui.press({ key: 'co:Animation' })
  // la flèche de la catégorie qu'on vient d'ouvrir pivote (elle porte son animation)
  expect((await ui.findAll({ type: 'Svg' })).some(x => x.props.alt === 'collapse' && String(x.props.source).includes('<style>'))).toBe(true)
  await ui.press({ key: 'c:gsap-web' })

  // seuls les dessins que le clic a changés portent une animation (la case et sa catégorie) ; les autres sont fixes
  // (le fond de survol, sans texte alternatif, porte toujours son fondu : il est exclu)
  const animated = (await ui.findAll({ type: 'Svg' })).filter(x => x.props.alt && String(x.props.source).includes('<style>'))
  expect(animated.length).toBe(2)

  // enregistrer la sélection crée un préréglage cliquable
  await ui.press({ key: 'pre-new' })
  expect(await ui.find({ type: 'Button', key: 'pre:Selection 1' })).toBeDefined()

  const sent = await $.prompt.submit({ text: 'salut' })
  expect(String(sent.context?.[0] ?? '')).toContain('gsap-web')

  // un second envoi sans changement ne renvoie rien
  const again = await $.prompt.submit({ text: 'encore' })
  expect(again.context ?? []).toEqual([])

  await $.skill.prompt({ skill: 'gsap-web', text: 'consignes' })
  expect((await ui.find({ type: 'Text', text: /●/ }))?.text).toContain('●')
  await ui.unmount()
})
