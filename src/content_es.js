/*
 * Tuberías — Spanish content: card texts and references, rules and scenarios, keyed by id. GPLv3.
 * Card titles stay in English by design. Core texts translated from "Pipeline: the game that delivers"
 * by Eficode (GPLv3); AI Engineering texts: Tuberías authors.
 */
if (typeof module !== 'undefined' && typeof window === 'undefined') require('./i18n.js');
Object.assign(CONTENT_ES.cards, {
 "commit": {
  "text": "Una persona del equipo comparte su código haciendo push de un commit a un servidor de control de versiones, como Git. Los pasos anteriores no cuentan para el lead time de despliegue."
 },
 "deploy-prod": {
  "text": "Una Release Candidate se despliega en producción, donde hay usuarios reales y datos reales. Requiere una Release Candidate construida. Los pasos posteriores no cuentan para el lead time de despliegue."
 },
 "build-rc": {
  "text": "El código se compila y se construye como una Release Candidate desplegable. Requiere que el código esté en trunk (\"Code is Merged to Trunk\")."
 },
 "build-snapshot": {
  "text": "El código se compila y se construye como una unidad desplegable etiquetada como \"snapshot\": sirve solo para tests, no para producción."
 },
 "version-number": {
  "text": "Da al paquete un nombre o número único (p. ej. \"4.6.12\" o \"989c45ef21\"). Puede generarse automáticamente o decidirse a mano."
 },
 "release-notes": {
  "text": "Publica notas con los cambios que incluye este despliegue. Se redactan a mano o se generan automáticamente."
 },
 "merge-trunk": {
  "text": "Todo el equipo puede ver, usar y construir sobre este código. La Release Candidate no puede construirse antes de este paso."
 },
 "code-review": {
  "text": "Personas distintas de quien escribió el código lo examinan y lo evalúan.",
  "ref": "Espera: la mediana del sector hasta la primera review ronda un día; el cuartil superior está por debajo de 4 h (Code Climate)."
 },
 "lint": {
  "text": "Se analiza el código en busca de posibles errores de programación y de estilo, incumplimientos del estándar de código y probables errores lógicos."
 },
 "static-analysis": {
  "text": "Una herramienta mide la complejidad, el tamaño de clases y métodos, las dependencias circulares, etc., y los compara con un estándar."
 },
 "unit": {
  "text": "Tests escritos por el equipo de desarrollo que se ejecutan contra las clases y los métodos individuales del sistema."
 },
 "component": {
  "text": "Testea un componente del sistema sustituyendo los demás por mocks o fakes. También se conoce como test de módulo."
 },
 "contract": {
  "text": "Verifica que el software cumple el contrato que exige un servicio de terceros. El test de contrato lo proporciona ese tercero."
 },
 "third-party": {
  "text": "Verifica que el sistema se comunica correctamente con un servicio de terceros, a menudo usando su versión de test (p. ej. un sandbox de pagos)."
 },
 "deploy-agent": {
  "text": "Todo el sistema se despliega en una sola máquina; los servicios de terceros se sustituyen por mocks o stubs."
 },
 "deploy-test1": {
  "text": "Despliegue en un entorno protegido con hardware similar al de producción y datos (anonimizados) similares a los de producción. Puede llamarse \"QA\" o \"Pre-prod\"."
 },
 "deploy-test2": {
  "text": "Despliegue en un segundo entorno protegido similar a producción."
 },
 "deploy-test3": {
  "text": "Despliegue en un tercer entorno protegido similar a producción."
 },
 "health-check": {
  "text": "Verifica que el software se ha desplegado bien: esquema de BD válido, servicios registrados, puertos abiertos, logs generándose."
 },
 "smoke": {
  "text": "Se prueba una única funcionalidad muy básica, como \"ver la pantalla de login\". Nada más."
 },
 "functional": {
  "text": "Cada test ejecuta una función del sistema a través de una API y comprueba los happy paths y las condiciones de error."
 },
 "ui-tests": {
  "text": "Scripts que recorren muchas funcionalidades a través de la UI, como lo haría un usuario real. Tienden a ser flaky."
 },
 "regression": {
  "text": "Se vuelven a ejecutar los tests funcionales y no funcionales para asegurar que el software que ya funcionaba sigue funcionando tras un cambio."
 },
 "e2e": {
  "text": "Se ejecutan todas las partes del sistema, incluidos los componentes de terceros. Manual o automatizado."
 },
 "load": {
  "text": "Se bombardea el sistema con muchas peticiones concurrentes y se miden los tiempos de respuesta y el rendimiento."
 },
 "uat": {
  "text": "Representantes de los usuarios finales validan que la funcionalidad hace lo que necesitan."
 },
 "usability": {
  "text": "Especialistas en UX observan a usuarios reales usando el sistema para ver cómo se comportan y cómo usan las funcionalidades."
 },
 "pentest": {
  "text": "Testers expertos exploran el sistema de forma estructurada en busca de problemas de seguridad."
 },
 "sast": {
  "text": "Identifica vulnerabilidades en el código fuente, las dependencias de terceros, las imágenes de contenedor o la infraestructura como código."
 },
 "dast": {
  "text": "Identifica vulnerabilidades en la aplicación en ejecución: XSS, SQL injection, seguridad de las API, etc."
 },
 "go-nogo": {
  "text": "Managers, testers y stakeholders se reúnen para decidir si se despliega, según los resultados de los tests, los riesgos, las condiciones de mercado y el cost of delay.",
  "ref": "Espera: con una reunión semanal, un cambio espera de media unos 3,5 días."
 },
 "ai-coding-agent": {
  "text": "Un coding agent redacta el cambio en un sandbox aislado, sin secretos de producción y con credenciales de mínimo privilegio. Puede iterar sobre el feedback de CI un número limitado de veces; después toma el relevo una persona. No cuenta para el lead time.",
  "ref": "DORA 2025: la adopción de IA es casi universal, pero la confianza en lo que produce sigue siendo baja."
 },
 "ai-precommit-guard": {
  "text": "Límites pre-commit a lo que produce el agente: secret scanning, límite de tamaño del PR y rutas protegidas (workflows de CI, IaC, permisos) que el agente no puede modificar sin revisión humana."
 },
 "ai-trigger": {
  "text": "La pipeline arranca sin un commit de código: una actualización del modelo del proveedor, un cambio en un prompt o en la definición de una herramienta, un refresco de la base de conocimiento o una alerta de drift de las sondas programadas contra el modelo del proveedor."
 },
 "ai-versioning": {
  "text": "Versiona junto con el código los prompts, la versión fijada del modelo, las definiciones de herramientas, el índice vectorial, los datasets de evals y los evaluadores."
 },
 "ai-provenance": {
  "text": "Genera una provenance attestation firmada (p. ej. SLSA) que registra cómo se construyó el artefacto y si los cambios los hizo una persona o un agente."
 },
 "ai-rag-index": {
  "text": "Trocea (chunking), genera los embeddings e indexa la base de conocimiento de la que recupera el sistema. Debe ejecutarse antes de las evals que dependen del retrieval."
 },
 "ai-code-review": {
  "text": "Un revisor de IA con acceso de solo lectura comenta el PR. Complementa la revisión humana, nunca la sustituye. Empieza como consultivo; hazlo bloqueante solo cuando hayas medido su precisión."
 },
 "ai-test-gen": {
  "text": "Un agente distinto del que escribió el código propone tests diseñados para fallar si este cambio introduce regresiones. Los tests generados necesitan revisión: pueden codificar el mismo bug que testean."
 },
 "ai-mutation-testing": {
  "text": "Muta el código y comprueba que los tests lo detectan. Saca a la luz tests débiles o que solo se confirman a sí mismos, incluidos los generados por IA."
 },
 "ai-permission-scan": {
  "text": "Escanea los workflows de CI y las configuraciones de los agentes: input no confiable que llega a un agente, secretos al alcance del agente, tokens de escritura, triggers arriesgados. Ningún workflow puede combinar los tres (Rule of Two).",
  "ref": "PromptPwnd (dic. 2025), caso de laboratorio de Microsoft sobre la GitHub Action de Claude Code (jun. 2026) y Nx s1ngularity (ago. 2025)."
 },
 "ai-slopsquatting": {
  "text": "Verifica que cada dependencia existe y es la que se pretende usar. Bloquea el \"slopsquatting\": paquetes inventados por una IA y registrados por atacantes."
 },
 "ai-cost-gate": {
  "text": "Hace fallar la ejecución si el uso de tokens o el coste por petición superan el presupuesto. Se aplica a la ejecución de CI y a la funcionalidad bajo test."
 },
 "ai-smoke-evals": {
  "text": "Ejecuta en cada PR un subconjunto pequeño y rápido del golden dataset. El gate se basa en umbrales de puntuación, no en coincidencias exactas."
 },
 "ai-regression-evals": {
  "text": "Suite completa de evals contra el golden dataset: distribuciones de puntuaciones, rúbricas y un LLM-as-a-judge calibrado. Bloquea las releases ante regresiones significativas."
 },
 "ai-human-eval-review": {
  "text": "Human-in-the-loop: personas expertas revisan una muestra de las respuestas y las puntuaciones del juez antes de la release."
 },
 "ai-redteam-auto": {
  "text": "Suites adversariales automatizadas: prompt injection, exfiltración de datos, jailbreaks, uso indebido de herramientas, contenido dañino."
 },
 "ai-redteam-manual": {
  "text": "Especialistas atacan de forma estructurada el sistema de IA desplegado para encontrar modos de fallo que las suites automatizadas no detectan."
 },
 "ai-rai-review": {
  "text": "Revisa la clasificación de riesgo, las obligaciones de transparencia y la documentación (p. ej. EU AI Act, model/system cards) antes de la release."
 },
 "ai-shadow": {
  "text": "La nueva versión recibe una copia del tráfico real en paralelo con la actual; sus respuestas se evalúan, pero nunca se muestran a los usuarios."
 },
 "ai-canary": {
  "text": "Se publica para una pequeña parte del tráfico y el rollout completo depende de las puntuaciones de las evals y del coste, no solo de la tasa de errores y la latencia."
 },
 "ai-release-policy": {
  "text": "Policy-as-code contrasta las evidencias (tests, evals, provenance, aprobaciones) con los umbrales de release. Se ejecuta fuera del control del agente."
 },
 "ai-online-evals": {
  "text": "Puntúa la calidad, la seguridad y el coste sobre trazas reales durante una ventana fija tras la release; confirma el behavior bundle o hace rollback. Después de producción: no cuenta."
 },
 "ai-golden-feedback": {
  "text": "Convierte los fallos de producción en nuevos casos de eval (data flywheel). Después de producción: no cuenta."
 },
 "blank": {
  "text": "Haz doble clic para describir tu propio paso."
 },
 "ai-tracing": {
  "text": "Captura trayectorias: pasos, llamadas a herramientas, decisiones, tokens y latencia (p. ej. las convenciones GenAI de OpenTelemetry). Después de producción: no cuenta."
 },
 "ai-failure-triage": {
  "text": "Transversal: cuando falla un paso, un agente diagnostica la causa y propone una corrección. Consultivo → bloqueante → autónomo, según la fiabilidad medida. No cuenta para el lead time."
 }
});
Object.assign(CONTENT_ES.rules, {
 "R1": {
  "title": "Inicio y final de la pipeline",
  "text": "Empieza con \"A Developer Commits Code\" (o un trigger sin commit) y termina con \"Deploy to Production\". Las cartas anteriores o posteriores no cuentan para el lead time."
 },
 "R2": {
  "title": "Release Candidate antes de producción",
  "text": "No puedes desplegar en producción (\"Deploy to Production\") hasta haber construido una Release Candidate."
 },
 "R3": {
  "title": "Merge antes de la Release Candidate",
  "text": "No puedes construir una Release Candidate hasta que el código esté en trunk (\"Code is Merged to Trunk\")."
 },
 "R4": {
  "title": "Desplegar antes de los system tests",
  "text": "Los pasos marcados como \"system test\" necesitan un sistema desplegado: algún paso de despliegue debe ir antes."
 },
 "R5": {
  "title": "Build antes de desplegar",
  "text": "Los pasos de despliegue necesitan un paquete: \"Build Release Candidate\" o \"Build Snapshot Version\" deben ir antes."
 },
 "A1": {
  "title": "Las evals protegen los cambios de IA",
  "text": "Aplica cuando el PRODUCTO tiene funcionalidades LLM o de agentes (lo fija el escenario), no cuando la pipeline usa herramientas de IA. Al menos un eval gate (\"Smoke Evals\" o \"Regression Eval Suite\") debe ir antes de \"Deploy to Production\"."
 },
 "A2": {
  "title": "Versiona lo que evalúas",
  "text": "Los eval gates necesitan una referencia: \"Version AI Artifacts\" debe ir antes de cualquier eval gate."
 },
 "A3": {
  "title": "Índice antes de las evals de retrieval",
  "text": "Si construyes o refrescas un índice RAG, debe ir antes de los eval gates."
 },
 "A4": {
  "title": "El feedback de producción va después de producción",
  "text": "Las online evals y el feedback al golden dataset deben ir después de \"Deploy to Production\"."
 },
 "A5": {
  "title": "El trabajo de los agentes, antes del commit",
  "text": "Las cartas de coding agent y de guardrails del agente son pasos pre-commit: colócalas antes del inicio de la pipeline."
 }
});
Object.assign(CONTENT_ES.scenarios, {
 "s-social": {
  "title": "Aplicación online de red social",
  "text": "Los usuarios crean y comparten enlaces a artículos de actualidad, con comentarios.\nLos usuarios buscan historias para ver artículos y comentarios.\nLos anunciantes pagan por promocionar sus artículos en los resultados de búsqueda.\nLas búsquedas deben ser rápidas y la interfaz debe resultar atractiva.",
  "competitor": "Tu competidor tiene una aplicación monolítica en PHP."
 },
 "s-solar": {
  "title": "Pagos online por energía solar",
  "text": "Los usuarios generan energía solar en su tejado y cobran por lo que aportan a la red.\nLa aplicación paga a los clientes cada mes por transferencia bancaria.\nLos datos de aportación se obtienen de un sistema de terceros.\nLa aplicación gestiona dinero y está regulada por las autoridades financieras.",
  "competitor": "Tu competidor es una gran compañía energética que usa Java."
 },
 "s-fitness": {
  "title": "App móvil de fitness y running",
  "text": "Una app móvil de ejercicio monitoriza tus carreras.\nTe da feedback sobre el tiempo por vuelta y te entrena para alcanzar tus objetivos.\nEl sistema envía emails motivadores con resúmenes semanales de tu forma física.\nGestiona datos de salud potencialmente sensibles.",
  "competitor": "Tu competidor es una startup de Silicon Valley que usa Python."
 },
 "s-photo": {
  "title": "Software de edición de fotos",
  "text": "Los usuarios editan sus fotos y las organizan en álbumes.\nPueden encargar la impresión de los álbumes (de pago).\nEs importante una experiencia de usuario fluida e intuitiva.\nAdmite un gran número de técnicas de edición fotográfica.\nLa impresión, el envío y el pago los gestionan terceros.",
  "competitor": "Tu competidor tiene una enorme base de código en C++."
 },
 "s-classified": {
  "title": "Anuncios clasificados de segunda mano",
  "text": "Particulares pagan por publicar anuncios de artículos que quieren vender.\nEl pago lo gestiona un servicio de terceros.\nLos usuarios buscan o navegan por categorías para encontrar artículos.\nLos usuarios contactan por mensaje o por teléfono y quedan en persona para el intercambio.",
  "competitor": "Tu competidor tiene una arquitectura de microservicios escrita en al menos cinco lenguajes."
 },
 "s-ai-bank": {
  "title": "Agente de atención al cliente para un banco online",
  "text": "Un agente LLM responde a las preguntas de los clientes usando retrieval sobre las condiciones de los productos y las políticas del banco (RAG).\nPuede ejecutar acciones limitadas mediante herramientas: bloquear una tarjeta, actualizar una dirección.\nEl banco está regulado; una respuesta errónea sobre comisiones o condiciones es un problema de cumplimiento.\nHay que informar a los clientes de que están hablando con una IA.",
  "competitor": "Tu competidor es un gran banco que usa el chatbot de un proveedor."
 },
 "s-ai-search": {
  "title": "Búsqueda de productos con IA para un marketplace",
  "text": "Búsqueda semántica y preguntas y respuestas sobre un catálogo que cambia cada día.\nLas respuestas no deben inventar características ni precios de los productos.\nEl coste por consulta importa: millones de búsquedas al día.\nLa tasa de conversión es la métrica de negocio clave.",
  "competitor": "Tu competidor es un retailer nativo digital."
 },
 "s-ai-ds": {
  "title": "Design System con un generador de componentes con IA",
  "text": "Diseñadores y desarrolladores describen un componente de UI; un agente lo genera con los design tokens y las reglas de accesibilidad.\nLos componentes se publican como una librería versionada que consumen 20 equipos de producto.\nUna release defectuosa rompe muchos productos a la vez.\nCumplir los requisitos de accesibilidad es obligatorio.",
  "competitor": "El equipo del design system de otra unidad de negocio publica una release cada dos semanas."
 },
 "s-ai-clinic": {
  "title": "Asistente para resumir notas clínicas",
  "text": "El asistente resume las conversaciones entre médico y paciente en notas clínicas estructuradas.\nGestiona datos de salud muy sensibles.\nUn medicamento o una dosis alucinados pueden dañar a un paciente.\nLos médicos deben revisar y firmar cada nota.",
  "competitor": "Tu competidor es una scale-up de health-tech."
 },
 "s-ai-agents": {
  "title": "Equipo de producto donde los coding agents abren PRs",
  "text": "Un equipo de SaaS B2B usa coding agents que abren unas tres veces más pull requests que antes.\nLos revisores humanos se han convertido en el cuello de botella.\nLa estabilidad bajó el último trimestre: más incidentes tras las releases.\nEl producto en sí no tiene funcionalidades de IA.",
  "competitor": "Tu competidor es un equipo más pequeño sin coding agents."
 }
});
