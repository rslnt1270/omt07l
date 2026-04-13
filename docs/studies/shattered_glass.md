# Estudio visual — *Shattered Glass*

Referencia: rostro en perfil compuesto enteramente por fragmentos de vidrio/espejo, con un sunburst radial de esquirlas alargadas alrededor del ojo. Fondo cálido marrón desenfocado. Pieza **casi monocroma**: el drama es puro claroscuro + especulares.

---

## 1. Paleta

Ejes dominantes: **marrón cálido** (fondo) vs **plata/gris frío** (vidrio), con negros puros en las grietas y especulares casi blancos en los bordes. Saturación mínima — el color vive en el contraste de temperatura, no en el hue.

| Token | Hex | RGB01 | Rol |
|---|---|---|---|
| `bg_wood_dark` | `#1C0F08` | 0.110, 0.059, 0.031 | Sombra más profunda del fondo, marco |
| `bg_wood_mid` | `#3A200F` | 0.227, 0.125, 0.059 | Fondo desenfocado dominante |
| `bg_wood_warm` | `#6B3E1C` | 0.420, 0.243, 0.110 | Destellos cálidos (reflejos indirectos) |
| `bg_wood_amber` | `#8C5424` | 0.549, 0.329, 0.141 | Punto más claro del fondo, ámbar quemado |
| `crack_black` | `#080604` | 0.031, 0.024, 0.016 | Hairlines entre esquirlas — casi negro puro |
| `shard_shadow` | `#2E323A` | 0.180, 0.196, 0.227 | Interior de las esquirlas en sombra |
| `shard_body` | `#8C929A` | 0.549, 0.573, 0.604 | Gris plata, masa media del vidrio |
| `shard_cool` | `#B4BDC4` | 0.706, 0.741, 0.769 | Gris frío, caras orientadas al cielo |
| `shard_highlight` | `#E8ECEF` | 0.910, 0.925, 0.937 | Borde/cara iluminada frontal |
| `spec_white` | `#FBFCFD` | 0.984, 0.988, 0.992 | Catchlights puntuales, cuasi-blanco |
| `refl_warm` | `#6A4428` | 0.416, 0.267, 0.157 | Bounce cálido del fondo sobre vidrio inferior |

Notas operativas:
- **Sí hay negro casi puro** esta vez (`crack_black`) — es estructural, define las grietas.
- **Sí hay blanco casi puro** (`spec_white`) — los catchlights de vidrio pulido son uno de los motivos principales, no se pueden suavizar.
- **Temperatura cruzada**: fondo cálido (marrones 20–30° hue) vs vidrio frío (200–220° hue muy desaturado). Evita mezclarlos salvo en `refl_warm`, que es justamente la zona donde el vidrio recoge bounce.
- Rango dinámico **enorme**: de 0.02 (`crack_black`) a 0.99 (`spec_white`). La paleta porcelana vivía en 0.05–0.97 con casi todo apretado en los medios; aquí la distribución es bimodal.

### Rampas

- **Glass** (`crack_black` → `shard_shadow` → `shard_body` → `shard_highlight` → `spec_white`): rampa principal del vidrio, casi gris neutro.
- **Wood** (`bg_wood_dark` → `bg_wood_mid` → `bg_wood_warm` → `bg_wood_amber`): rampa cálida del fondo.
- **Contrast** (`crack_black` → `bg_wood_mid` → `shard_body` → `spec_white`): rampa de alto contraste que salta temperatura — útil para gradient maps globales.

---

## 2. Texturas

### 2.1 Fondo cálido desenfocado

- Marrón profundo con grano muy suave, textura como terciopelo o madera out-of-focus.
- Falloff radial desde centro-derecha (donde vive la cabeza) hacia los bordes más oscuros.
- En Hydra: `gradient().mult(solid(wood_mid))` + `noise(1.5, 0.02)` muy bajo para romper planitud.
- Bokeh cálido opcional con `voronoi` de escala baja y blur (Hydra no tiene blur directo, pero `modulate` con noise lento aproxima).

### 2.2 Tessellation de esquirlas

Esta es la capa estructural clave. Dos propiedades que hay que replicar:

- **Radialidad local**: las esquirlas se alargan en dirección radial desde un punto focal (cerca del ojo). No son celdas isotrópicas como un voronoi estándar.
- **Irregularidad global**: las esquirlas son poligonales, de tamaños mixtos, bordes rectos.

