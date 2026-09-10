import { useRef, useState } from "react";

/**
 * Publica un ejemplo al abrir y congela el informe hasta que el usuario pulse Calcular.
 * Si cambia resetKey (otro formato o modo), se siembra el ejemplo de esa hoja.
 */
export function useMemoriaOnCalcular<T>(live: T, resetKey?: string) {
  const [pub, setPub] = useState(() => ({ key: resetKey, doc: live, dirty: false }));
  const liveRef = useRef(live);
  const seen = useRef(live);
  liveRef.current = live;

  if (pub.key !== resetKey) {
    seen.current = live;
    setPub({ key: resetKey, doc: live, dirty: false });
  } else if (seen.current !== live) {
    seen.current = live;
    if (!pub.dirty) setPub((s) => ({ ...s, dirty: true }));
  }

  const calcular = () => {
    setPub((s) => ({ ...s, doc: liveRef.current, dirty: false }));
  };

  return { doc: pub.doc, dirty: pub.dirty, calcular };
}

export function CalcularButton({
  onClick,
  dirty = true,
  disabled,
}: {
  onClick: () => void;
  dirty?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={`btn btn-calc${dirty ? " is-ready" : ""}`} onClick={onClick} disabled={disabled}>
      Calcular
    </button>
  );
}

export function CalcDirtyNote({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return <p className="calc-note">Hay cambios sin calcular. Pulse Calcular para actualizar el informe.</p>;
}

export function MemoriaPendiente({ hint }: { hint?: string }) {
  return (
    <div className="paper-pending" role="status">
      <p className="kicker">Memoria de cálculo</p>
      <h2>Informe pendiente</h2>
      <p>
        {hint ??
          "El informe de esta hoja se genera al pulsar Calcular. Revise los datos de entrada y calcule para ver el desarrollo."}
      </p>
    </div>
  );
}
