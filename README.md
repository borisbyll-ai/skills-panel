# Panneau Skills

Un panneau à droite de la conversation dans Claude Code (app desktop) pour choisir les skills que Claude doit utiliser. Tu coches, et la sélection part avec ton prochain message : Claude charge les skills cochés avant de répondre et oublie les consignes de ceux que tu as décochés.

## Installation

Le panneau est fait pour l'app **Claude Desktop** (onglet Code).

Dans l'app : clique sur **+** à côté de la zone de saisie, puis **Plugins**, **Add marketplace** avec `borisbyll-ai/skills-panel`, puis **Add plugin**.

Ou dans un terminal, à l'invite de Claude Code :

```
/plugin install skills-panel --marketplace borisbyll-ai/skills-panel
```

Ou depuis un shell :

```bash
claude plugin install skills-panel --marketplace borisbyll-ai/skills-panel
```

Réponds `y` pour ajouter le marketplace, puis choisis la portée (utilisateur par défaut). Le mod est actif aussitôt, et dans chaque nouvelle session.

## Ouvrir et fermer le panneau

- Clique sur **✦ n** sous la barre de discussion, à gauche du nom du modèle. `n` est le nombre de skills cochés. L'étoile est pleine (✦) quand au moins un skill est chargé, et creuse (✧) sinon.
- Ou tape `/panneau-skills`.
- La croix en haut du panneau le ferme.

## Au premier lancement

Le panneau s'adapte à ta bibliothèque, il n'impose rien :

- il lit tes skills et les range dans des **catégories déduites de leur nom et de leur description** (Code & qualité, Design & interface, Rédaction & documents…). Ce qu'il ne sait pas classer va dans **Autres** ;
- il ne crée qu'**un préréglage**, **Skills Claude**, qui regroupe les skills fournis avec Claude. Les autres, c'est toi qui les crées ;
- l'interface suit la **langue de Claude Desktop** : anglais, français, espagnol, allemand, portugais, italien ou japonais (l'anglais pour toute autre langue) ;
- dans une autre langue que l'anglais, il fait **traduire les descriptions des skills par Claude** (modèle Haiku), une seule fois par skill. La traduction est gardée, et refaite seulement si la description d'un skill change. Les skills installés plus tard sont traduits à leur tour.

Tu peux tout réorganiser ensuite avec **Organiser**.

## Choisir des skills

- Les skills sont rangés par **catégories**. Un clic n'importe où sur l'en-tête ouvre ou referme la catégorie. Une seule catégorie reste ouverte à la fois.
- Un clic n'importe où sur la ligne d'un skill le **coche** ou le **décoche**.
- La case à gauche d'une catégorie coche ou décoche **toute la catégorie**. Un tiret signifie qu'une partie seulement est cochée.
- **Rechercher un skill…** filtre par nom et par description (40 résultats affichés au maximum).
- Rien ne part tant que tu n'envoies pas de message. Une ligne orange en haut du panneau annonce combien de changements partiront.

## Sur chaque ligne

| Repère | Signification |
| --- | --- |
| **●** orange plein | Claude a vraiment chargé ce skill. |
| **○** orange creux | Le skill a peut-être été perdu lors d'un résumé du contexte. Le bouton **⟳ Recharger** du bas le renverra. |
| **(i)** | Survole-la pour lire la description du skill et son état. |
| **P** | Épingle le skill au projet : il sera coché d'office dans les nouvelles sessions ouvertes dans ce dossier. |

## Préréglages

- Un préréglage coche un groupe de skills d'un seul clic, et le décoche au clic suivant. Au départ, il n'y a que **Skills Claude**.
- **+ Enregistrer la sélection** crée un préréglage à partir de ce que tu as coché. Tu le renommes ensuite dans **Organiser**.
- **Projet (n)** n'affiche que les skills épinglés à ce dossier.

## Organiser

Le bouton **Organiser** passe le panneau en mode édition :

- **préréglages** : renommer, remplacer par la sélection actuelle (↻), supprimer (×), en créer un, revenir aux préréglages par défaut ;
- **catégories** : renommer, monter et descendre (↑ ↓), créer, supprimer une catégorie vide ;
- **skills** : monter et descendre (↑ ↓), changer de catégorie avec le menu déroulant.

**Terminé** referme le mode édition. Ton organisation est gardée d'une session à l'autre.

## Le bas du panneau

- **Transmettre aux sous-agents** : quand c'est activé, les agents que Claude lance reçoivent aussi la liste des skills cochés. Désactivé par défaut.
- **Tout décocher** vide la sélection.
- **↻ Recharger la liste** relit les skills installés, par exemple après en avoir ajouté un.

## Ce que le panneau garde et ce qu'il lit

- Il garde, sur ton ordinateur et dans le stockage de Claude Code : ta sélection par session, tes épingles par dossier, tes préréglages et ton organisation.
- Il lit la liste des skills de la session, la première phrase de leurs fichiers `SKILL.md` pour les descriptions, et le `config.json` de Claude Desktop pour la langue.
- Pour traduire les descriptions, il les envoie à Claude avec ton compte, comme n'importe quelle demande. Il n'envoie rien d'autre, ni ailleurs. La sélection est ajoutée à ton message comme une consigne pour Claude, invisible dans la conversation.

## Ajouter une langue

Copie un fichier du dossier `lang/` (par exemple `fr.json`), nomme-le avec le code de la langue (`nl.json`, `ko.json`…) et traduis les valeurs. `{n}`, `{q}`, `{cat}`… doivent rester tels quels. Une phrase absente du fichier s'affiche en anglais.

## Limites connues

- Réservé à l'**app Claude Desktop** (onglet Code). Dans le terminal, le panneau affiche seulement un message.
- Une catégorie affiche au plus **100 skills**. Au-delà, un encart en bas du panneau la signale : cherche les autres ou répartis-les avec Organiser.
- Le classement automatique se fait sur des mots-clés : certains skills peuvent tomber dans une catégorie approximative, ou dans Autres.
- Le survol des lignes est instantané : l'app n'autorise pas un mod à l'animer.
- Décocher un skill demande à Claude de ne plus suivre ses consignes, mais elles restent dans son contexte jusqu'à `/clear` ou une nouvelle session.
