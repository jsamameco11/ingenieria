# Inventario de usuarios (panel de control)

El parque de cuentas vive en Supabase (`public.users` + Auth). El panel **no borra** ese censo cuando la tabla sale vacía.

## Cómo se lee

1. El navegador pide `GET /api/control/snapshot` con la clave de titular.
2. Apache debe proxyar esa ruta a Node (`127.0.0.1:8788`).
3. El servidor arma el censo (Auth + `public.users` + perfiles + equipos).

Si Apache no tiene el proxy, `FallbackResource` (o `try_files` en nginx) devuelve el HTML del panel con HTTP 200. Antes el cliente interpretaba ese HTML como JSON vacío y mostraba **«Supabase conectado · 0 cuentas»**. Eso era un fallo de lectura, no un parque vacío.

## Qué no debe volver a pasar

El snippet `ingenieria-control.conf` es independiente de `ingenieria-billing.conf`. Un deploy de la web de Ingeniería no puede sobrescribir el proxy de control.

Sin JSON de snapshot, el inventario dice que **no se pudo leer** y no finge un censo de cero.
