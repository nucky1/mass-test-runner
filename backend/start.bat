@echo off
REM Script para iniciar el backend en Windows

echo Iniciando Mass Test Runner Backend...

REM Activar entorno virtual si existe
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Verificar que existe .env
if not exist .env (
    echo Creando archivo .env desde .env.example...
    copy .env.example .env
    echo Por favor, edita .env con tus credenciales de base de datos
)

REM Ejecutar migraciones
echo Ejecutando migraciones...
alembic upgrade head

REM Iniciar servidor
echo Iniciando servidor en http://localhost:8000
uvicorn app.main:app --reload --port 8000