Enfoques:
1. **Voronoi en coordenadas polares**: pre-warpear el campo con `(r, θ)` antes de alimentar `voronoi`. Hydra no tiene transformación polar directa, pero se puede aproximar con `scale` + `rotate` + `kaleid`.
2. **Kaleidoscopio sobre voronoi**: `voronoi(...).kaleid(N)` da simetría radial con celdas alargadas. El problema: es demasiado simétrico, hay que romper con `modulate` de ruido lento.
3. **Voronoi estándar + mask radial**: dos capas de voronoi, una isotrópica en los bordes y una radial cerca del ojo, mezcladas por una máscara de distancia al centro.

Para el preview arranco con la opción 2 porque es la más barata; si el aliasing radial se nota demasiado migramos a la 3.

### 2.3 Hairlines (grietas)

- Bordes del voronoi como líneas negras. En Hydra: `voronoi(...).thresh(0.9)` para aislar solo las celdas más cerradas, `invert()` si es necesario.
- Grosor **fino**: si las líneas se ven gruesas mata el efecto vidrio — deben ser casi 1px a la resolución del canvas.

### 2.4 Especulares y caras iluminadas

- Cada esquirla tiene una cara "iluminada" en el lado que mira hacia la luz (izquierda en la referencia).
- Aproximación en Hydra: gradiente direccional multiplicado por la máscara de cada esquirla. El truco: usar el mismo `voronoi` pero con `scale` distinto para obtener "dentro de cada celda" → gradiente → suma al color base.
- Catchlights: ruido de alta frecuencia **threshold alto** (0.95+) para solo disparar puntos brillantes dispersos.

### 2.5 Silueta del rostro

La referencia es un rostro reconocible. Replicar un rostro en Hydra con primitivas procedurales no es trivial y no es lo que queremos en un preview. Alternativas:

1. **Abstracto** — aceptar que el preview muestra solo el *material* (vidrio fragmentado radial) sin rostro. Mejor para iterar la paleta y textura.
2. **Máscara importada** — cargar una silueta de rostro como `src(s0)` desde una imagen y usarla como máscara. Requiere que `client.js` exponga `s0`/`initImage`.
3. **SDF de elipse** — Hydra permite `shape(100, ...)` que es casi un círculo; se puede distorsionar con `scale()` asimétrico. Aproxima una cabeza grotescamente.

Arranco por **(1)** para el preview. Si queremos rostro reconocible, lo natural es moverlo a TD (SOPs + texturas) cuando tengas el dualboot listo.

---

## 3. Motivos y composición

- **Asimetría fuerte**: el sujeto ocupa 2/3 del frame, el fondo 1/3. Preservar esa proporción en el sketch da carácter aunque no haya rostro.
- **Centro focal único**: todo el sunburst radial emana del ojo. El sketch debe tener un punto focal claro — no simetría doble.
- **Luz dura lateral**: key light desde la izquierda, sin fill. Esto es lo que hace que cada esquirla tenga una cara brillante y otra oscura.
- **Vacío cálido detrás**: el fondo no es neutro gris, es cálido saturado. Eso hace que el vidrio "corte" con temperatura, no con brillo.

---

## 4. Mapeo al bus `window.omt.*`

| Señal | Efecto |
|---|---|
| `bass` | Escala del sunburst radial (explosión) |
| `mid` | Intensidad de los especulares |
| `high` | Cantidad de catchlights dispersos |
| `onset` | Pulso del centro focal (pequeño zoom/kick) |
| `pitch` | Rotación del sunburst |
| `clarity` | Nitidez de los hairlines (alto=definido, bajo=difuso) |
| `fft[0..7]` | 8 sectores angulares del sunburst, cada uno con su energía |

Regla: el **fondo cálido se mantiene casi fijo**, con micro-variaciones de brillo acopladas a `bass` pero nunca a los medios/agudos. Eso preserva el peso compositivo incluso en silencios.

---

## 5. Riesgos técnicos conocidos

1. **El sunburst radial puro se ve cliché** (efecto "kaleidoscopio 2012"). Mitigación: siempre `modulate` con ruido de baja frecuencia para romper la simetría perfecta.
2. **Los especulares en Hydra son difíciles** — no hay iluminación real, solo hacks con gradientes y threshold. Si no convencen, la pieza se moverá naturalmente a TD donde sí hay `Phong MAT` con specular real.
3. **El rango dinámico amplio puede aplastarse** en el render final si se hace sRGB naive. Vigilar el gamma al componer capas.
