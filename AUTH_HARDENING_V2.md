# Tesoria — Endurecimiento de autenticación (fase 2)

Fecha: 30 de octubre de 2026.

**Base:** `tesoria_security_hardened.zip` de la auditoría anterior. Este paquete integra los cambios anteriores (TLS, CSRF, importes, `session_version`) más estos tres cambios. No se modificó la base de datos pública ni se ejecutaron solicitudes de ataque a producción.

## 1. Contraseñas nuevas

- Registro (`POST /api/auth/register`) y recuperación (`POST /api/auth/reset`) ahora exigen **mínimo 15 caracteres Unicode** (recomendación de NIST SP 800-63B-4 para contraseñas como único factor en inicio de sesión).
- No se exigen mayúsculas, números ni símbolos especiales; los espacios están permitidos. El máximo es **72 bytes UTF-8** porque `bcryptjs` trunca silenciosamente a partir de ese límite. El frontend valida las mismas reglas.
- **No se bloquea el inicio de sesión de cuentas existentes con contraseñas antiguas.** La política se aplica al registro y al restablecimiento, no al login.
- **Pendiente recomendado:** una comprobación real contra una lista extensa de contraseñas habituales o filtradas. La longitud mínima por sí sola no detecta contraseñas comprometidas.

## 2. Límite por cuenta, compartido entre instancias

- Se creó la tabla `login_attempts`, con `identity_key` (HMAC-SHA-256, no almacena el identificador visible), `attempts` y `window_started_at`.
- Se permiten **10 intentos de login por 15 minutos para una cuenta**; el intento 11 recibe HTTP **429** y `Retry-After`. La reserva de intento es atómica mediante `INSERT ... ON CONFLICT DO UPDATE` **antes** de verificar la contraseña, de modo que solicitudes simultáneas no exceden el contador.
- El nombre de usuario y el correo de una misma cuenta comparten la misma clave derivada del ID de usuario. Para usuarios inexistentes hay una clave HMAC del identificador normalizado.
- Un inicio de sesión correcto elimina el contador. Sigue existiendo la protección por IP de `express-rate-limit` (20 intentos por 15 minutos, sujeta a configuración correcta del proxy).
- El restablecimiento de contraseña **no depende** del contador por cuenta. Aun así, los endpoints de recuperación sí están limitados por IP.
- **Trade-off:** un atacante podría consumir los intentos de una cuenta conocida y provocar un bloqueo temporal (denegación de servicio). Se recomienda registrar métricas y considerar desafíos adaptativos en versiones futuras.
- Las filas obsoletas se limpian diariamente junto a la purga programada.

## 3. Revocación real en logout, por dispositivo

- Se creó `user_sessions` (`id UUID`, `user_id`, `expires_at`, `created_at`) en PostgreSQL.
- Los nuevos JWT incluyen `sid`, que identifica la sesión creada por `crypto.randomUUID()` y registrada en la BD.
- Cada acceso autenticado exige **ambas cosas**: un JWT válido y una sesión con `sid` vigente en PostgreSQL, asociada al mismo usuario. Continúa aplicándose `session_version` para revocación global en recuperación de contraseña.
- `POST /api/auth/logout` elimina la fila `sid` de esa sesión antes de limpiar la cookie. Una copia robada del JWT ya no puede volver a autenticarse. **Las sesiones de otros dispositivos permanecen activas.** El logout se puede ejecutar incluso si se agotó el límite por IP de otros endpoints de autenticación.
- `GET /api/me` renueva la fecha de caducidad de la **misma sesión** cuando se activa «Keep me signed in». La sesión sin ese ajuste conserva el comportamiento anterior (cookie de sesión y JWT de un día).
- Las sesiones vencidas se purgan diariamente.
- **Impacto de la migración:** los JWT emitidos con la versión anterior carecen de `sid` y recibirán 401; los usuarios deberán iniciar sesión de nuevo **una vez** tras el despliegue. Esto es intencional y evita dejar tokens anteriores sin mecanismo de revocación.

## Archivos modificados

