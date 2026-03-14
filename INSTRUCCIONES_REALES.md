# 📥 INSTRUCCIONES REALES - Cómo Descargar y Generar APK

## ⚠️ IMPORTANTE: Proceso Real en Emergent

Emergent NO tiene botón de "Descargar ZIP" ni genera APKs automáticamente. Aquí están las opciones REALES:

---

## 🎯 OPCIÓN 1: Usar GitHub (Recomendado) ✅

### PASO 1: Conectar GitHub a Emergent

1. **En Emergent**, haz clic en tu perfil (esquina superior)
2. Busca **"Connect GitHub"**
3. Autoriza Emergent para acceder a tu GitHub
4. Confirma la conexión

### PASO 2: Guardar el Proyecto en GitHub

1. **En el chat de Emergent**, busca el botón **"Save to GitHub"** 
   - Puede estar en la parte superior o lateral de la interfaz
2. Haz clic en **"Save to GitHub"**
3. Selecciona:
   - **Crear nuevo repositorio**: "calculadora-precios"
   - O **Seleccionar repositorio existente**
4. Presiona **"PUSH TO GITHUB"**
5. Espera la confirmación (puede tardar 1-2 minutos)
6. ¡Listo! Tu código está en GitHub

### PASO 3: Descargar a Tu Computadora

Ahora que está en GitHub, puedes descargarlo:

```bash
# Opción A: Clonar con Git
git clone https://github.com/TU-USUARIO/calculadora-precios
cd calculadora-precios

# Opción B: Descargar ZIP desde GitHub
# Ve a tu repo en GitHub.com
# Click en "Code" → "Download ZIP"
# Extrae el ZIP en tu computadora
```

### PASO 4: Generar APK

```bash
# 1. Ir a la carpeta frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Instalar EAS CLI
npm install -g eas-cli

# 4. Login en Expo
eas login

# 5. Generar APK
eas build --platform android --profile preview

# Espera 10-15 minutos
# Recibirás un link para descargar el APK
```

---

## 🎯 OPCIÓN 2: Copiar Código Manualmente

Si no puedes usar GitHub:

### PASO 1: Abrir Vista de VS Code en Emergent

1. En Emergent, busca el ícono de **VS Code** o **Editor**
2. Haz clic para abrir la vista de archivos
3. Verás el árbol de carpetas del proyecto

### PASO 2: Copiar Archivos Uno por Uno

**Archivos más importantes:**

#### Backend:
```
/app/backend/server.py
/app/backend/requirements.txt
/app/backend/.env
```

#### Frontend:
```
/app/frontend/app.json
/app/frontend/package.json
/app/frontend/eas.json
/app/frontend/app/_layout.tsx
/app/frontend/app/calculator.tsx
/app/frontend/app/flows.tsx
/app/frontend/app/products.tsx
/app/frontend/app/history.tsx
/app/frontend/app/quotes.tsx
/app/frontend/app/import-export.tsx
/app/frontend/services/api.ts
/app/frontend/store/store.ts
/app/frontend/types/types.ts
```

#### Assets:
```
/app/frontend/assets/images/icon.png
/app/frontend/assets/images/splash-icon.png
```

### PASO 3: Recrear Estructura

En tu computadora, crea las carpetas y pega cada archivo:

```
calculadora-precios/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── app/
    │   ├── _layout.tsx
    │   ├── calculator.tsx
    │   ├── flows.tsx
    │   ├── products.tsx
    │   ├── history.tsx
    │   ├── quotes.tsx
    │   └── import-export.tsx
    ├── services/
    ├── store/
    ├── types/
    ├── assets/
    ├── app.json
    ├── package.json
    └── eas.json
```

### PASO 4: Generar APK

Mismo proceso que Opción 1, paso 4.

---

## 🎯 OPCIÓN 3: Solo Probar (Sin Descargar)

### Usar Expo Go AHORA MISMO

No necesitas descargar nada. Usa la app YA:

