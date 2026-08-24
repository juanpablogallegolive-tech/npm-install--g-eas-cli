# CalcuP — versión corregida

## Correcciones incluidas

- La API espera hasta 90 segundos durante el arranque en frío de Render Free.
- Los errores de red, servidor y MongoDB ahora se muestran de forma comprensible.
- `/api/health` comprueba realmente la conexión con MongoDB.
- MongoDB deja de esperar 30 segundos: falla de forma clara en aproximadamente 5 segundos.
- Importación de Excel/CSV por lotes de 500 productos, en lugar de una petición por fila.
- Lectura de CSV separado por coma o punto y coma.
- Lectura de precios en formato colombiano (`1.234,56`) o internacional (`1,234.56`).
- Corrección de `HTMLResponse`, CORS y configuración de Render.
- Expo/EAS enlazado al proyecto y URL del backend incluida en todos los perfiles.
- Scripts de Windows para instalar, probar y generar el APK.

## Uso en Windows

1. Extrae el ZIP en una carpeta nueva.
2. Ejecuta `PROBAR_BACKEND.cmd`. Los dos resultados deben ser HTTP 200.
3. Ejecuta `INSTALAR_Y_PROBAR.cmd` para instalar dependencias y abrir Expo.
4. Ejecuta `GENERAR_APK.cmd` para solicitar un APK nuevo en EAS.

## Configuración obligatoria en Render

En el servicio `npm-install--g-eas-cli`, sección **Environment**:

- `MONGO_URL`: conexión completa de MongoDB Atlas, sin comillas.
- `DB_NAME`: `calculadora_precios`.
- `MONGO_TIMEOUT_MS`: `5000`.

En MongoDB Atlas:

- El clúster debe estar activo.
- El usuario debe tener permisos de lectura/escritura.
- Network Access debe permitir la conexión desde Render (por ejemplo `0.0.0.0/0`).

Nunca compartas ni subas a GitHub la contraseña o el valor completo de `MONGO_URL`.