- `server.js`: migración automática de tablas, contador por cuenta, emisión/autorización/renovación/revocación por dispositivo y validaciones de contraseñas.
- `security.js`: validadores de contraseña, derivación HMAC de identidad, verificación UUID.
- `client/src/components/Login.jsx`: validación y textos de contraseñas nuevas.
- `client/src/components/Dashboard.jsx`: tratamiento de errores al cerrar sesión; no se confirma logout si el backend no lo confirmó.
- `tests/security.test.js`: tres pruebas unitarias nuevas (junto a las dos originales).
- `README.md`: documentación del comportamiento nuevo.

## Antes del despliegue: pruebas obligatorias en staging

1. Haz una copia de seguridad de Neon y usa un **proyecto de PostgreSQL de pruebas**, separado de producción. No ejecutes pruebas de carga con tu base de datos real.
2. Comprueba las variables `DATABASE_URL` o `DATABASE_URL_POOLED`, `JWT_SECRET`, `SITE_URL`, `NODE_ENV=production`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`. No cambies `JWT_SECRET` sin planificar el cierre global de sesiones.
3. Ejecuta `npm ci`, `npm test`, `npm ci --prefix client`, `npm run build --prefix client` y `npm audit --omit=dev` donde haya conexión al registro npm. La verificación de dependencias sigue pendiente.
4. Inicia staging. Comprueba que se crean `user_sessions` y `login_attempts` automáticamente y que no aparecen errores de permisos SQL. Si el usuario de BD no tiene permisos DDL, crea las tablas mediante una migración administrativa antes de iniciar la nueva versión.
5. **Política de contraseñas:** intenta registrar una contraseña de 14 caracteres (espera 400), una frase de 15–72 bytes (espera 201); prueba el mismo criterio con recuperación. Verifica que una cuenta existente con contraseña de seis caracteres **puede iniciar sesión**.
6. **Límite por cuenta:** en una cuenta de ensayo, realiza 10 intentos de login con contraseña incorrecta y usa tanto nombre como correo. El intento 11 debe devolver 429; con otra cuenta de ensayo el contador debe ser independiente. Espera 15 minutos o borra el registro en la BD de pruebas para validar recuperación. No hagas esto en producción.
7. **Dos dispositivos:** inicia sesión en navegador A y navegador B. Cierra sesión en A; A debe recibir 401 en `/api/me`, B debe seguir en 200. La cookie de A debe borrarse. Reinicia el servidor y verifica que el token revocado no vuelve a ser válido.
8. **Recordarme:** inicia sesión con «Keep me signed in», comprueba que las llamadas a `/api/me` renuevan `expires_at` **sin crear nuevas filas**. Sin recordarme, valida la cookie de sesión.
9. **Recuperación de contraseña:** con A y B abiertos, realiza un restablecimiento mediante el código de correo; ambos dispositivos deben responder 401 y solo el nuevo login debe funcionar.
10. **UX:** prueba el cambio de nombre de usuario, la exportación CSV y la carga del dashboard con las nuevas cookies. Verifica que los errores de logout se muestran en pantalla.
11. Revisa en Render que las IP se identifican correctamente detrás del proxy (`trust proxy`). Comprueba logs sin almacenar contraseñas, códigos ni JWT.

**Advertencia de rollback:** volver al código anterior que no valida `sid` eliminaría la protección de revocación. Si necesitas revertir, despliega una versión que siga verificando `user_sessions`, o rota `JWT_SECRET` con un plan de invalidación de todas las sesiones y códigos pendientes.

## Verificación realizada sobre este paquete

- `node --check server.js` y `node --check security.js`: correctos.
- `npm test`: **5/5 pruebas unitarias aprobadas** (validación de importes, CSRF, contraseñas nuevas, clave por cuenta, UUID v4).
- **No se ejecutó** una prueba integral con PostgreSQL/Neon ni el build real de React en este entorno, porque las dependencias no estaban instaladas. La seguridad bajo concurrencia y los flujos de sesión quedan pendientes de la validación en staging.

## Referencias

- NIST SP 800-63B-4, Password Verifiers: https://pages.nist.gov/800-63-4/sp800-63b.html
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
