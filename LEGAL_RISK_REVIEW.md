# Revisión técnica de riesgos legales de Tesoria

Fecha: 1 de noviembre de 2026. Contexto confirmado: operación desde República Dominicana, servicio gratuito y accesible internacionalmente. Esta revisión identifica riesgos y mitigaciones técnicas; no certifica cumplimiento ni sustituye una revisión jurídica dominicana.

## Hallazgos y acciones

| Prioridad | Hallazgo | Corrección o siguiente paso |
| --- | --- | --- |
| Alta | Sin aviso sobre el tratamiento de cuentas y presupuestos ni identificación pública del responsable. | Se añadieron `/privacy` y `/terms`, en español e inglés, accesibles sin iniciar sesión. Identidad, domicilio, país, correo y descripción operativa son configuración pública obligatoria en producción. Falta completar sus valores reales. |
| Alta | Sin mecanismo de eliminación de cuenta ni descarga de datos de perfil. | Account permite descargar JSON y eliminar la cuenta con contraseña y confirmación `DELETE`. La operación transaccional elimina cuenta, códigos y contador asociado; las claves foráneas eliminan presupuestos y sesiones de todos los dispositivos. CSV sigue disponible. |
| Alta | El aviso de “12 meses” confundía movimientos, cuentas y otros registros. | Los textos distinguen el mes actual y once anteriores, cuentas verificadas, códigos y sesiones. Se explican las limitaciones respecto a correos, copias exportadas, registros y respaldos de proveedores. Sus plazos reales siguen pendientes de verificar. |
| Alta | No había evidencia de aceptación/autorización en nuevos registros. | Dos casillas separan condiciones y autorización de tratamiento. El servidor valida versión y autorización y registra sus fechas. No se guarda IP adicional para este fin. Las cuentas antiguas conservan fechas nulas; no se atribuye consentimiento retroactivo. |
| Media | Mensaje de error garantizaba que los datos estaban a salvo sin comprobarlo. | Se retiró esa garantía y se aclaró que la sesión no pudo comprobarse. Se añadió que 50/30/20 es una guía general, sin promesas de resultado ni asesoría personalizada. |
| Media | Respuestas personales podían ser almacenadas por cachés; errores de Brevo podían registrar su cuerpo completo. | `/api` usa `Cache-Control: no-store`; el error de Brevo registra el estado HTTP. Esto no sustituye una revisión de logs de infraestructura ni del registro genérico de errores. |
| Media | La licencia MIT propia no documentaba por sí sola los avisos de dependencias distribuidas. | La compilación genera `THIRD_PARTY_NOTICES.txt` con avisos de dependencias de ejecución del servidor y cliente. El pie de página enlaza el archivo. Se conserva además la licencia oficial de Victory 37.3.6 y las de sus bibliotecas incorporadas. |
| Pendiente | No hay prueba en el repositorio de disponibilidad del nombre Tesoria ni de titularidad del logo, iconos e imagen social. | Verificar antecedentes y conservar archivos fuente, contratos o licencias. No se concluye que exista infracción ni que la marca esté disponible. |
| Pendiente | Hay una copia antigua del proyecto dentro de `tesoria/`. | No se modificó ni eliminó. El servicio actual debe desplegar desde la raíz del repositorio, con `server.js` y `client/`. La copia interior no incorpora estas correcciones y podría reintroducir riesgos si se publica. |

## Marco jurídico a revisar

