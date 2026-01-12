@echo off
REM Script para iniciar el frontend en Windows

echo Iniciando Mass Test Runner Frontend...

if not exist node_modules (
    echo Instalando dependencias...
    call npm install
)

echo Iniciando servidor de desarrollo en http://localhost:5173
call npm run dev
