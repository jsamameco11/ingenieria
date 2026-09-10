# MemoriaCalc

Plataforma de memorias de cálculo para ingeniería civil. Croquis con cotas vivas, procedimiento didáctico y verificación normativa.

## Producción

**Host único:** [https://ingenieria.miacademiapreu.com](https://ingenieria.miacademiapreu.com)

No existe `calculos.miacademiapreu.com` ni otros subdominios de esta app.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Despliegue (VPS)

1. `npm install && npm run build`
2. Nginx: `deploy/nginx-ingenieria.conf` → `server_name ingenieria.miacademiapreu.com`
3. Culqi: `deploy/memorcalc-culqi.service` + `/etc/memorcalc-culqi.env`
4. Certificado: `certbot --nginx -d ingenieria.miacademiapreu.com`

Detalle en `/despliegue`.

## Supabase

- MemoriaCalc: `kxiunxdjtaesswgexsij` → `supabase/schema.sql`
- Folio (Plan Pro / nube): `npm run supabase:usuarios`
