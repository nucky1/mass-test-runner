#!/bin/bash
# Script para iniciar el backend

echo "Iniciando Mass Test Runner Backend..."

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Verificar que existe .env
if [ ! -f ".env" ]; then
    echo "Creando archivo .env desde .env.example..."
    cp .env.example .env
    echo "Por favor, edita .env con tus credenciales de base de datos"
fi

# Ejecutar migraciones
echo "Ejecutando migraciones..."
alembic upgrade head

# Iniciar servidor
echo "Iniciando servidor en http://localhost:8000"
uvicorn app.main:app --reload --port 8000
