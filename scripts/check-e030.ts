import { resolveE030, syncE030 } from "../src/lib/e030/resolve";
import { e030C } from "../src/lib/e030/tablas";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const lima = resolveE030({
  dept: "Lima",
  prov: "Lima",
  dist: "Lima",
  suelo: "S2",
  categoria: "C",
  sistema: "ca-porticos",
  ia: "reg",
  ip: "reg",
  H: "15.8",
  Ct: "35",
});
assert(lima.zona === 4 && lima.Z === 0.45, `Lima zona ${lima.zona} Z ${lima.Z}`);
assert(lima.S === 1.1 && lima.Tp === 0.6 && lima.Tl === 2, `Lima S ${lima.S} Tp ${lima.Tp}`);
assert(lima.U === 1 && lima.R0 === 8 && lima.R === 8, `Lima U ${lima.U} R ${lima.R}`);
console.log("Lima OK", lima.ubicacion, "zona", lima.zona, "Z", lima.Z, "S", lima.S);

const iquitos = resolveE030({
  dept: "Loreto",
  prov: "Maynas",
  dist: "Iquitos",
  suelo: "S3",
  categoria: "A2",
  sistema: "ca-dual",
  ia: "reg",
  ip: "reg",
  H: "12",
  Ct: "60",
});
assert(iquitos.zona === 1 && iquitos.Z === 0.1, `Iquitos zona ${iquitos.zona}`);
assert(iquitos.S === 1.6 && iquitos.Tp === 0.9, `Iquitos S ${iquitos.S}`);
assert(iquitos.U === 1.5 && iquitos.R0 === 7, `Iquitos U ${iquitos.U} R0 ${iquitos.R0}`);
console.log("Iquitos OK", iquitos.ubicacion, "zona", iquitos.zona, "S", iquitos.S, "U", iquitos.U);

const a1 = resolveE030({ ...lima, categoria: "A1-aislado" } as never);
assert(a1.U === 1, `A1 aislado U ${a1.U}`);

const casc = syncE030({ dept: "Arequipa", suelo: "S1", categoria: "B", sistema: "alba", ia: "reg", ip: "reg", H: "8", Ct: "60" }, "dept");
assert(casc.prov && casc.dist && Number(casc.Z) > 0, `cascade ${casc.prov} ${casc.dist} Z ${casc.Z}`);
console.log("Cascade Arequipa OK", casc.prov, casc.dist, "zona", casc.zona, "Z", casc.Z, "R0", casc.R0);

assert(Math.abs(e030C(0, 0.6, 2) - 1) < 1e-9, "C(0)");
assert(Math.abs(e030C(0.12, 0.6, 2) - 2.5) < 1e-9, "C(0.2Tp)");
assert(Math.abs(e030C(0.3, 0.6, 2) - 2.5) < 1e-9, "C plateau");
assert(Math.abs(e030C(1.2, 0.6, 2) - 2.5 * 0.6 / 1.2) < 1e-9, "C descenso");
console.log("C Tabla 6 OK");

const vichayal = resolveE030({
  dept: "Piura",
  prov: "Paita",
  dist: "Vichayal",
  suelo: "S2",
  categoria: "C",
  sistema: "ca-porticos",
  ia: "reg",
  ip: "reg",
  H: "10",
  Ct: "35",
});
assert(vichayal.zona === 4, `Vichayal zona ${vichayal.zona} (debía corregirse de 5 a 4)`);
console.log("Vichayal corregido OK zona", vichayal.zona);

console.log("todas las pruebas pasaron");
