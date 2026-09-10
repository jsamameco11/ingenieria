"use client";

import { useMemo, useState } from "react";
import { Printer, Save } from "lucide-react";
import { DiagramFor } from "@/components/Diagrams";
import type { ModuleMeta } from "@/lib/catalog";
import type { Inputs } from "@/lib/engineering";
import { MODULE_DEFAULTS, MODULE_FIELDS, computeModule } from "@/lib/modules";
import { printMemoria } from "@/lib/printDoc";
import { saveCalculation } from "@/lib/supabase";

export function Calculator({ meta }: { meta: ModuleMeta }) {
  const fields = MODULE_FIELDS[meta.slug] ?? [];
  const [inputs, setInputs] = useState<Inputs>({ ...(MODULE_DEFAULTS[meta.slug] ?? {}) });
  const [obra, setObra] = useState("Puente / Edificio — proyecto");
  const [ingeniero, setIngeniero] = useState("Ing. Civil");
  const [ubicacion, setUbicacion] = useState("Perú");
  const [status, setStatus] = useState("");

  const result = useMemo(() => computeModule(meta.slug, inputs), [meta.slug, inputs]);
  const groups = [...new Set(fields.map((f) => f.group))];

  function setField(key: string, value: number | string) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setStatus("Guardando…");
    const res = await saveCalculation({
      module_slug: meta.slug,
      title: `${meta.title} · ${obra}`,
      inputs: { ...inputs, obra, ingeniero, ubicacion },
      results: result as unknown as Record<string, unknown>,
    });
    setStatus(res.message);
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-copper uppercase">{meta.categoryLabel} · {meta.norma}</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-navy">{meta.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-2">{meta.description}</p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={save} className="inline-flex items-center gap-2 rounded-sm bg-navy px-4 py-2 text-sm text-paper">
            <Save size={16} /> Guardar
          </button>
          <button onClick={() => printMemoria(meta.title)} className="inline-flex items-center gap-2 rounded-sm border border-line bg-white px-4 py-2 text-sm">
            <Printer size={16} /> Imprimir memoria
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sheet p-4 md:grid-cols-3">
        <label className="text-xs text-steel">Obra
          <input className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink" value={obra} onChange={(e) => setObra(e.target.value)} />
        </label>
        <label className="text-xs text-steel">Ingeniero
          <input className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink" value={ingeniero} onChange={(e) => setIngeniero(e.target.value)} />
        </label>
        <label className="text-xs text-steel">Ubicación
          <input className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="sheet overflow-hidden">
          <DiagramFor slug={meta.slug} inputs={inputs} onChange={setField} />
          <p className="border-t border-line px-4 py-2 text-[11px] text-steel">
            Las cotas del dibujo son editables: cambie un valor en la figura o en el formulario y la memoria se recalcula al instante.
          </p>
        </div>
        <div className="sheet p-4">
          {groups.map((g) => (
            <div key={g} className="mb-5">
              <h2 className="mb-2 text-[11px] tracking-[0.18em] text-copper uppercase">{g}</h2>
              <div className="grid grid-cols-2 gap-3">
                {fields.filter((f) => f.group === g).map((f) => (
                  <label key={f.key} className="text-xs text-steel">
                    {f.label} {f.unit ? <span className="text-copper">({f.unit})</span> : null}
                    {f.type === "select" ? (
                      <select
                        className="mt-1 w-full border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        value={String(inputs[f.key] ?? "")}
                        onChange={(e) => setField(f.key, e.target.value)}
                      >
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step={f.step ?? 0.1}
                        className="mt-1 w-full border border-line bg-white px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm text-ink"
                        value={inputs[f.key] as number | string}
                        onChange={(e) => setField(f.key, Number(e.target.value))}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="sheet mt-6 p-6">
        <p className="text-[11px] tracking-[0.2em] text-copper uppercase">Memoria de cálculo</p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">{result.title}</h2>
        <p className="mt-1 text-sm text-ink-2">{result.summary}</p>
        <ol className="mt-6 space-y-5">
          {result.steps.map((s, idx) => (
            <li key={s.title} className="border-b border-line/70 pb-4">
              <p className="text-sm font-semibold text-navy">{idx + 1}. {s.title}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[12px] text-ink">{s.formula}</p>
              {s.substitution ? <p className="text-[12px] text-steel">{s.substitution}</p> : null}
              <p className="mt-1 text-sm"><span className="text-steel">Resultado: </span><strong>{s.result} {s.unit}</strong></p>
              {s.note ? <p className="text-[12px] text-copper">{s.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="sheet p-5">
          <h3 className="mb-3 text-[11px] tracking-[0.18em] text-copper uppercase">Verificaciones</h3>
          <ul className="space-y-2">
            {result.checks.map((c) => (
              <li key={c.id} className={`flex items-start justify-between gap-3 rounded-sm px-3 py-2 ${c.ok ? "bg-ok-bg" : "bg-fail-bg"}`}>
                <div>
                  <p className="text-sm text-ink">{c.label}</p>
                  <p className="text-[11px] text-steel">Límite: {c.limit}</p>
                </div>
                <div className="text-right">
                  <p className={`font-[family-name:var(--font-mono)] text-sm ${c.ok ? "text-ok" : "text-fail"}`}>{c.value}</p>
                  <p className="text-[10px] tracking-widest uppercase">{c.ok ? "OK" : "REVISAR"}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="sheet p-5">
          <h3 className="mb-3 text-[11px] tracking-[0.18em] text-copper uppercase">Acero y notas</h3>
          {result.steel?.length ? (
            <table className="mb-4 w-full text-left text-sm">
              <thead className="text-[11px] tracking-widest text-steel uppercase">
                <tr><th className="pb-2">Zona</th><th>Barras</th><th>As</th></tr>
              </thead>
              <tbody>
                {result.steel.map((s) => (
                  <tr key={s.zone} className="border-t border-line">
                    <td className="py-2">{s.zone}</td>
                    <td className="font-[family-name:var(--font-mono)] text-xs">{s.bars}</td>
                    <td>{s.As}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <ul className="list-disc space-y-1 pl-4 text-[12px] text-ink-2">
            {result.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      </section>
      {status ? <p className="no-print mt-4 text-sm text-navy">{status}</p> : null}
    </div>
  );
}
