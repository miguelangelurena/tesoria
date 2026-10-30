> **Actualización del 30/10/2026:** Los hallazgos pendientes sobre longitud mínima de contraseña, limitación por cuenta y revocación de sesión se han abordado en `AUTH_HARDENING_V2.md` (fase 2). Este documento conserva la evaluación original, no sustituye las pruebas en staging.

# Tesoria — Auditoría estática de seguridad (30 de octubre de 2026)

## Alcance y límites

Revisión del código suministrado en `tesoria.zip`: `server.js`, cliente React, configuración y estructura del repositorio. Se utilizó como marco OWASP Top 10:2025. No se realizaron ataques a la URL de producción, pruebas de penetración, pruebas contra datos reales ni revisión de secretos de Render/Neon. El servicio Brevo y la configuración efectiva de despliegue no han sido verificados. No se pudo completar `npm audit`: fallo de resolución de red (`EAI_AGAIN registry.npmjs.org`).

**Conclusión:** existen buenas medidas iniciales, pero la aplicación **no debe calificarse como invulnerable o certificada**. Las correcciones del ZIP son una propuesta para validar en un entorno de prueba antes de desplegar.

## Hallazgos (código original)

1. **ALTO — TLS hacia PostgreSQL no verifica el certificado por defecto** (`server.js`, línea 42): `rejectUnauthorized: false`. Puede facilitar la suplantación del servidor en determinados escenarios de red. **Parche:** activa verificación de certificados y rechaza opciones URL de SSL débiles en producción. La opción `sslmode=require` se interpreta según la librería: revisar la configuración real de `node-postgres`. Neon soporta `verify-full`.
2. **ALTO — JWT anteriores al restablecimiento de contraseña siguen aceptándose** (`server.js`, líneas 309-315, 334-349 y 481-496). Un token previamente sustraído podría sobrevivir al cambio de contraseña. **Parche:** columna `users.session_version`, versión incluida en JWT, comprobación por petición autenticada y aumento de versión en cada restablecimiento. Se permite la versión 0 para no cerrar sesiones antiguas *hasta que se restablezca la contraseña*.
3. **MEDIO — CSRF: `SameSite=Lax` sin comprobación adicional** (`server.js`, líneas 338-344). Aporta protección, pero debe reforzarse para solicitudes con efectos. **Parche:** comprobación de `Origin` cuando está presente y cabecera personalizada `X-Tesoria-Request: 1` obligatoria en métodos mutantes. El cliente React adjunta esta cabecera. Configurar SITE_URL correctamente en producción.
4. **MEDIO — Valores monetarios extremos o no finitos** (`server.js`, líneas 275-281 y 559-566). La conversión con `Number()` podía admitir `Infinity` y provocar errores de base de datos, respuestas 500 o degradación. **Parche:** importes finitos, positivos o cero según caso, máximo de 1,000,000,000 y hasta dos decimales; respuesta 400 ante entradas inválidas. **Límite de producto:** confirmar que este máximo se ajusta al negocio.
5. **MEDIO — Límite de intentos de código susceptible a concurrencia** (`server.js`, líneas 247-268). Un SELECT sin bloqueo seguido de UPDATE no serializa correctamente varios intentos simultáneos. **Parche:** bloqueo `SELECT ... FOR UPDATE` dentro de transacción; intentos y borrado del código atómicos respecto a solicitudes simultáneas.
6. **MEDIO / OPERACIONAL — Limitadores en memoria e IP** (`server.js`, líneas 353-370). No se comparten entre instancias ni persisten reinicios; el valor de `trust proxy = 1` debe contrastarse con la topología real en Render. **Pendiente:** almacén compartido si se escala y comprobación de IP real; añadir límites por cuenta/identificador donde proceda.
7. **MEDIO — Política de contraseñas de al menos 6 caracteres** (`server.js`, líneas 381 y 487; formulario React). Es una exigencia débil frente a contraseñas reutilizadas o triviales. **Pendiente:** exigir frases de contraseña más largas, bloquear claves conocidas/comprometidas y sincronizar la UI.
8. **BAJO / OPERACIONAL — Sesión JWT en logout** (`server.js`, líneas 465-468). Logout elimina cookie en cliente, pero un JWT copiado sigue siendo válido hasta caducidad o rotación de versión. **Pendiente:** revocación por sesión/dispositivo para logout completo, si el producto la necesita.
9. **PENDIENTE — Dependencias y despliegue**: verificar `npm audit`, versión de Node, TLS real, variables de entorno, headers de respuesta en Render, permisos del usuario SQL, backups y alertas. No puede concluirse ausencia de vulnerabilidades de dependencias.

