"""Aplicación principal FastAPI"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.plugin_routes import router as plugin_router
from app.db.session import init_db

app = FastAPI(
    title="Mass Test Runner API",
    description="API para ejecutar tests masivos con plugins",
    version="1.0.0"
)

# CORS para permitir requests del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:3000"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(plugin_router)


@app.on_event("startup")
def startup_event():
    """Inicializa la base de datos al arrancar"""
    init_db()


@app.get("/")
def root():
    return {"message": "Mass Test Runner API", "version": "1.0.0"}
