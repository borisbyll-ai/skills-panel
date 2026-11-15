# Fiche technique : skills-panel

| | |
| --- | --- |
| Type | Mod Claude Code (plugin à module de hooks) |
| Version | 0.1.0 |
| Surface visée | App desktop, onglet Code (Windows testé) |
| Langue de l'interface | Anglais intégré ; `lang/<code>.json` pour fr, es, de, pt, it, ja, choisi d'après `locale` dans le `config.json` de Claude Desktop (sinon `LANG`, sinon anglais) |
| Dépendances | Aucune, en dehors de l'API `claude-code` |

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifeste : nom, version, description, contrat de types |
| `hooks/hooks.json` | Déclare le module `./register.tsx` |
| `hooks/register.tsx` | Tout le mod : état, hooks, rendu du panneau et de l'icône |
| `lang/*.json` | Textes traduits ; une clé absente retombe sur l'anglais ; `{x}` remplacé, `{ "one", "other" }` pour le pluriel (`Intl.PluralRules`) |
| `types/index.d.ts` | Contrat de `$.state` : `session`, `catalog`, `layout`, `pins`, `view`, `presets`, `lang` |
| `tests/signal.test.tsx` | Cocher, envoyer le signal, mémoire, animation ciblée, préréglage |
| `tests/live.test.tsx` | Panneau avec 130 skills et 40 cochés, garde-fou sur le poids des dessins |
| `tests/neutral.test.tsx` | Nouvel utilisateur : catégorie « Other », préréglage natif seul, plafond de 100 |

## Événements utilisés

| Événement | Ce que fait le mod |
| --- | --- |
| `session.start` | Détecte la langue, enregistre `/panneau-skills`, recharge l'état sauvegardé, coche les skills épinglés dans une nouvelle session, lit le catalogue (et crée le préréglage « Skills Claude » au premier lancement) |
| `prompt.submit` | Ajoute à `context` la consigne « charge X » ou « n'applique plus Y » (différence entre coché et déjà envoyé), invisible pour l'utilisateur |
| `skill.prompt` | Marque le skill comme « en mémoire » (point plein) |
| `session.compact` | Passe tous les skills en mémoire à « peut-être perdu » (point creux) |
| `tool.call` (`Agent`) | Si l'option est activée (désactivée par défaut), ajoute la liste des skills cochés au prompt du sous-agent (sauf `fork`) |
| `ui.render` `SessionMode` | Bouton `✦ n` sous la barre, qui ouvre et ferme le panneau |
| `ui.render` `Pane` | Le panneau ; un `.catch` affiche l'erreur dans le panneau si le rendu échoue |
| `command.run` | `/panneau-skills` ouvre le panneau |

## État et stockage

| Clé | Portée | Contenu |
| --- | --- | --- |
| `sess:<id de session>` | Session | `on` (cochés), `mem` (ok / stale), `sent` (déjà envoyés), `reload` |
| `pins:<dossier>` | Projet | Skills épinglés, cochés d'office dans les nouvelles sessions |
| `layout` | Global | Ordre et nom des catégories, place des skills |
| `presets` | Global | Préréglages de l'utilisateur |
| `sub` | Global | Option « Transmettre aux sous-agents » |
| `tr:<code>` | Global | Descriptions traduites : nom du skill → [description d'origine, traduction] |

La vue (recherche, catégorie ouverte, mode Organiser, option sous-agents) vit dans `$.state` et n'est pas sauvegardée sur disque.

## Catégories de départ

Sans organisation enregistrée, chaque skill est classé par mots-clés sur son nom et sa description (`CATS` dans `register.tsx`), dans cet ordre : navigateur, Claude Code, vidéo, animation, design, données, rédaction, code. Le premier qui correspond l'emporte, le reste va dans « Autres ». Un skill installé plus tard est classé de la même façon. Une organisation enregistrée avec Organiser prime toujours.

## Traduction des descriptions

Hors anglais, `translate()` envoie les descriptions pas encore traduites (ou modifiées depuis) à `$.model.complete` (Haiku), par paquets de 40, et attend un objet JSON en retour. Le résultat est gardé dans `tr:<code>` ; le classement en catégories utilise toujours la description d'origine, l'affichage la traduction. En cas d'échec, le panneau garde la description d'origine.

## Lectures sur le disque

- `config.json` de Claude Desktop (Windows Store, Windows, macOS, Linux), pour la langue ; `lang/<code>.json` dans le dossier du mod.
- `~/.claude/plugins/installed_plugins.json`, pour trouver le dossier des skills de plugins.
- `~/.claude/skills/<nom>/SKILL.md` et `<plugin>/skills/<nom>/SKILL.md`, pour la première phrase de la description.

Rien n'est écrit sur le disque en dehors de `$.store`, et aucune donnée ne sort de la machine.

## Contraintes de l'app desktop (constatées en testant)

- **Poids du panneau** : au-delà d'environ 250 Ko de SVG, le panneau reste figé sans aucune erreur. D'où : 3 dessins par ligne au maximum, une seule catégorie ouverte, recherche plafonnée à 40 résultats, 100 lignes au plus par catégorie, et le garde-fou dans `live.test.tsx` (moins de 160 Ko avec 130 skills).
- **Boutons** : leur texte ne prend ni couleur, ni taille, ni fond, et un `label` remplace les enfants. La couleur passe par des SVG ou des `Text` hors du bouton.
- **Clic sur un dessin** : un SVG ne capte pas le clic. Un bouton transparent posé en absolu par-dessus le rend cliquable, et une « zone » de largeur ligne fait de même pour les en-têtes et les lignes.
- **Survol** : il peut seulement faire apparaître un élément (`display: none` → `flex`), et il est instantané.
- **Animations** : CSS dans le SVG (SMIL ne se joue pas). Le mode image fige l'animation, le mode interactif recharge le cadre à chaque redessin et provoque un clignotement. Seul un dessin qui vient de changer d'état reçoit son `<style>` et passe en interactif (ensemble `fresh`). Tout le reste est une image fixe.
- **Barre du bas (`SessionMode`)** : elle refuse les SVG et ignore la superposition. D'où un simple bouton texte.
- `prefers-reduced-motion` coupe toutes les animations.

## Animations

| Élément | Mouvement | Durée et courbe |
| --- | --- | --- |
| Case | Remplissage avec léger rebond, puis tracé de la coche | 180 ms + 200 ms, `cubic-bezier(0.34,1.56,0.64,1)` puis `cubic-bezier(0.32,0.72,0,1)` |
| Flèche de catégorie | Quart de tour | 240 ms, `cubic-bezier(0.32,0.72,0,1)` |
| Pastille P | Le remplissage monte | 220 ms |
| Point mémoire | Apparition et une pulsation ; vidage en anneau | 260 ms + 700 ms ; 600 ms |
| Interrupteur sous-agents | Glissement de la pastille, la piste s'allume | 220 ms |

## Vérifier

```bash
claude plugin validate <dossier du mod>
```

```bash
claude plugin test <dossier du mod>
```
