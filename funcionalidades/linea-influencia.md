# Líneas de influencia y carga móvil

Módulo `linea-influencia`. Motor FEM de viga continua (Euler–Bernoulli) + envelope de trenes AASHTO LRFD 3.6 y flota legal MTC (RNV + Manual de Puentes 2018).

## Modelo

- **2 a 7 apoyos** (1 a 6 tramos). Luces L1…L6.
- Extremos **simple / empotrado / voladizo**. Interiores: apoyo simple (continúa sobre pilas).
- Sección `x` desde el extremo izquierdo: η_M, η_V (cara izq. y der.) y η_R del apoyo elegido.
- Un tramo isostático usa la fórmula cerrada `ξ(L−x)/L`. Continuo y empotrado: rigideces, GDL v–θ, cargas nodales equivalentes de P = 1 t.
- **Derivada:** `η_V = ∂η_M/∂x` (respecto de la sección, no de ξ). Viga simple: `η_V = −ξ/L` si ξ<x y `(L−ξ)/L` si ξ>x. Salto `η_V⁺ − η_V⁻ = 1` en x. `∂η_M/∂ξ` es la pendiente del triángulo de momento, distinta de η_V.

## Análisis móvil (cota s₀)

- Campo **Cota del 1.er eje s₀**: vacío = posición que maximiza el efecto (crítica del envelope). Un número = el tren se ancla ahí.
- La cota también se edita en el croquis (dimensión del 1.er eje). Pulse **Calcular** tras moverla.
- En esa posición: `M(x) = Σ P_i η_M(ξ_i)` y `V(x) = Σ P_i η_V(ξ_i)` con `ξ_i = s₀ + s_i`, tabla eje a eje en el paso 05.
- El diagrama instantáneo M(x), V(x) es de esa cota. Los envelopes recorren **todas** las posiciones.

## Cargas

- **HL-93:** máx{ (1+IM)·camión + carril ; (1+IM)·tándem + carril }. En continuo, 0.90×dos camiones + carril (3.6.1.3.1, holgura ≥ 15 m). IM 33 % (15 % fatiga). Carril 0.95 t/m **sin** IM, solo en zonas adversas de η.
- **Integral de faja:** se parten los ceros de η y se integran trapecios `A = ½(η_a+η_b)Δξ`. Isostático de momento: `∫η_M dξ = x(L−x)/2`. Isostático de cortante: `A+ = (L−x)²/(2L)`, `A− = −x²/(2L)`. El paso 07 sustituye L, x y el primer trapecio.
- **m** presencia múltiple 1.20 / 1.00 / 0.85 / 0.65. Resistencia I: γ = 1.75.
- **MTC RNV:** rígidos C2/C3/N3 (2–4 ejes), articulados T2S1–T3S3, rígido+remolque C2R1–C3R3, tractocamión+remolque T2R1–T3R2, buses 2/3 ejes y articulado.
- **Múltiples:** dos T3S3. **Especial:** hasta 8 ejes de usuario. **Puntual P** recorre la viga.

## Informe

Pasos 01–11. Tabla de ordenadas, superposición en s₀, desglose de la integral (trapecios), envolvente M(x)/V(x) y comparación de trenes.

Croquis:

1. **Líneas de influencia** η_M y η_V en x (η_V con salto, escalas propias). 1 o 2 chasis en s₀.
2. **Esfuerzos con el tren en s₀** — M(x) y V(x) instantáneos (análisis móvil).
3. **Momentos máximos y mínimos** del tren adoptado (envelope de todas las posiciones).
4. **Cortantes máximos y mínimos** del tren adoptado.
5. **Envolvente de momentos — todos los trenes**.
6. **Envolvente de cortantes — todos los trenes**.

El titular resume `Diseño M+ · M− · |V|` y la cota s₀ usada. En el papel las seis figuras van a ancho completo, con margen interno para que apoyos y envolventes no se recorten; las cotas numéricas se apartan un poco de la curva.
