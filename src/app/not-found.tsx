import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-serif text-3xl">Módulo no encontrado</h1>
      <Link href="/" className="mt-4 inline-block text-brass-600">Volver al catálogo</Link>
    </div>
  );
}
