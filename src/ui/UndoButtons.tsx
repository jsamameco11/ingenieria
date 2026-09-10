type Props = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  className?: string;
};

export function UndoButtons({ undo, redo, canUndo, canRedo, className = "" }: Props) {
  return (
    <div className={`hist-btns ${className}`.trim()} role="group" aria-label="Historial de edición">
      <button type="button" disabled={!canUndo} title="Deshacer (Ctrl+Z)" aria-keyshortcuts="Control+Z" onClick={undo}>
        Atrás
      </button>
      <button type="button" disabled={!canRedo} title="Rehacer (Ctrl+Y)" aria-keyshortcuts="Control+Y" onClick={redo}>
        Adelante
      </button>
    </div>
  );
}
