# app/routers/search.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import httpx
import google.generativeai as genai
import asyncio
import json
import logging
import os
from urllib.parse import urlparse

# Configuration du logging
logger = logging.getLogger(__name__)

# Configuration directe des paramètres
class AppSettings:
    def __init__(self):
        # Configuration des APIs externes
        self.SERPAPI_KEY = os.getenv("SERPAPI_KEY", "a70499c1d4c1f5a365317b1761cacdee5bc53ca6d8f4254a6bcdaa8d352dbb57")
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAczCyyNGdK7xsBSu2itvilLGMtn6d0QiY")
        
        # Configuration de recherche
        self.MAX_SEARCH_RESULTS = 20
        self.DEFAULT_SEARCH_RESULTS = 5
        self.SEARCH_TIMEOUT = 30

# Instance des paramètres
settings = AppSettings()

# Configuration Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(model_name="gemini-1.5-flash")

# Création du router
router = APIRouter()

# Modèles Pydantic
class SearchRequest(BaseModel):
    query: str
    search_type: str = "courses"
    max_results: int = 5

class SearchResult(BaseModel):
    title: str
    url: str
    description: str
    source: str
    fileType: str
    relevanceScore: Optional[float] = None
    analysis: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
    search_type: str
    total_found: int
    analysis_summary: Optional[str] = None

class SearchType(BaseModel):
    id: str
    name: str
    description: str

# Fonctions utilitaires
def build_search_query(query: str, search_type: str) -> str:
    """Construit une requête de recherche optimisée selon le type"""
    search_modifiers = {
        "courses": f"{query} cours PDF filetype:pdf OR filetype:doc OR filetype:ppt",
        "exams": f"{query} examen corrigé filetype:pdf OR sujet examen",
        "qcm": f"{query} QCM questions réponses filetype:pdf",
        "summaries": f"{query} résumé synthèse filetype:pdf OR fiche révision",
        "exercises": f"{query} exercices corrigés filetype:pdf",
        "tutorials": f"{query} tutoriel guide filetype:pdf OR formation",
        "research": f"{query} recherche académique filetype:pdf OR article",
        "books": f"{query} livre manuel filetype:pdf OR ebook"
    }
    return search_modifiers.get(search_type, f"{query} éducation ressources pédagogiques")

def detect_file_type(url: str, title: str) -> str:
    """Détecte le type de fichier basé sur l'URL et le titre"""
    url_lower = url.lower()
    title_lower = title.lower()
    
    if ".pdf" in url_lower or "pdf" in title_lower:
        return "PDF"
    elif ".doc" in url_lower or ".docx" in url_lower or "word" in title_lower:
        return "Document Word"
    elif ".ppt" in url_lower or ".pptx" in url_lower or "powerpoint" in title_lower:
        return "Présentation"
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "Vidéo YouTube"
    elif "vimeo.com" in url_lower:
        return "Vidéo Vimeo"
    elif any(ext in url_lower for ext in [".html", ".php", ".asp", ".htm"]):
        return "Page Web"
    elif ".xlsx" in url_lower or ".xls" in url_lower:
        return "Fichier Excel"
    elif ".zip" in url_lower or ".rar" in url_lower:
        return "Archive"
    else:
        return "Ressource en ligne"