## Controles favorables observados

- Consultas SQL parametrizadas y filtro de `user_id` en las operaciones CRUD examinadas.
- Bcrypt para hashing de contraseñas, códigos de correo generados criptográficamente, HMAC para almacenar hashes de códigos y caducidad de 10 minutos.
- `helmet` con CSP restrictiva, cookies `HttpOnly` y `Secure` en producción, JWT limitado a algoritmo HS256, rate limiting de autenticación.
- Validación de periodos (ventana de 12 meses), escape básico de CSV para valores que parezcan fórmulas.

## Correspondencia general con OWASP Top 10:2025

- A01 Broken Access Control: buen filtro `user_id`; falta prueba entre dos cuentas.
- A02 Security Misconfiguration: corregido TLS inseguro por defecto; validar Render y variables.
- A03 Software Supply Chain Failures: no verificado; `npm audit` no pudo consultar el registro.
- A04 Cryptographic Failures: hashing correcto; subsanar verificación TLS.
- A05 Injection: consultas parametrizadas; inspección de UI sin `dangerouslySetInnerHTML` en componentes revisados, pero sin pruebas de inyección.
- A06 Insecure Design: revisar flujos de cuenta no verificada y amenazas específicas.
- A07 Authentication Failures: JWT y códigos mejorados; política de contraseñas y revocación granular pendientes.
- A08 Software/Data Integrity Failures: probar transacciones de negocio y migraciones.
- A09 Security Logging and Alerting Failures: no se identificó monitoreo/alertas centralizado; revisar sin registrar secretos.
- A10 Mishandling Exceptional Conditions: errores 500 genéricos visibles al usuario, pero faltan pruebas con entrada inválida y fallos de dependencias.

## Cambios incluidos en el ZIP de endurecimiento

- `server.js`: validación de conexión TLS, versión de sesión, verificación de sesión, middleware CSRF, importes finitos, bloqueo de códigos.
- `security.js`: helpers puros para validación de importes y peticiones mutantes.
- `client/src/api.js`: cabecera `X-Tesoria-Request` en POST/PUT/DELETE.
- `tests/security.test.js`: pruebas de validación y CSRF.
- `package.json`: comando `npm test`.

## Verificaciones realizadas sobre la copia parcheada

- `node --check server.js` — CORRECTO.
- `node --check security.js` — CORRECTO.
- `node --check client/src/api.js` — CORRECTO.
- `npm test` — 2 pruebas unitarias aprobadas.
- **No** se levantó el backend contra PostgreSQL; **no** se compiló React con dependencias instaladas; **no** se realizó una prueba integral de la autenticación. No desplegar sin probar.

## Pasos para probar en staging antes de desplegar

1. Crear copia de seguridad de la base de datos en Neon y un entorno de staging independiente.
2. Confirmar `NODE_ENV=production`, `SITE_URL=https://<tu-dominio-correcto>`, JWT_SECRET robusto, URL Neon auténtica y TLS verificable; evitar opciones inseguras como `sslmode=no-verify`.
3. Instalar dependencias desde los lockfiles y ejecutar `npm test`, `npm run build` y `npm audit --omit=dev` (requiere red).
4. Iniciar staging y comprobar que `initDb()` incorpora `session_version`; primero login, luego dashboard, transacciones, historial, CSV, recuperación de contraseña y cambio de usuario.
5. Con dos cuentas de prueba diferentes, comprobar que la segunda no puede editar o borrar las transacciones de la primera; observar 404/respuesta no reveladora.
6. Comprobar que solicitudes mutantes sin `X-Tesoria-Request` devuelven 403 y que el cliente web sí funciona; un Origin distinto debe generar 403.
7. Comprobar importes inválidos (`Infinity`, negativos, extremadamente grandes, más de dos decimales): respuesta 400 sin cambios en BD.
8. Obtener dos sesiones legítimas del mismo usuario; cambiar la contraseña con código; comprobar que ambas sesiones antiguas devuelven 401 y que el nuevo login funciona.
9. Confirmar que el rate limit detrás de Render identifica correctamente a clientes distintos sin permitir falsificación de IP; probar sin cargas masivas.
10. Desplegar solo tras la validación y monitorear errores de aplicación, base de datos y autenticación.

## Fuentes

- OWASP Top 10:2025 — https://top10.owasp.org/2025/
- OWASP CSRF Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Forgot Password — https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- node-postgres TLS — https://node-postgres.com/features/ssl
- Neon Security Overview — https://neon.tech/docs/security/security-overview
