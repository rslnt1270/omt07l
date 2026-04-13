# Estudio visual — *Porcelain Blue*

Referencia: figura femenina de porcelana estilo **qinghua** (青花, azul y blanco de Jingdezhen) con crecimientos corales/bonsái tridimensionales emergiendo del cuerpo. Sirve como base para la escena homónima en omt07l.

---

## 1. Paleta

Ordenada de más clara a más oscura. Valores aproximados muestreados de la referencia; úsalos como punto de partida, no como dogma.

| Token | Hex | RGB | HSL | Rol |
|---|---|---|---|---|
| `porcelain_highlight` | `#F4F6F5` | 244,246,245 | 150°,6%,96% | Brillos especulares del vidriado, punto más claro |
| `porcelain_body` | `#E6E8E7` | 230,232,231 | 150°,3%,91% | Blanco base del cuerpo cerámico |
| `porcelain_shadow` | `#C9D1D4` | 201,209,212 | 196°,10%,81% | Semitono frío del vidriado en sombra |
| `mist_blue` | `#A8B6C2` | 168,182,194 | 208°,16%,71% | Fondo ambiente / halo atmosférico |
| `cobalt_wash` | `#6D8AA8` | 109,138,168 | 210°,25%,54% | Aguada intermedia de la pintura, ink-wash diluido |
| `cobalt_mid` | `#3E6596` | 62,101,150 | 213°,42%,42% | Azul cobalto medio, masa principal de las ramas |
| `cobalt_deep` | `#1E3E78` | 30,62,120 | 219°,60%,29% | Cobalto profundo, trazos finales y acentos |
| `cobalt_ink` | `#0E1F4A` | 14,31,74 | 223°,68%,17% | Casi negro azul, contornos más finos y sombras duras |
| `bg_cool_gray` | `#8B96A0` | 139,150,160 | 211°,9%,59% | Fondo neutro frío del entorno |

Observaciones:
- **No hay negro puro**. El "negro" del trazo es `cobalt_ink`, siempre con componente azul.
- **No hay blanco puro**. El vidriado siempre tiene un sesgo frío (verde-azul muy leve).
- La saturación global es baja; el dramatismo viene del **contraste de valor**, no del croma.
- El rango útil para modulación en Hydra es `cobalt_wash` → `cobalt_ink` (4 pasos de valor sobre el mismo hue ~215°).

### Gradientes derivados

- **Rampa cobalto** (para `color()` / `colorama` en Hydra):
  `[0.05,0.11,0.29] → [0.12,0.25,0.47] → [0.24,0.40,0.66] → [0.43,0.54,0.66]`
- **Rampa porcelana** (luz):
  `[0.79,0.82,0.83] → [0.90,0.91,0.91] → [0.96,0.96,0.96]`
- **Hue dominante**: 213°–220° (azul frío, ligeramente hacia violeta).

---

## 2. Texturas

Cuatro capas texturales coexisten en la referencia. Documentadas por separado para poder reimplementarlas como módulos independientes.

### 2.1 Vidriado porcelana (base)

- Superficie **glossy**, reflectancia especular alta pero estrecha (highlight compacto).
- Microvariación casi nula: el ruido del material es inferior al del papel o el yeso.
- Transición luz→sombra suave, casi lambertiana, con un *terminator* ligeramente frío.
- En Hydra: base `solid(0.94,0.95,0.94)` + `noise(3, 0.1)` muy sutil para quitar planitud + un `gradient` direccional para simular el falloff del cuerpo.
- En TD: un `Phong MAT` con `specular 0.85`, `roughness 0.08`, `normal map` de ruido de baja amplitud basta.

### 2.2 Ink-wash cobalto (la pintura sobre el cuerpo)

- Calidad **sumi-e / aguada**: opacidad variable dentro del mismo trazo, bordes con "sangrado" mínimo, centros más opacos.
- Los trazos combinan **línea fina** (contornos) y **manchas** (follaje, montañas).
- Densidad local muy variable: zonas enteras casi vacías contra zonas saturadas de detalle.
- Claves para imitarlo:
  - Multiplicar una capa de ruido suave (`noise(1.5, 0.05)`) con una máscara de formas para obtener la variación de opacidad.
  - Usar `thresh()` con un valor cercano a 0.5 para recuperar el efecto de tinta seca/húmeda.
  - El color no es uniforme: va de `cobalt_wash` en lavados a `cobalt_ink` en los trazos finales.

