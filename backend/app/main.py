# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.routers import health, qcm, summary, search, chatbot

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Création de l'application FastAPI
app = FastAPI(
    title="PrepGenius API",
    description="API complète pour PrepGenius : analyse de PDF, génération de QCM, résumés, recherches intelligentes et assistant chatbot",
    version="1.0.0"
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "*"  # À modifier en production pour limiter aux origines autorisées
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les différents routers
app.include_router(health.router, tags=["Health"])
app.include_router(qcm.router, prefix="/api", tags=["QCM"])
app.include_router(summary.router, prefix="/api", tags=["Summary"])
app.include_router(search.router, prefix="/api", tags=["Search"])
app.include_router(chatbot.router, prefix="/api", tags=["ChatBot"])  # Nouveau router pour le chatbot

@app.get("/", tags=["Root"])
async def root():
    """Endpoint racine avec des informations sur l'API"""
    return {
        "message": "Bienvenue sur l'API PrepGenius",
        "version": app.version,
        "description": "Plateforme gratuite dédiée à l'apprentissage et à la préparation aux examens",
        "features": [
            "📄 Générateur de Résumé de Cours",
            "🧠 QCM de Compétences",
            "🔍 Assistant de Recherche IA (CrewAI)",
            "🤖 PrepGenius Bot - Assistant virtuel intelligent"
        ],
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health",
            "qcm": "/api/generate-qcm",
            "summary": "/api/generate-summary",
            "search": "/api/search",
            "search_types": "/api/search/types",
            "chatbot": "/api/chat",
            "chat_history": "/api/chat/history/{session_id}",
            "new_session": "/api/chat/new-session"
        },
        "founders": [
            "Achraf Menach",
            "Abdellatif Chakor", 
            "Yassine Benacha"
        ]
    }

@app.get("/api/info", tags=["Info"])
async def get_platform_info():
    """Informations détaillées sur la plateforme PrepGenius"""
    return {
        "platform": "PrepGenius",
        "description": "Plateforme gratuite dédiée à l'apprentissage et à la préparation aux examens pour les étudiants",
        "tools": {
            "resume_generator": {
                "name": "📄 Générateur de Résumé de Cours",
                "description": "Importation de fichiers PDF de cours pour produire un résumé automatique, clair et téléchargeable",
                "endpoint": "/api/generate-summary"
            },
            "qcm_skills": {
                "name": "🧠 QCM de Compétences",
                "description": "Quiz personnalisés avec choix du nombre de questions et d'un mode chronométré ou non, accompagnés d'un feedback instantané",
                "endpoint": "/api/generate-qcm"
            },
            "ai_search": {
                "name": "🔍 Assistant de Recherche IA (CrewAI)",
                "description": "Outil intelligent qui utilise SerpAPI et Gemini pour rechercher, filtrer et classer les meilleurs cours, examens, QCMs et résumés disponibles en ligne",
                "endpoint": "/api/search"
            },
            "chatbot": {
                "name": "🤖 PrepGenius Bot - Assistant virtuel",
                "description": "Assistant intelligent pour vous aider à naviguer et utiliser efficacement la plateforme PrepGenius",
                "endpoint": "/api/chat"
            }
        },
        "founders": [
            "Achraf Menach",
            "Abdellatif Chakor",
            "Yassine Benacha"
        ],
        "features": [
            "Totalement gratuit",
            "Interface intuitive",
            "IA avancée",
            "Support multilingue",
            "Feedback instantané"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Démarrage du serveur PrepGenius API...")
    logger.info("📖 Documentation disponible sur: http://127.0.0.1:8000/docs")
    logger.info("🤖 PrepGenius Bot disponible sur: http://127.0.0.1:8000/api/chat")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)