1. **Descarga Expo Go** en tu celular:
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS: https://apps.apple.com/app/expo-go/id982107779

2. **Abre en tu celular:**
   - Navega a: https://calc-movil.preview.emergentagent.com
   - Escanea el código QR que aparece
   - La app se abrirá en Expo Go

3. **Limitación:**
   - Necesitas Expo Go instalado para usar la app
   - No es una app independiente
   - Solo para testing

---

## ❓ ¿Qué Opción Elegir?

### Si Tienes GitHub → **OPCIÓN 1** ✅ (Más Fácil)
- Más rápido
- Automático
- Puedes actualizar fácilmente
- Recomendado

### Si NO Tienes GitHub → **OPCIÓN 2** ⚠️ (Más Tedioso)
- Copiar archivos manualmente
- Más propenso a errores
- Lleva más tiempo

### Si Solo Quieres Probar → **OPCIÓN 3** 🚀 (Instantáneo)
- No necesitas descargar
- Funciona YA
- Solo para testing

---

## 🛠️ Requisitos en Tu Computadora

Para generar el APK necesitas:

### 1. Node.js (Obligatorio)
- Descarga: https://nodejs.org
- Instala versión LTS (recomendada)
- Verifica: Abre terminal y escribe `node --version`

### 2. Git (Solo si usas Opción 1)
- Descarga: https://git-scm.com
- Instala con opciones por defecto
- Verifica: `git --version`

### 3. Cuenta Expo (Gratis)
- Registra: https://expo.dev/signup
- Verifica tu email
- Úsala para `eas login`

---

## 📝 Comandos Paso a Paso (Después de Descargar)

```bash
# 1. Abrir terminal en la carpeta del proyecto
cd calculadora-precios/frontend

# 2. Instalar dependencias (solo primera vez)
npm install

# 3. Instalar EAS CLI globalmente (solo primera vez)
npm install -g eas-cli

# 4. Login en Expo
eas login
# Ingresa tu email y contraseña de Expo

# 5. Generar APK para testing
eas build --platform android --profile preview

# Verás algo como:
# ✔ Build finished
# 🎉 APK ready: https://expo.dev/artifacts/...

# 6. Descarga el APK del link
# 7. Transfiere a tu celular
# 8. Instala (activa "Instalar de fuentes desconocidas")
```

---

## ⚠️ Problemas Comunes

### "No encuentro Save to GitHub en Emergent"
**Solución:**
- Verifica que conectaste tu GitHub primero
- Busca en el menú superior o lateral
- Si no aparece, usa Opción 2 (copiar manualmente)

### "Command not found: eas"
**Solución:**
```bash
# Reinstala EAS CLI
npm uninstall -g eas-cli
npm install -g eas-cli

# Reinicia la terminal
# Intenta de nuevo
eas --version
```

### "No puedo instalar el APK en mi celular"
**Solución:**
- Ve a Configuración → Seguridad
- Activa "Instalar apps de fuentes desconocidas"
- O busca "Instalar apps desconocidas" y activa para el navegador/gestor de archivos

### "Build failed en EAS"
**Solución:**
```bash
# Limpia caché y reintenta
eas build --platform android --profile preview --clear-cache
```

---

## 📞 Soporte Adicional

Si nada funciona:

1. **Expo Forums**: https://forums.expo.dev
2. **Expo Discord**: https://chat.expo.dev
3. **Documentación EAS**: https://docs.expo.dev/build/setup/

---

## ✅ Resumen Rápido

**Proceso Real:**
1. Conecta GitHub a Emergent
2. "Save to GitHub" desde Emergent
3. Clona repo en tu PC
4. `npm install` en la carpeta frontend
5. `eas build --platform android --profile preview`
6. Descarga APK e instala

**Tiempo Total:** 30-45 minutos (incluyendo espera de build)

**Costo:** TODO GRATIS (excepto si publicas en Play Store: $25)

---

**¡Ahora sí tienes las instrucciones REALES que funcionan!** 🚀
