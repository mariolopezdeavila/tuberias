# Tuberías online — guía de instalación

Tiempo total: unos 30 minutos, una sola vez. No hace falta saber programar ni usar la terminal.
Todo se hace en la web de Supabase y en la de GitHub, y ambas son gratuitas.

Necesitas:
- La carpeta `tuberias` completa (versión 2.0). Contiene la app ya generada (`index.html`), su código fuente (`src/`) y la configuración de la base de datos (`supabase/setup.sql`).
- Tu cuenta de GitHub (la misma sirve para entrar en Supabase).

Desde la versión 2.0, el repositorio de GitHub es la **única fuente de la verdad**: guarda el código fuente completo, no solo la app. Cualquier cambio futuro se hace sobre esa carpeta.

Los nombres de algunos botones pueden variar un poco si Supabase o GitHub cambian su web.

---

## Parte 1 · Crear la base de datos en Supabase (≈ 10 min)

1. Entra en **supabase.com**, pulsa **Start your project** e inicia sesión con **GitHub**.
2. Pulsa **New project** y rellena:
   - *Name*: `tuberias`.
   - *Database password*: genera una y guárdala. La app no la usa, pero Supabase la pide.
   - *Region*: una de Europa (por ejemplo *West EU (Ireland)* o *Central EU (Frankfurt)*), para que los datos queden en la UE.
   - *Plan*: **Free**.

   Pulsa **Create new project** y espera uno o dos minutos a que termine.
3. En el menú de la izquierda, abre **SQL Editor** y pulsa **New query**.
4. Abre `supabase/setup.sql` con cualquier editor de texto, copia **todo** su contenido, pégalo en el editor de Supabase y pulsa **Run**.
   - Resultado esperado: *Success. No rows returned*.
   - Si lo ejecutas dos veces no pasa nada.
5. Ve a **Project Settings → API Keys** y copia dos valores:
   - **Project URL**, del tipo `https://abcdefgh.supabase.co`. Si no la ves en esa pantalla, está en **Project Settings → Data API** o en el botón **Connect** de la página principal del proyecto.
   - **Publishable key**, que empieza por `sb_publishable_`. Si solo ves la pestaña *Legacy API Keys*, pulsa **Create new API keys**.

   ⚠ **Nunca** uses la *secret key* ni la *service_role*: dan acceso total a la base de datos.

Ambos valores son públicos por diseño: van dentro de la página web y cualquiera puede verlos. La seguridad la ponen las funciones de `setup.sql`, que no dejan leer ni escribir la tabla directamente: para modificar una sala hay que tener su clave de editor.

6. Realtime (las actualizaciones en directo) no necesita configuración. Si alguna vez dejan de llegar los cambios, comprueba en **Realtime → Settings** que **Allow public access** sigue activado, que es su valor por defecto.

## Parte 2 · Poner la configuración en la app (≈ 2 min)

Elige una de las dos opciones:

Los dos valores viven en el archivo `config.json` y se copian dentro de `index.html` cada vez que se genera la app. En la versión 2.0 ya están puestos los de tu proyecto actual. Solo tendrás que cambiarlos si creas un proyecto de Supabase nuevo:

- **Opción A (más fácil):** envíale a Claude la *Project URL* y la *publishable key*, y te devolverá la carpeta con `config.json` e `index.html` actualizados.
- **Opción B:** abre `config.json` con un editor de texto y sustituye los dos valores. Después, pide a Claude que vuelva a generar `index.html` (o ejecuta `python3 build.py` si tienes Python). Si solo editas `index.html`, el cambio se perderá la próxima vez que se genere la app.

Para comprobar que funciona, abre `index.html` con doble clic. Si aparece la pantalla **Create a room / Join a room**, la conexión está bien.

## Parte 3 · Publicarla en internet con GitHub Pages (≈ 10 min)

1. En **github.com**, pulsa **+ → New repository**.
   - Nombre: `tuberias`.
   - Visibilidad: **Public**. GitHub Pages gratuito lo exige y, de paso, cumple la GPLv3 al publicar el código.
   - Pulsa **Create repository**.
2. En la página del repositorio vacío, pulsa **uploading an existing file**.
   - Arrastra **todo el contenido** de la carpeta `tuberias` (archivos y carpetas: `index.html`, `src`, `supabase`, `test`, `vendor`, `dist`, `build.py`, `config.json`, `README.md`, `CHANGELOG.md`, `LICENSE`…). Arrastra lo que hay *dentro* de la carpeta, no la carpeta en sí.
   - Pulsa **Commit changes**.
3. Ve a **Settings → Pages** y configura:
   - *Source*: **Deploy from a branch**.
   - *Branch*: **main** y carpeta **/ (root)**.
   - Pulsa **Save**.
4. Espera uno o dos minutos y recarga. La dirección aparecerá arriba, del tipo `https://TU-USUARIO.github.io/tuberias/`. Esa es la URL que compartirás.

Para actualizar la app más adelante, Claude te entregará la carpeta `tuberias` completa con los cambios. Ábrela, entra en **Add file → Upload files** en tu repositorio, arrastra todo su contenido y pulsa **Commit changes**. GitHub sustituye los archivos que hayan cambiado y conserva el resto. Se publica solo en uno o dos minutos.

Para que Claude pueda hacer cambios en una conversación nueva, pásale esa misma carpeta (o descárgala de GitHub con **Code → Download ZIP**).

## Antes de cada evento (≈ 5 min)

- **Pausa de Supabase:** en el plan gratuito, un proyecto sin uso durante una semana se pausa. Entra en supabase.com el día antes; si el proyecto aparece como *Paused*, pulsa **Restore** o **Resume** y espera unos minutos.
- **Prueba rápida:**
  1. Crea una sala desde el portátil.
  2. Únete con el código desde el móvil.
  3. Mueve una carta y comprueba que el móvil la ve moverse.

## Cómo se usa en el Open Space

1. Cada equipo abre la URL y pulsa **Create room**. Quien la crea es el **editor**.
2. El editor pulsa **🔗 Room XXXXXX** en la barra superior y lee el código en voz alta. El resto pulsa **Join a room** y escribe el código: ven el tablero en directo, sin poder editar.
3. Para la galería, el editor marca **Show this room in the lobby**. Así cualquiera puede encontrar la sala en la pantalla de inicio, en *Lobby*, sin conocer el código.
4. La **Review** la activa el editor de cada sala. Cuando lo hace, todos los que miran ven las métricas.
5. Desde el mismo diálogo **🔗 Room** puedes:
   - **Editor link:** sirve para seguir editando desde otro portátil o para pasar el control a otra persona. Quien lo tenga puede editar.
   - **Make my own copy:** disponible para quien mira; crea una sala nueva a partir de esta y le convierte en su editor.

## Después del evento

Para borrar todas las salas, ve a **SQL Editor**, ejecuta lo siguiente y pulsa **Run**:

```sql
delete from public.tuberias_rooms;
```

Si solo quieres borrar las antiguas:

```sql
delete from public.tuberias_rooms where updated_at < now() - interval '30 days';
```

## Límites y avisos

- **Capacidad del plan gratuito:** permite 200 conexiones en tiempo real simultáneas y 500 MB de datos. Para un Open Space sobra.
- **Privacidad:** cualquiera que tenga el código de una sala puede verla. No guardes en Tuberías información confidencial de clientes.
- **Sin internet:** la app sigue funcionando en modo offline (*Work offline in this browser*). En ese modo no hay salas compartidas.