def extract_domain(url: str) -> str:
    """Extrait le domaine d'une URL"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain.capitalize()
    except:
        return "Source inconnue"

def is_educational_domain(domain: str) -> bool:
    """Vérifie si le domaine est considéré comme éducatif"""
    educational_indicators = [
        ".edu", ".ac.", "univ", "college", "school", "education",
        "coursera", "edx", "khan", "mit", "stanford", "harvard",
        "openclassrooms", "udemy", "academia", "researchgate"
    ]
    domain_lower = domain.lower()
    return any(indicator in domain_lower for indicator in educational_indicators)

async def search_with_serpapi(query: str, search_type: str, max_results: int = 10) -> List[Dict]:
    """Effectue une recherche avec SerpAPI"""
    search_query = build_search_query(query, search_type)
    
    params = {
        "engine": "google",
        "q": search_query,
        "api_key": settings.SERPAPI_KEY,
        "num": min(max_results * 2, 20),  # Chercher plus pour filtrer ensuite
        "hl": "fr",
        "gl": "fr",
        "safe": "active"
    }
    
    async with httpx.AsyncClient(timeout=settings.SEARCH_TIMEOUT) as client:
        try:
            response = await client.get("https://serpapi.com/search", params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            organic_results = data.get("organic_results", [])
            
            for i, result in enumerate(organic_results):
                url = result.get("link", "")
                title = result.get("title", "")
                snippet = result.get("snippet", "")
                
                # Filtrer les résultats non pertinents
                if not url or not title:
                    continue
                
                file_type = detect_file_type(url, title)
                domain = extract_domain(url)
                
                # Calculer un score de pertinence basique
                basic_score = 0.5
                if is_educational_domain(domain):
                    basic_score += 0.2
                if any(keyword in title.lower() for keyword in query.lower().split()):
                    basic_score += 0.2
                if file_type == "PDF":
                    basic_score += 0.1
                
                results.append({
                    "title": title,
                    "url": url,
                    "snippet": snippet[:300] + "..." if len(snippet) > 300 else snippet,
                    "source": domain,
                    "file_type": file_type,
                    "position": i + 1,
                    "basic_score": min(basic_score, 1.0)
                })
                
                if len(results) >= max_results:
                    break
            
            # Trier par score de pertinence basique
            results.sort(key=lambda x: x["basic_score"], reverse=True)
            return results
            
        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP SerpAPI: {e}")
            return []
        except Exception as e:
            logger.error(f"Erreur SerpAPI: {e}")
            return []

async def analyze_results_with_gemini(results: List[Dict], query: str, search_type: str) -> Dict[str, Any]:
    """Analyse les résultats de recherche avec Gemini pour améliorer la pertinence"""
    
    if not results:
        return {"analyzed_results": [], "summary": "Aucun résultat trouvé."}
    
    # Limiter le nombre de résultats à analyser pour éviter les timeouts
    results_to_analyze = results[:10]
    
    results_text = ""
    for i, result in enumerate(results_to_analyze, 1):
        results_text += f"""
Résultat {i}:
Titre: {result['title']}
URL: {result['url']}
Description: {result['snippet']}
Type: {result['file_type']}
Source: {result['source']}
Score initial: {result.get('basic_score', 0.5)}
---"""
    
    search_type_descriptions = {
        "courses": "cours et supports pédagogiques",
        "exams": "examens et sujets d'évaluation",
        "qcm": "questionnaires à choix multiples",
        "summaries": "résumés et fiches de révision",
        "exercises": "exercices et problèmes corrigés",
        "tutorials": "tutoriels et guides pratiques",
        "research": "articles et publications de recherche",
        "books": "livres et manuels"
    }
    
    search_description = search_type_descriptions.get(search_type, "ressources éducatives")
    
    prompt = f"""
Vous êtes un assistant éducatif expert spécialisé dans l'évaluation de ressources pédagogiques.

Analysez ces résultats de recherche pour la requête "{query}" concernant "{search_description}".

Résultats à analyser:
{results_text}

TÂCHES SPÉCIFIQUES:
1. Évaluez la pertinence de chaque résultat (score de 0.0 à 1.0) en considérant:
   - La correspondance avec la requête "{query}"
   - La qualité éducative probable
   - La fiabilité de la source
   - L'adéquation au type de recherche "{search_type}"

2. Améliorez les descriptions pour les rendre plus informatives et utiles

3. Fournissez une analyse courte expliquant pourquoi chaque ressource pourrait être utile

4. Rédigez un résumé général des ressources trouvées

