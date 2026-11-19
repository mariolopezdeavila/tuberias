# Glosario de traducción (ES / EN)

Criterio: se traduce todo el texto descriptivo. Se mantiene en inglés cualquier término que un ingeniero reconozca en inglés, hable el idioma que hable. Si alguien con poco inglés necesita entender un término que se queda en inglés, la explicación en español está en el hover.

## Se queda en inglés

- **Títulos de las cartas** (las 55, también *Blank Card*). En los textos en español, una carta se nombra con su título en inglés y entre comillas: debe ir antes de "Deploy to Production".
- **Métricas:** Lead time for changes, Process time, Wait time, Flow efficiency, First-pass yield, Bottleneck y Critical path. Cada tile de la Review explica la métrica en el hover.
- **Bandas DORA:** Elite, High, Medium, Low y Below Low.
- **Review**, como nombre de la fase y de la pestaña. En la prosa se usa en femenino: "la Review".
- **Categorías de las cartas:** Delivery, Build, Test, Security, Deployment y AI Engineering. La excepción es *Custom*, que pasa a *Personalizada*.
- **Términos de CD:** pipeline, commit, push, merge, trunk, Release Candidate, snapshot, build, code review, lint, unit/smoke/E2E tests, mocks/stubs, sandbox, SAST/DAST, pentest, canary, shadow deployment, rollout, rollback, flaky, happy path, fail fast, timebox, CI, IaC, PR, trigger, %C&A, VSM, checks y lobby.
- **Términos de AI Engineering:** evals, eval gate, golden dataset, LLM-as-a-judge, red teaming, prompt injection, jailbreak, guardrails, RAG, embeddings, retrieval, token, drift, slopsquatting, provenance attestation (SLSA), policy-as-code, data flywheel, human-in-the-loop, behavior bundle y Rule of Two.
- **Identificadores de las reglas:** R1–R5 y A1–A5.

## Convenciones del español

- **Persona:** tuteo ("Arrastra cartas…", "Pulsa Review…").
- **Género:**
  - *la* pipeline y *la* Release Candidate;
  - *el* lead time, *el* eval gate y *el* golden dataset.
- **Términos con equivalente asentado en español:** en la prosa se usa el término en español y en las etiquetas se deja el inglés.
  - "deploy": *desplegar* y *despliegue*.
  - "critical path": *ruta crítica*.
  - "bottleneck": *cuello de botella*.
- **"Tests"**, no "pruebas".
- **Duraciones:** m, h, d y **sem** (2 sem 3d). Se usa "sem" para no confundirlo con segundos.
- **Interfaz:**
  - Game → *Juego* y Modeling → *Modelado*.
  - Room → *Sala*, Viewing → *Observando*, viewer → *observador* y Live → *En directo*.
  - Findings → *Hallazgos*.
  - Auto-layout → *Ordenar*.

## Cómo se mantiene

- **Textos de la interfaz:** en el código se escriben en inglés, como `t('English text')`. El texto en inglés es la clave, y `src/i18n_es.js` guarda su traducción al español.
- **Contenido largo:** los textos de las cartas, las reglas y los escenarios están en `src/content_es.js`, por id.
- **Las cartas personalizadas y el escenario personalizado** no se traducen, porque los escriben los equipos.
- **Al añadir o cambiar un texto**, ejecuta `python3 test/i18n_test.py --missing` y añade su versión en español.
