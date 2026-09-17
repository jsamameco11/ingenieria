# Deflexión de la pantalla del muro

La flecha de servicio de la pantalla se calcula en `src/lib/deflexion.ts` y el muro la usa en el paso 16.

## Procedimiento

1. `Ec = 15000 √f'c` y `fr = 2,01 √f'c`.
2. `Ig = b F³ / 12` en la base (franja 1,00 m).
3. `Mcr = fr Ig / (F/2)`.
4. `Ma` = momento de servicio en la base (Pa + Pw + Pq, sin factorar).
5. `Icr` de la sección fisurada transformada (eje neutro, `n = Es/Ec`).
6. Inercia efectiva de Branson: `Ie = (Mcr/Ma)³ Ig + [1−(Mcr/Ma)³] Icr`.
7. Elástica del voladizo empotrado: `δ = ∫ M(x)(Hs−x) / (Ec Ie(x)) dx`.
8. Límite: `δadm = Hs/150`.

## Si no cumple

El motor aumenta **F de 5 en 5 cm**, recalcula geometría, estabilidad y acero, y vuelve a integrar la elástica hasta `δ ≤ Hs/150` (tope práctico 1,20 m o Hs/4).

El F de ensayo queda en la ficha; el F adoptado entra al croquis y al resto de la memoria.
