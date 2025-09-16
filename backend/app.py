from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from api import router as api_router

# Configuración de la aplicación
app = FastAPI(
    title="Simulador de Glaciares API",
    description="API para la visualización y análisis de glaciares de la región de Aysén",
    version="1.0.0"
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar rutas de la API
app.include_router(api_router, prefix="/api")

# Montar archivos estáticos del frontend
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

@app.get("/health")
async def health_check():
    """Endpoint para verificar el estado de la API"""
    return {"status": "ok", "message": "API funcionando correctamente"}
