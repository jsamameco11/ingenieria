import { notFound } from "next/navigation";
import { getModule } from "@/lib/catalog";
import { Calculator } from "@/components/Calculator";

export default function ModulePage({ params }: { params: { slug: string } }) {
  const mod = getModule(params.slug);
  if (!mod) notFound();
  return <Calculator mod={mod} />;
}