IMPORTANT: Répondez UNIQUEMENT en JSON valide avec cette structure exacte:
{{
    "analyzed_results": [
        {{
            "title": "titre (amélioré si nécessaire)",
            "description": "description claire et informative",
            "relevance_score": 0.85,
            "analysis": "explication courte de l'utilité de cette ressource",
            "original_index": 0
        }}
    ],
    "summary": "résumé général des ressources disponibles"
}}
"""
    
    try:
        response = await asyncio.to_thread(
            model.generate_content, 
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=2000
            )
        )
        
        response_text = response.text.strip()
        
        # Nettoyage de la réponse
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        analysis = json.loads(response_text)
        
        # Validation de la structure
        if not isinstance(analysis.get("analyzed_results"), list):
            raise ValueError("Structure de réponse invalide")
        
        return analysis
        
    except json.JSONDecodeError as e:
        logger.error(f"Erreur JSON Gemini: {e}")
        # Fallback avec analyse basique
        return create_fallback_analysis(results_to_analyze, query)
    except Exception as e:
        logger.error(f"Erreur analyse Gemini: {e}")
        return create_fallback_analysis(results_to_analyze, query)

def create_fallback_analysis(results: List[Dict], query: str) -> Dict[str, Any]:
    """Crée une analyse de secours si Gemini échoue"""
    analyzed_results = []
    
    for i, result in enumerate(results):
        # Amélioration basique de la description
        description = result["snippet"]
        if len(description) < 50:
            description = f"Ressource {result['file_type'].lower()} disponible sur {result['source']} traitant de: {query}"
        
        analyzed_results.append({
            "title": result["title"],
            "description": description,
            "relevance_score": result.get("basic_score", 0.7),
            "analysis": f"Ressource {result['file_type'].lower()} de {result['source']} potentiellement utile pour votre recherche.",
            "original_index": i
        })
    
    return {
        "analyzed_results": analyzed_results,
        "summary": f"Trouvé {len(results)} ressources pour '{query}'. Analyse automatique utilisée."
    }

# Endpoints
@router.post("/search", response_model=SearchResponse)
async def search_resources(request: SearchRequest):
    """Endpoint principal pour effectuer une recherche intelligente de ressources éducatives"""
    
    try:
        # Validation des entrées
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="La requête ne peut pas être vide")
        
        if len(request.query) > 200:
            raise HTTPException(status_code=400, detail="La requête est trop longue (max 200 caractères)")
        
        if request.max_results > settings.MAX_SEARCH_RESULTS:
            request.max_results = settings.MAX_SEARCH_RESULTS
        
        if request.max_results < 1:
            request.max_results = settings.DEFAULT_SEARCH_RESULTS
        
        # Étape 1: Recherche avec SerpAPI
        logger.info(f"🔍 Recherche: '{request.query}' - Type: {request.search_type} - Max: {request.max_results}")
        
        raw_results = await search_with_serpapi(
            request.query, 
            request.search_type, 
            request.max_results * 2  # Chercher plus pour avoir du choix
        )
        
        if not raw_results:
            return SearchResponse(
                results=[],
                query=request.query,
                search_type=request.search_type,
                total_found=0,
                analysis_summary="Aucun résultat trouvé pour cette recherche. Essayez avec des mots-clés différents."
            )
        
        # Étape 2: Analyse avec Gemini
        logger.info(f"🤖 Analyse de {len(raw_results)} résultats avec Gemini...")
        
        analysis = await analyze_results_with_gemini(raw_results, request.query, request.search_type)
        
        # Étape 3: Construire les résultats finaux
        final_results = []
        analyzed_results = analysis.get("analyzed_results", [])
        
        # Trier par score de pertinence
        analyzed_results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        
        for analyzed in analyzed_results[:request.max_results]:
            original_index = analyzed.get("original_index", 0)
            if original_index < len(raw_results):
                original = raw_results[original_index]
                
                final_results.append(SearchResult(
                    title=analyzed.get("title", original["title"]),
                    url=original["url"],
                    description=analyzed.get("description", original["snippet"]),
                    source=original["source"],
                    fileType=original["file_type"],
                    relevanceScore=round(analyzed.get("relevance_score", 0.7), 2),
                    analysis=analyzed.get("analysis", "")
                ))
        
        logger.info(f"✅ Retour de {len(final_results)} résultats analysés")
        
        return SearchResponse(
            results=final_results,
            query=request.query,
            search_type=request.search_type,
            total_found=len(raw_results),
            analysis_summary=analysis.get("summary", f"Analyse de {len(final_results)} ressources pertinentes.")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur dans search_resources: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Une erreur s'est produite lors de la recherche. Veuillez réessayer."
        )

@router.get("/search/types", response_model=List[SearchType])
async def get_search_types():
    """Retourne les types de recherche disponibles"""
    return [
        SearchType(
            id="courses", 
            name="Cours", 
            description="Recherche de cours complets et supports pédagogiques"
        ),
        SearchType(
            id="exams", 
            name="Examens", 
            description="Recherche d'examens, sujets d'évaluation et corrections"
        ),
        SearchType(
            id="qcm", 
            name="QCMs", 
            description="Recherche de questionnaires à choix multiples avec réponses"
        ),
        SearchType(
            id="summaries", 
            name="Résumés", 
            description="Recherche de résumés, synthèses et fiches de révision"
        ),
        SearchType(
            id="exercises", 
            name="Exercices", 
            description="Recherche d'exercices pratiques et problèmes corrigés"
        ),
        SearchType(
            id="tutorials", 
            name="Tutoriels", 
            description="Recherche de tutoriels détaillés et guides pratiques"
        ),
        SearchType(
            id="research", 
            name="Recherche", 
            description="Recherche d'articles académiques et publications scientifiques"
        ),
        SearchType(
            id="books", 
            name="Livres", 
            description="Recherche de livres, manuels et ouvrages de référence"
        )
    ]

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