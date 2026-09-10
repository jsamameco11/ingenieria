import { notFound } from "next/navigation";
import { Calculator } from "@/components/Calculator";
import { MODULES, moduleBySlug } from "@/lib/catalog";

export function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export default async function MemoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = moduleBySlug(slug);
  if (!meta) notFound();
  return <Calculator meta={meta} />;
}
