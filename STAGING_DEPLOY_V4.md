# Tesoria — fase 4: checklist de staging en Render y Brevo

**Estado:** preparado para ejecución manual; no se ha desplegado ni atacado la aplicación pública. Las pruebas de integración locales fueron informadas como satisfactorias por el usuario, pero aquí no verificamos una ejecución de PostgreSQL.

## 1. Antes de desplegar

- Crea una rama de Git para los cambios, por ejemplo `security/staging-validation`.
- Crea un servicio Web **independiente** en Render: `tesoria-staging`, con una URL HTTPS cuyo nombre incluya `staging`.
- Utiliza una base **de pruebas independiente** de Neon llamada, por ejemplo, `tesoria_staging`. No reutilices una rama que contenga datos financieros reales. Si haces una rama desde producción, elimina/anónimiza datos personales antes de permitir el acceso al entorno.
- Configura el servicio de staging para la rama Git nueva y desactiva los despliegues automáticos en producción hasta aprobar la checklist.
- Render → Settings: build command `npm ci && npm ci --prefix client && npm run build --prefix client`; start command `npm start`; root directory: raíz del repositorio. Si el comando que ya utilizas funciona, comprueba que instala dependencias de backend y frontend; el script `npm run build` original también instala frontend.

### Variables de staging

| Variable | Valor indicado (sin secretos aquí) |
|---|---|
| `NODE_ENV` | `production` (importante para cookies `Secure` y políticas TLS) |
| `SITE_URL` | origen HTTPS **exacto** del servicio de staging, sin barra final |
| `DATABASE_URL` | URL de la **base de staging** Neon, con TLS válido |
| `DATABASE_URL_POOLED` | si se configura, **también debe apuntar a staging**; tiene prioridad sobre `DATABASE_URL` |
| `JWT_SECRET` | secreto largo y **diferente** del de producción |
| `BREVO_API_KEY` | clave autorizada para las pruebas de correo; mantenerla solo en Render |
| `MAIL_FROM_EMAIL` | correo remitente verificado en Brevo |
| `MAIL_FROM_NAME` | Tesoria (Staging), opcional |

**Advertencia:** el servidor crea tablas y ejecuta una limpieza automática al arrancar. Nunca utilices `DATABASE_URL` de producción con el servicio de staging. Tampoco reutilices cookies, claves o cuentas productivas. La variable `NODE_ENV=production` se utiliza en staging para simular correctamente la seguridad de Render.

## 2. Comprobación HTTP automatizada desde PowerShell

Desde la raíz del repositorio, con Node.js 20+:

```powershell
npm ci
npm test
npm run build
$env:TESORIA_STAGING_URL = 'https://tesoria-staging.onrender.com' # sustituye por TU dominio real
$env:TESORIA_STAGING_CONFIRM = 'I_CONFIRM_STAGING_ONLY'
npm run test:staging
```

La suite rechaza el dominio público `tesoria.onrender.com`, dominios no identificados como staging y URLs HTTP. Solo realiza consultas ligeras: inspección de cabeceras y respuestas 401/403, más un logout sin sesión.

### Opcional: comprobar dos sesiones con una cuenta ficticia de staging

Después de registrar y verificar la cuenta en staging, configura el usuario y la contraseña **solo durante esa terminal**:

```powershell
$env:TESORIA_STAGING_IDENTIFIER = Read-Host 'Usuario ficticio de staging'
$secure = Read-Host 'Contraseña de staging (oculta)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:TESORIA_STAGING_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
try { npm run test:staging }
finally { Remove-Item Env:TESORIA_STAGING_IDENTIFIER,Env:TESORIA_STAGING_PASSWORD -ErrorAction SilentlyContinue }
```

El script ejecuta dos inicios de sesión, comprueba `Secure`, `HttpOnly`, `SameSite=Lax`, revoca una sesión y verifica que la segunda permanece válida. Finalmente cierra la segunda. No registra, edita ni exporta información financiera; no imprime las credenciales ni los tokens. **Usa solo una cuenta creada para estas pruebas** y no pegues contraseñas ni tokens aquí.