La [Ley dominicana 172-13](https://www.sb.gob.do/media/4i1ploou/ley17213.pdf), especialmente sus artículos 2–5, contempla tratamiento de datos, información sobre finalidad y responsable, consentimiento y seguridad. Para Tesoria corresponde revisar su aplicación concreta, las transferencias a proveedores extranjeros y cómo atender acceso, rectificación y supresión. No deben confundirse las disposiciones generales con las obligaciones específicas de sociedades de información crediticia.

[Pro Consumidor](https://proconsumidor.gob.do/proteccion-al-consumidor-desde-el-analisis-y-la-vigilancia-de-la-publicidad/) explica las exigencias de información y publicidad de la Ley 358-05, incluyendo información en español. Conviene que una revisión local confirme el alcance para este servicio gratuito.

Que una web sea accesible desde otro país no determina por sí solo todas sus obligaciones. La [Comisión Europea](https://europa.eu/youreurope/business/governance-and-sustainability/digital-and-data-compliance/data-protection-gdpr/index_en.htm) explica los supuestos de aplicación del RGPD. Antes de dirigir campañas a otros mercados, revisar alcance territorial, menores, transferencias, representación y derechos que correspondan. No se implementó geobloqueo ni se declaró cumplimiento mundial.

La [búsqueda de antecedentes de ONAPI](https://onapi.gob.do/index.php/servicios/signos-distintivos/otros-servicios/busqueda-antecedentes-2023) permite investigar signos similares. Falta una búsqueda de Tesoria, variantes como TE$ORIA, similitudes fonéticas y clases pertinentes; las búsquedas web generales no sustituyen esa revisión ni una decisión de registro.

## Información que debe completarse antes de publicar esta versión

Configurar en el entorno del servidor:

- `LEGAL_OPERATOR_NAME`: nombre legal completo de la persona o entidad responsable. “Miguel U.” en el copyright no confirma esa identidad.
- `LEGAL_OPERATOR_COUNTRY`: República Dominicana, conforme al contexto confirmado.
- `LEGAL_OPERATOR_ADDRESS`: domicilio real de contacto del responsable, seleccionado considerando su publicación en internet.
- `PRIVACY_CONTACT_EMAIL`: `anguelmiguel31@gmail.com`, confirmado por el responsable como contacto público. Configurado en `.env.example` y en el Blueprint de Render. En un servicio Render existente debe cargarse también en sus variables de entorno; este cambio local no modifica el servicio desplegado. El remitente de Brevo se configura por separado mediante `MAIL_FROM_EMAIL`.
- `PRIVACY_OPERATIONS_NOTE`: texto público con entidades proveedoras, regiones efectivas, transferencias y garantías aplicables, bases del tratamiento cuando correspondan y plazos/procedimientos reales de conservación de logs y backups. Redactarlo en español y, si procede, inglés. No incluir contraseñas ni credenciales.

Si falta esa configuración en producción, el servidor arranca con una advertencia y suspende solamente nuevos registros (HTTP 503 y aviso en el formulario). Las cuentas existentes mantienen acceso, recuperación, exportación y eliminación. `/api/legal` informa `registrationOpen`. Se comprueba presencia y formato; no puede comprobar que los datos sean ciertos ni que los contratos sean suficientes. Completar los valores reales y reiniciar el servicio para habilitar nuevos registros. Este comportamiento reemplaza el bloqueo de arranque inicial que impedía desplegar el servicio.

## Acciones operativas pendientes

1. Confirmar quién decide finalidades y medios. Si operas personalmente sin otra entidad responsable, revisar la identificación de esa persona con asesoría local.
2. Verificar en Render, Neon y Brevo las entidades contratadas, regiones, acuerdos de tratamiento, subencargados, registros y respaldos. La elección del dominio remitente no resuelve estas obligaciones.
3. Definir atención de solicitudes: recepción, comprobación proporcional de identidad, plazos aplicables, corrección segura de email y comunicación de la respuesta. El código no implementa un cambio de email automático.
4. Definir cómo se gestionan eliminaciones en respaldos y restauraciones para evitar reactivar cuentas borradas. No se promete borrado inmediato de copias ajenas a la base activa.
5. Documentar respuesta a incidentes y notificaciones según la jurisdicción; limitar accesos administrativos y revisar secretos, historial Git y logs con herramientas adecuadas. No se inspeccionaron secretos de producción ni cuentas externas.
6. Revisar tratamiento de cuentas anteriores a esta versión, cambios futuros de avisos y mecanismo de notificación. La versión nueva solo se registra al crear una cuenta; no se implementó recabado de autorización para usuarios existentes.
7. Definir si se admiten menores y cómo atenderlos. No se recogieron fechas de nacimiento ni se añadió una declaración de edad sin una decisión del responsable.
8. Conservar prueba de autoría o permiso de recursos gráficos y contribuciones. La MIT del repositorio permite usos amplios del código propio; no exime de obligaciones del servicio ni prueba titularidad de todo recurso.

## Verificación y límites

- `npm test`: pruebas de seguridad, preflight, descarga, autenticación requerida, confirmación de borrado, contraseña incorrecta, aislamiento del usuario y rollback. Las pruebas de privacidad usan un adaptador de base simulado; no prueban las cascadas reales.
- `npm run build --prefix client`: compilación del cliente. El flujo completo `npm run build` también regenera avisos de terceros, con dependencias de la raíz ya instaladas mediante `npm ci`.
- `npm run test:integration`: suite ampliada para comprobar exportación, consentimiento registrado, borrado con PostgreSQL, cascadas, CSRF y revocación de dos dispositivos. Requiere la base aislada descrita en `AUTH_STAGING_TEST_PLAN.md`; no se ejecutó al no estar configurada.
- `npm audit --omit=dev` en raíz y cliente: sin vulnerabilidades conocidas reportadas por npm en las dependencias de ejecución en esta revisión. Esto no prueba ausencia de vulnerabilidades.
- El lint completo detectó dos errores preexistentes: `react-hooks/set-state-in-effect` en `Dashboard.jsx` y `process` no definido en `vite.config.js`. Las líneas señaladas no fueron modificadas en esta revisión.
- No se desplegó la aplicación ni se modificaron cuentas, datos o configuración de producción. No se realizó una prueba de penetración, auditoría integral de accesibilidad ni búsqueda jurídica de marcas.

Fuente de la licencia complementaria de Victory: [repositorio oficial, versión 37.3.6](https://raw.githubusercontent.com/FormidableLabs/victory/v37.3.6/LICENSE.txt). El generador conserva el texto sin descargarlo durante cada compilación.