### 2.3 Crecimientos corales / bonsái 3D

- Estructura **fractal dendrítica**: ramificación binaria/ternaria con clusters terminales granulados.
- Los clusters parecen coliflor o coral — repetición auto-similar a 3–4 escalas.
- Color: `cobalt_mid` → `cobalt_deep` con highlights de `porcelain_highlight` en las puntas (vidriado).
- En Hydra, aproximación:
  - `voronoi` a escalas 4, 10, 28 sumadas con pesos decrecientes.
  - Modular con `modulate(noise())` para romper la regularidad.
  - `thresh` alto para aislar los clusters.
- En TD: ideal un SOP fractal (L-system o Copy SOP recursivo) displaceado por ruido.

### 2.4 Microdetalle pictórico (ultrafino)

El "detalle ultrafino" de la referencia no es textura de material — es **dibujo miniaturizado** sobre la superficie. Inventario:

- **Paisajes shanshui** en muslos y torso: montañas, agua, árboles solitarios, barcas, todo en 3–5 trazos cada uno.
- **Pájaros en vuelo**: siluetas de 3–4 píxeles, en parvadas dispersas.
- **Ramas y hojas de ciruelo/pino**: las hojas son clusters radiales de 5–7 puntos; las ramas serpentean con curvatura variable.
- **Dragón facial**: linework sinuoso sobre la mejilla, trazo muy fino, sin relleno.
- **Olas y nubes**: espirales concéntricas estilo *seigaiha* simplificado.
- **Peinado**: mechones separados por líneas paralelas finas, cada mechón rematado en coral.

Escalas características (relativas al cuerpo): `1/200` para pájaros, `1/80` para hojas individuales, `1/20` para ramas, `1/5` para clusters corales.

---

## 3. Motivos y composición

- **Simetría rota**: la figura es frontal pero los crecimientos corales rompen la silueta hacia la izquierda y arriba-derecha, creando diagonales.
- **Vacío calculado**: grandes zonas del cuerpo quedan en blanco porcelana para dar respiro al detalle. La proporción detalle/vacío es ~35/65.
- **Densidad por zona**: máxima en hombros, torso superior y rodilla; mínima en piernas y brazos, que actúan como "lienzos en reposo".
- **Dirección de lectura**: de la cabeza (coral denso) → hombro → torso (paisaje) → rodilla (coral 3D) → tierra.
- **Iluminación**: clave alta suave desde arriba-izquierda, *key light* fría, sin luz de relleno cálida (coherente con la ausencia de tonos cálidos en la paleta).

---

## 4. Traducción a parámetros omt07l

Cómo mapear esto al bus `window.omt.*` en una futura escena Hydra:

| Señal | Qué controla visualmente |
|---|---|
| `bass` | Densidad / tamaño de los clusters corales (fractal scale) |
| `mid` | Opacidad y cantidad de trazos ink-wash |
| `high` | Cantidad de microdetalle (pájaros, hojas) |
| `onset` | Disparo de nuevos trazos / "pinceladas" instantáneas |
| `pitch` | Posición en la rampa cobalto (grave = `cobalt_ink`, agudo = `cobalt_wash`) |
| `clarity` | Nitidez del vidriado vs. sangrado del ink-wash |
| `fft[0..7]` | Ocho "ramas" del fractal, cada una alimentada por una banda |

Regla conservadora: el **fondo porcelana nunca cambia**. Solo se modulan las capas de pintura y coral. Así se preserva la identidad visual incluso en silencio.

---

## 5. Referencias cruzadas

- Paleta reutilizable como tokens: `config/osc_map.yaml` podría linkear a un futuro `config/palettes/porcelain_blue.yaml`.
- Sketch objetivo: `mcp/hydra/sketches/porcelain_blue.js` (pendiente).
- Material TD: `td/materials/porcelain.md` (pendiente, notas para el `Phong MAT`).

---

*Estudio no vinculante — la ejecución creativa puede desviarse. Este documento existe para que una futura implementación (Hydra/SC/TD) tenga un punto de partida consistente y no se pierda el carácter de la referencia.*
