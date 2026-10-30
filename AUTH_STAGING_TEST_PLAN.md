# Tesoria — Autenticación: validación en staging (fase 3)

**Fecha:** 30 de octubre de 2026  
**Estado:** suite de integración preparada, NO ejecutada contra PostgreSQL; 5 pruebas unitarias completadas.  
**Base:** Tesoria con las correcciones de seguridad fases 1 y 2; no se modificaron los endpoints de producción en esta fase.

## Alcance de esta fase

Añadimos `tests/auth.integration.test.js`, una suite HTTP + PostgreSQL real que prueba:

1. **Registro y verificación:** rechaza contraseñas de menos de 15 caracteres, acepta una frase válida, registra el usuario y activa el correo mediante un código conocido insertado SOLO en la BD de pruebas. Comprueba que el código es de un solo uso.
2. **Dos dispositivos:** crea un token temporal y otro con «Keep me signed in», verifica que sus `sid` son diferentes y que ambos pueden autenticarse simultáneamente.
3. **CSRF:** un logout sin `X-Tesoria-Request: 1` o con un Origin externo obtiene 403 y no revoca la sesión.
4. **Logout:** revoca el `sid` del dispositivo A; la misma cookie recibe 401 y el dispositivo B conserva acceso. Comprueba que la fila A se eliminó de `user_sessions`.
5. **Persistencia entre reinicios:** reinicia el servidor de staging, comprueba que A sigue bloqueado y que B conserva acceso.
6. **Remember Me:** comprueba que GET `/api/me` actualiza la expiración sin cambiar el `sid` ni crear una sesión nueva.
7. **Recuperación:** solicita el restablecimiento, rechaza una contraseña corta, acepta la nueva contraseña y deja inválidos los JWT anteriores.
8. **Cuentas preexistentes:** inserta una cuenta de prueba con una contraseña histórica corta y comprueba que puede iniciar sesión, aunque la política para contraseñas NUEVAS exige 15 caracteres.
9. **Limitación por cuenta:** mezcla correo y usuario con 10 contraseñas incorrectas y 10 direcciones IP **simuladas** mediante X-Forwarded-For. El intento 11 recibe 429 y `Retry-After`; la cuenta B sigue funcionando. Adelanta exclusivamente el contador de esa cuenta de prueba y confirma que A puede iniciar sesión otra vez.

Los datos ficticios generados por la suite se eliminan al finalizar. No se usan credenciales ni emails reales y los códigos de verificación nunca se envían por correo. La suite inicia el servidor **solo en 127.0.0.1** con configuración explícita y un `JWT_SECRET` temporal.

## Requisitos obligatorios de seguridad

- **Nunca usar la base de datos de producción.** Crea una base de datos nueva (o proyecto Neon independiente) cuyo **nombre contenga `_test` o `_staging`**, por ejemplo `tesoria_staging`.
- No basta con crear una *branch* llamada `staging` si la base de datos se llama `neondb`: la suite verificará el nombre de la base.
- La suite requiere **confirmación explícita**: `TESORIA_TEST_CONFIRM=I_UNDERSTAND_THIS_USES_A_TEST_DB`.
- También rechaza ejecutar con `NODE_ENV=production`, reutilizar literalmente `DATABASE_URL` o `DATABASE_URL_POOLED` y conectarse a una base cuyo nombre no parezca de pruebas.
- Haz copia de seguridad si el staging contiene datos que necesitas conservar. Al arrancar, el servidor ejecuta sus migraciones `initDb()` y su limpieza normal de periodos antiguos; por eso usa **staging desechable**, aunque la suite borre solo los usuarios que crea.
- El script no hace peticiones contra `https://tesoria.onrender.com` ni necesita tocar tu Render público.

## Cómo ejecutarlo en Windows PowerShell

Desde la carpeta raíz del proyecto:

```powershell
node --version
npm ci
npm ci --prefix client
npm test
npm run build --prefix client
```

Configura una URL **solo de staging** (no pegues la cadena en un chat, captura de pantalla o repositorio):

```powershell
$env:TESORIA_TEST_DATABASE_URL = Read-Host "Pega la URL de PostgreSQL de TESORIA STAGING (no producción)"
$env:TESORIA_TEST_CONFIRM = "I_UNDERSTAND_THIS_USES_A_TEST_DB"
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
npm run test:integration
```

En caso de error de certificado, **no** uses `rejectUnauthorized=false` ni desactives TLS en Neon. Comprueba CA, versión Node y parámetros del proveedor.

Al terminar, puedes retirar las variables de la sesión de PowerShell:

```powershell
Remove-Item Env:TESORIA_TEST_DATABASE_URL,Env:TESORIA_TEST_CONFIRM -ErrorAction SilentlyContinue
```

## Resultados esperados

- `npm test`: 5/5 pruebas unitarias.
- `npm run test:integration`: prueba principal y sus subpruebas en verde (la cantidad final de subpruebas puede cambiar si se amplía el archivo).
- `npm run build --prefix client`: build del frontend completo, sin errores.
- `npm audit --omit=dev` y `npm audit --prefix client`: revisar vulnerabilidades con conexión a internet.

## Comprobación de staging en Render (después de pasar local)

1. Crea un **servicio Render independiente**, con una URL de staging y una base de datos Neon separada, sin compartir `DATABASE_URL` con producción.
2. Configura `NODE_ENV=production`, `JWT_SECRET` único de staging (64+ caracteres aleatorios), `SITE_URL` igual al origen HTTPS de staging, `DATABASE_URL` de staging y configuración Brevo solo si vas a comprobar correos reales.
3. Comprueba que existen `user_sessions` y `login_attempts`, que el servidor arranca correctamente con la verificación TLS y que los endpoints no emiten 500.
4. Realiza manualmente registro, entrega de email, login en dos perfiles de navegador, logout de uno y recuperación. No uses credenciales reales.
5. Comprueba rate limits detrás del proxy: la IP percibida debe corresponder al cliente real, no a una cabecera manipulable ni siempre a la IP de Render. No hagas pruebas agresivas de fuerza bruta contra la aplicación pública.
6. Revisa CSP, cookies `Secure`, errores 401/403/429 y logs; no guardes tokens, contraseñas ni códigos en logs.

## Riesgos no cerrados por esta fase

- La suite automatizada **no prueba el proveedor Brevo real**. Prueba la API de verificación con códigos de prueba establecidos en la BD aislada.
- **No se ha ejecutado aquí** la suite de integración; no disponemos de PostgreSQL ni dependencias instaladas en el entorno de ejecución de este análisis.
- Las IP de la suite son simuladas: la configuración real de Render requiere comprobación por separado.
- El contador por cuenta puede provocar denegación temporal de acceso si un atacante agota los intentos; el mecanismo mitigador (detección/alertas, desafíos adaptativos) es una mejora futura.
- No se han ejecutado pruebas de penetración, auditoría de dependencias ni pruebas de carga. El resultado satisfactorio de esta suite no certificaría la seguridad integral de Tesoria.
- Regresar a una versión previa sin comprobación del `sid` anularía la revocación de sesiones. Revertir requiere plan de invalidación de JWTs.

## Próximo criterio para dar luz verde a producción

Solo después de: **integración verde + build verde + comprobación Brevo + revisión de cookies/origen + revisión de dependencias + respaldo de BD y plan de rollback**. Antes de desplegar comunicar que las sesiones antiguas deberán iniciar sesión nuevamente.
