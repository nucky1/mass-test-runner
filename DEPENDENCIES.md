# Manejo de errores por dependencias no permitidas en Plugins Dinámicos

Este documento explica **cómo diagnosticar y corregir errores de carga de plugins dinámicos**
relacionados con dependencias no permitidas por el sandbox de imports.

---

## ❌ Error típico

Al crear o actualizar un plugin dinámico puede aparecer el siguiente error:

```text
Error al cargar plugin 'tradein_v1':
Dependency not allowed: ftplib.
Allowed: dateutil, msal, openpyxl, pandas, psycopg2, pymysql, pyodbc, requests, sqlalchemy, urllib3
````

Este error **no es de Python**, sino del **validador de imports del sistema**.

---

## 🧠 Causa raíz

El sistema valida el código del plugin **antes de ejecutarlo** usando un análisis AST
para asegurar que solo se importen dependencias explícitamente permitidas.

La validación ocurre en el archivo:

```text
app/core/plugin_dependencies.py
```

(El nombre puede variar, pero contiene `BUILTIN_PACKAGES` y `ALLOWED_PACKAGES`).

---

## 🧩 Cómo funciona el sandbox de dependencias

El sistema divide las dependencias en dos grupos:

### 1️⃣ `BUILTIN_PACKAGES`

Módulos que vienen con Python (standard library) y están explícitamente permitidos.

Ejemplos:

* `os`
* `json`
* `time`
* `glob`
* `ftplib` ❌ (NO viene permitido por defecto)

⚠️ Aunque un módulo sea builtin, **si no está en esta lista, queda bloqueado**.

---

### 2️⃣ `ALLOWED_PACKAGES`

Paquetes externos instalables con `pip`.

Ejemplos:

* `requests`
* `pyodbc`
* `sqlalchemy`
* `openai` ❌ (NO viene permitido por defecto)

Estos paquetes:

* deben estar en la allowlist
* y además deben estar **instalados en el entorno real del backend**

---

## ✅ Cómo permitir una nueva dependencia

### Paso 1: Identificar el módulo bloqueado

El error siempre indica el módulo exacto, por ejemplo:

```text
Dependency not allowed: ftplib
```

o

```text
Dependency not allowed: openai
```

---

### Paso 2: Editar la allowlist correspondiente

Abrir el archivo de validación de dependencias y agregar el módulo según corresponda.

#### ➕ Permitir un módulo builtin (ej: `ftplib`)

Agregarlo a `BUILTIN_PACKAGES`:

```python
BUILTIN_PACKAGES: Set[str] = {
    ...
    "ftplib",
}
```

> `ftplib` es parte de la standard library, **no requiere instalación**.

---

#### ➕ Permitir un paquete externo (ej: `openai`)

Agregarlo a `ALLOWED_PACKAGES`:

```python
ALLOWED_PACKAGES: Set[str] = {
    ...
    "openai",
}
```

---

### Paso 3: Instalar la dependencia en el entorno del backend

Para paquetes externos (NO builtin), además hay que instalarlos:

#### Backend con venv

```bash
pip install openai
```

#### Backend con Docker

1. Agregar al `requirements.txt`:

   ```text
   openai
   ```
2. Rebuild de la imagen:

   ```bash
   docker build .
   ```

Si el paquete no está instalado, el sistema devolverá:

```text
Missing dependency: openai. Install it in the backend environment before importing.
```

---

### Paso 4: Reiniciar el backend

Los cambios en:

* la allowlist
* o las dependencias instaladas

**requieren reiniciar el backend / worker** para que tengan efecto.

---

## ✅ Verificación final

Luego de los pasos anteriores:

1. Volver a crear o actualizar el plugin desde `/api/plugins`
2. El plugin debería:

   * cargar correctamente
   * pasar el test automático
   * quedar en estado `active`

---

## ⚠️ Consideraciones de seguridad

Permitir más dependencias **aumenta la superficie de riesgo**, especialmente en plugins dinámicos que usan `exec()`.

Recomendaciones:

* Evitar permitir módulos como:

  * `subprocess`
  * `socket`
  * `importlib`
* Limitar la allowlist a lo estrictamente necesario
* En producción, revisar manualmente los plugins antes de habilitarlos

---

## 🧭 Regla rápida para decidir

| Necesidad del plugin                   | Acción recomendada                   |
| -------------------------------------- | ------------------------------------ |
| Usa SDKs complejos (OpenAI, FTP, etc.) | Permitir dependencias explícitamente |
| Debe editarse desde UI                 | Plugin dinámico                      |
| Requiere máxima seguridad              | Reducir allowlist o usar built-in    |

---

## 📌 Resumen

* El error **Dependency not allowed** es normal y esperado
* Se soluciona **ampliando la allowlist correcta**
* Para paquetes externos, también hay que instalarlos
* No es necesario modificar el código del plugin

---

## 📞 Soporte

Si el error persiste:

* verificar el nombre exacto del módulo importado
* revisar si es builtin o externo
* confirmar que el backend fue reiniciado

```
 