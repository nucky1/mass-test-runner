"""Configuración de dependencias permitidas para plugins dinámicos"""
import importlib.util
from typing import Set, List, Tuple, Optional

# Módulos builtin de Python que siempre están permitidos
BUILTIN_PACKAGES: Set[str] = {
    # Estándar común
    "csv", "json", "re", "math", "datetime", "typing", "uuid", "random",
    "collections", "itertools", "functools", "operator", "copy", "pickle",
    "base64", "hashlib", "hmac", "secrets", "string", "textwrap",
    "datetime", "time", "calendar", "locale",
    # IO y archivos
    "io", "os", "pathlib", "shutil", "tempfile", "glob", "fnmatch",
    # SQLite (viene con Python)
    "sqlite3",
    # Networking básico
    "urllib", "urllib.parse", "urllib.request", "http", "email","ftplib",
    # Utilidades
    "sys", "types", "traceback", "warnings", "logging", "argparse",
    "subprocess", "threading", "multiprocessing", "concurrent",
    # Datos
    "decimal", "fractions", "statistics", "array", "struct",
}

# Paquetes externos permitidos (deben estar instalados en el entorno)
ALLOWED_PACKAGES: Set[str] = {
    # SharePoint / Microsoft Graph
    "msal",
    "requests",
    # CSV/Excel
    "pandas",
    "openpyxl",
    "dateutil",  # python-dateutil se importa como dateutil
    # SQL ORM
    "sqlalchemy",
    # Drivers de base de datos
    "pymysql",
    "psycopg2",
    "pyodbc",
    # Utilidades (si vienen como dependencias transitivas)
    "urllib3",
    # Openai
    "openai",
    # FTP conexión
    "ftplib"
}


def get_top_level_module(module_name: str) -> str:
    """Obtiene el módulo de nivel superior de un import"""
    # Manejar imports relativos (no permitidos)
    if module_name.startswith('.'):
        return ""
    
    # Obtener el primer componente del módulo
    parts = module_name.split('.')
    return parts[0]


def is_module_available(module_name: str) -> bool:
    """Verifica si un módulo está disponible en el entorno"""
    try:
        spec = importlib.util.find_spec(module_name)
        return spec is not None
    except (ImportError, ValueError, ModuleNotFoundError):
        return False


def validate_plugin_imports(code: str) -> Tuple[bool, Optional[str]]:
    """
    Valida que todos los imports del código del plugin usen solo
    dependencias permitidas (builtin o en ALLOWED_PACKAGES).
    
    Returns:
        Tuple[bool, Optional[str]]: (es_válido, mensaje_error)
    """
    import ast
    
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Error de sintaxis en el código: {str(e)}"
    
    imports: Set[str] = set()
    
    # Recolectar todos los imports
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            # import X
            # import X as Y
            for alias in node.names:
                imports.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            # from X import Y
            # from X import Y as Z
            if node.module:
                # Ignorar imports relativos (from . import, from .. import)
                if node.level == 0:
                    imports.add(node.module)
                elif node.level > 0:
                    # Import relativo encontrado - no permitido explícitamente
                    # pero no lo bloqueamos por ahora, solo lo ignoramos
                    pass
    
    # Validar cada import
    for module_name in imports:
        top_level = get_top_level_module(module_name)
        
        if not top_level:
            continue
        
        # Verificar si es builtin
        if top_level in BUILTIN_PACKAGES:
            continue
        
        # Verificar si está en la lista permitida
        if top_level in ALLOWED_PACKAGES:
            # Verificar que el módulo realmente esté disponible
            if not is_module_available(top_level):
                return False, f"Missing dependency: {top_level}. Install it in the backend environment before importing."
            continue
        
        # Si no está en ninguna lista, no está permitido
        allowed_list = ", ".join(sorted(ALLOWED_PACKAGES))
        return False, f"Dependency not allowed: {top_level}. Allowed: {allowed_list}"
    
    return True, None

