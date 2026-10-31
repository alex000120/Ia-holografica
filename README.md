# IA Holográfica · Control por Gestos

Reproductor de 5 videos a pantalla completa que se controla **solo con las manos**, usando la cámara.
Pensado para publicarse en GitHub Pages.

## Puesta en marcha

1. Copia tus 5 videos dentro de la carpeta `videos/` con estos nombres:
   `video1.mp4`, `video2.mp4`, `video3.mp4`, `video4.mp4`, `video5.mp4`
   (formato MP4 con H.264 para máxima compatibilidad).
2. Para cambiar los títulos, edita la lista `PLAYLIST` en `js/player.js`.
3. Abre `index.html` con un servidor local (la cámara requiere HTTPS o `localhost`):
   - `python -m http.server 8000` y entra a `http://localhost:8000`
4. Para GitHub Pages: sube la carpeta al repositorio, ve a **Settings → Pages**, elige la rama y la carpeta raíz.
   Tu sitio quedará en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

## Gestos

| Gesto | Manos | Función |
|---|---|---|
| ✋ Palma abierta | 1 | Mueve el cursor (la mano se dibuja en pantalla) |
| 🤏 Pellizco | 1 | Clic. Sobre un control lo activa; sobre el video pausa/reproduce. Sobre un deslizador lo arrastra; sobre un menú pasa a la siguiente opción |
| ✌ Paz | 1 | Adelantar 10 s |
| 🤙 Llamada | 1 | Retroceder 10 s |
| 👍 Pulgar arriba | 1 | Subir volumen |
| 👎 Pulgar abajo | 1 | Bajar volumen |
| ✊ Puño | 1 | Silencio / sonido |
| ☝ Índice arriba | 1 | Mostrar / ocultar configuración (mantener un poco más) |
| 🤟 Te quiero | 1 | Pantalla completa |
| ✊✊ Dos puños | 2 | Reproducir / pausa |
| ✌✌ Dos paz | 2 | Activar / desactivar efectos visuales |
| 👉 Dos palmas deslizan a la derecha | 2 | Siguiente video |
| 👈 Dos palmas deslizan a la izquierda | 2 | Video anterior |
| ❤ Corazón con dos manos | 2 | Foto recuerdo: se toma la foto, se arma la tarjeta y se guarda en galería |

Todos los controles de la configuración también se pueden manejar con pellizco.
Como respaldo, el teclado funciona: espacio, flechas, `M`, `F`, `S`, `P` (foto).

## Mini cámara de diagnóstico

Abajo a la izquierda se ve lo que detecta la cámara: las manos con sus puntos y el gesto reconocido.
El indicador de color muestra el estado: **verde** gesto detectado, **amarillo** mano sin gesto claro, **rojo** no hay manos.

## Configuración por dispositivo

El botón ⚙ (arriba a la derecha) abre el panel. Ahí puedes elegir:

- **Perfil de dispositivo**: automático, alto rendimiento, equilibrado o bajo consumo.
- **Resolución de cámara** y **modelo de detección** (completo o ligero).
- **Sensibilidad del pellizco**, **suavizado del cursor** y **tiempo para confirmar un gesto**.
- Espejo, mostrar mini cámara, dibujar manos y efectos visuales.

Cada tipo de dispositivo (escritorio, tablet, móvil) guarda su propia configuración en el navegador.

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox o Safari reciente).
- Cámara y permiso para usarla.
- Conexión a internet la primera vez (carga MediaPipe desde jsDelivr).

## Estructura

```
index.html        pantalla principal
css/styles.css    estilos
js/settings.js    perfiles y configuración por dispositivo
js/gestures.js    detección de manos y clasificación de gestos
js/effects.js     dibujo de manos, partículas y transiciones
js/player.js      lista de videos y controles de reproducción
js/photo.js       foto recuerdo y guardado
js/app.js         une todo: gestos → acciones, cursor y pellizco
videos/           coloca aquí video1.mp4 … video5.mp4
```

## Consejos para una buena detección

- Usa buena luz de frente y mantén las manos entre 40 y 80 cm de la cámara.
- Con fondo liso se detecta mejor.
- Si el cursor tiembla, sube el suavizado; si responde lento, bájalo.
- En celulares antiguos usa el perfil **Bajo consumo**.
