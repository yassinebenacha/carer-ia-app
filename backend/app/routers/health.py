import datetime
import logging
import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException
from app.services.embedding import EmbeddingService
from app.services.gemini import GeminiService
from app.models.schemas import HealthResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Route pour diagnostiquer l'état du service"""
    status_data = {
        "status": "ok",
        "version": "2.0.0",
        "timestamp": str(datetime.datetime.now()),
        "components": {}
    }
    
    # Vérifier si le modèle d'embedding peut être chargé
    try:
        model = EmbeddingService.get_model()
        status_data["components"]["embedding_model"] = {
            "status": "ok",
            "name": model._modules['0'].auto_model.config.name_or_path,
            "dimensions": model.get_sentence_embedding_dimension()
        }
    except Exception as e:
        status_data["components"]["embedding_model"] = {
            "status": "error",
            "message": str(e)
        }
        status_data["status"] = "degraded"
    
    # Vérifier l'accès à l'API Gemini
    try:
        test_prompt = "Réponds simplement par 'OK' à ce test de connectivité."
        response = GeminiService.query_rest_api(test_prompt)
        gemini_response = response["candidates"][0]["content"]["parts"][0]["text"].strip()
        status_data["components"]["gemini_api"] = {
            "status": "ok",
            "response_length": len(gemini_response)
        }
    except Exception as e:
        status_data
        
@router.get("/search/health")
async def search_health_check():
    """Endpoint de vérification de santé pour le module de recherche"""
    try:
        # Vérifications basiques
        services_status = {
            "serpapi_configured": bool(settings.SERPAPI_KEY),
            "gemini_configured": bool(settings.GEMINI_API_KEY),
            "max_results_limit": settings.MAX_SEARCH_RESULTS,
            "timeout_configured": settings.SEARCH_TIMEOUT
        }
        
        # Test simple de connectivité
        test_connection = True
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.get("https://httpbin.org/status/200")
        except:
            test_connection = False
        
        return {
            "status": "healthy" if all(services_status.values()) and test_connection else "degraded",
            "message": "Module de recherche éducative opérationnel",
            "services": services_status,
            "network_connectivity": test_connection,
            "timestamp": "2024-12-19T10:00:00Z"
        }
        
    except Exception as e:
        logger.error(f"Erreur health check: {e}")
        raise HTTPException(
            status_code=503, 
            detail="Erreur lors de la vérification des services de recherche"
        )