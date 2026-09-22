/**
 * Momentos de diseño de Wood & Armer para placas con armadura ortogonal.
 *
 * Wood, R.H. (1968) "The reinforcement of slabs in accordance with a
 * pre-determined field of moments"; Armer, G.S.T. (1968), discusión.
 * Combina Mx, My y el momento torsor Mxy en dos momentos equivalentes por
 * dirección, uno para la malla traccionada en la cara inferior y otro para la
 * superior, de modo que el criterio de fluencia normal–momento se satisface en
 * cualquier dirección.
 *
 * Convenio: M > 0 tracciona la cara +z local (malla "superior").
 * Por eso `sup` usa el caso positivo y `inf` el negativo.
 */

export type MomentField = { mxx: number; myy: number; mxy: number };

export type WoodArmer = {
  /** Momentos de diseño para la malla del lado +z (kN·m/m, ≥ 0). */
  supX: number;
  supY: number;
  /** Momentos de diseño para la malla del lado −z (kN·m/m, ≥ 0). */
  infX: number;
  infY: number;
};

export function woodArmer(m: MomentField): WoodArmer {
  const { mxx, myy, mxy } = m;
  const a = Math.abs(mxy);

  // Cara +z (momentos positivos).
  let sx = mxx + a;
  let sy = myy + a;
  if (sx < 0) {
    sx = 0;
    sy = myy + Math.abs(mxy * mxy / (mxx || -1e-12));
    if (sy < 0) sy = 0;
  } else if (sy < 0) {
    sy = 0;
    sx = mxx + Math.abs(mxy * mxy / (myy || -1e-12));
    if (sx < 0) sx = 0;
  }

  // Cara −z (momentos negativos).
  let ix = mxx - a;
  let iy = myy - a;
  if (ix > 0) {
    ix = 0;
    iy = myy - Math.abs(mxy * mxy / (mxx || 1e-12));
    if (iy > 0) iy = 0;
  } else if (iy > 0) {
    iy = 0;
    ix = mxx - Math.abs(mxy * mxy / (myy || 1e-12));
    if (ix > 0) ix = 0;
  }

  return { supX: sx, supY: sy, infX: -ix, infY: -iy };
}

/** Cortante resultante por unidad de longitud: q = √(qx² + qy²). */
export function shearResultant(qx: number, qy: number) {
  return Math.hypot(qx, qy);
}
