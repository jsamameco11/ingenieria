"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase, type CalculationRow, type ProjectRow } from "@/lib/supabase";

export default function ProyectosPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [calcs, setCalcs] = useState<CalculationRow[]>([]);
  const [name, setName] = useState("");
  const [engineer, setEngineer] = useState("");
  const [msg, setMsg] = useState("Conectando con Supabase…");

  async function load(sb: NonNullable<ReturnType<typeof getSupabase>>) {
    const p = await sb.from("projects").select("*").order("created_at", { ascending: false });
    const c = await sb.from("calculations").select("*").order("created_at", { ascending: false }).limit(30);
    if (p.error || c.error) setMsg(p.error?.message ?? c.error?.message ?? "Error");
    else {
      setProjects((p.data ?? []) as ProjectRow[]);
      setCalcs((c.data ?? []) as CalculationRow[]);
      setMsg("");
    }
  }

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setMsg("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.");
      return;
    }
    load(sb);
  }, []);

  async function createProject() {
    const sb = getSupabase();
    if (!sb || !name.trim()) return;
    const { error } = await sb.from("projects").insert({ name, engineer, location: "Perú" });
    if (error) setMsg(error.message);
    else {
      setName("");
      await load(sb);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-navy">Proyectos</h1>
      <p className="mt-2 text-ink-2">Obras y memorias guardadas en Supabase (`kxiunxdjtaesswgexsij`).</p>
      {msg ? <p className="mt-4 text-sm text-fail">{msg}</p> : null}

      <div className="sheet mt-6 flex flex-wrap gap-3 p-4">
        <input className="border border-line px-3 py-2 text-sm" placeholder="Nombre de obra" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border border-line px-3 py-2 text-sm" placeholder="Ingeniero" value={engineer} onChange={(e) => setEngineer(e.target.value)} />
        <button onClick={createProject} className="bg-navy px-4 py-2 text-sm text-paper">Crear proyecto</button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <article key={p.id} className="sheet p-4">
            <h2 className="text-navy">{p.name}</h2>
            <p className="text-sm text-steel">{p.engineer} · {p.location}</p>
          </article>
        ))}
      </div>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl text-navy">Últimas memorias</h2>
      <ul className="mt-3 space-y-2">
        {calcs.map((c) => (
          <li key={c.id} className="sheet flex items-center justify-between p-3 text-sm">
            <span>{c.title}</span>
            <Link className="text-navy" href={`/memorias/${c.module_slug}`}>Abrir módulo</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
