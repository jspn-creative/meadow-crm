# Domain Docs

How agents should use this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/CONTEXT.md`** — the glossary, and the project's business language. Read it before naming a domain concept.
- **`docs/SPEC.md`** — what the product is and what it is not. Read it before planning work.

## File structure

```
/
├── AGENTS.md
├── docs/
│   ├── CONTEXT.md
│   ├── SPEC.md
│   ├── agents/
│   ├── checklists.md
│   ├── examples/
│   └── research/
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept in a spec, plan, or piece of code, use the term defined in `docs/CONTEXT.md`. If the concept has no entry:

- Add one when the term is genuinely distinctive here — something a reader would otherwise misinterpret as an ordinary word, or that means something specific to this business. Propose the entry rather than silently introducing the name.
- Do not add an entry for a word the glossary already covers under another name. Reuse the existing term, and update that entry instead if the behavior it describes has changed.

If the code and the glossary disagree, the glossary and `docs/SPEC.md` are right until someone changes them deliberately. Say so rather than following the code.