## 3. Prueba de Brevo: entrega real de correo (manual)

1. Abre el servicio de staging y registra una **cuenta ficticia nueva** con una dirección de correo de prueba que controles.
2. Comprueba que el mensaje llega y que el remitente coincide con `MAIL_FROM_EMAIL`. Revisa spam y la sección de *Transactional Logs* de Brevo si no llega.
3. Usa el código recibido para verificar el correo. Intenta reutilizarlo y confirma que falla.
4. Abre «Forgot password», solicita otro código y comprueba que el enlace/código recibido es correcto. Prueba el restablecimiento y el login con la nueva contraseña.
5. Comprueba que las sesiones abiertas antes del restablecimiento quedan invalidadas. No compartas códigos ni capturas de correos que contengan datos privados.
6. Si Brevo está configurado pero el servidor responde 500, revisa los logs de Render (sin copiar claves ni códigos). `SITE_URL` debe apuntar a staging para que el logo del correo no enlace a producción.

**Nota:** las pruebas de integración anteriores insertaban códigos controlados directamente en la base y NO probaron la entrega real del correo. Estas comprobaciones manuales son necesarias.

## 4. Validación de Render: proxy, restricciones y cookies

- Abre DevTools → Network → `/api/auth/login`: comprueba `Set-Cookie` con `HttpOnly`, `Secure`, `SameSite=Lax` y que `remember=true` añade `Max-Age`.
- Abre dos perfiles de navegador, inicia sesión en ambos y cierra sesión en uno. El otro debe seguir autenticado.
- No uses intentos masivos de acceso para comprobar limitadores. La suite local ya cubre el contador por cuenta; en Render inspecciona las cabeceras `RateLimit` de una solicitud y los logs para identificar errores de proxy. `trust proxy=1` debe coincidir con el número real de saltos hacia tu app.
- Confirma HTTPS y las cabeceras CSP, HSTS y `X-Content-Type-Options`. Las prueba `npm run test:staging`.
- Prueba acceso sin sesión a `/api/summary` y `/api/export` (debe ser 401).

## 5. Dependencias, respaldo y decisión de producción

En tu equipo, con acceso a npm:

```powershell
npm audit --omit=dev
npm audit --prefix client
```

Revisa cada vulnerabilidad **alta/crítica** y actualiza de forma controlada; no uses `npm audit fix --force` a ciegas. Guarda los resultados sin subir secretos.

Antes de pasar a producción:

- [ ] Suite local de integración aprobada y compilación frontend correcta.
- [ ] Suite de staging HTTP verde (incluyendo modo autenticado).
- [ ] Brevo: registro, verificación, recuperación e invalidación de sesiones aprobados.
- [ ] Variables staging revisadas; jamás apunten a producción.
- [ ] Auditoría de dependencias revisada y hallazgos graves corregidos.
- [ ] Respaldo o punto de restauración de Neon producción confirmado **y probado en un entorno aislado**.
- [ ] Plan de rollback definido. **No reviertas a un backend que acepte JWT sin `sid`**; haría ineficaz la revocación de sesiones. En emergencias, rota el secreto JWT tras evaluar el impacto y cierra sesiones.
- [ ] Se acepta que al desplegar la nueva autenticación los usuarios con JWT anteriores deban iniciar sesión otra vez.

Después de aprobar las verificaciones, promueve el cambio desde una rama revisada. Vigila logs sin exponer información financiera. Las comprobaciones no equivalen a un pentest ni garantizan ausencia de vulnerabilidades.

## Fuentes de configuración

- Render Web Services: https://render.com/docs/web-services
- Render Environment Variables: https://render.com/docs/configure-environment-variables
- Neon database branching: https://neon.com/branching
- Brevo transactional API: https://developers.brevo.com/reference/send-transac-email
