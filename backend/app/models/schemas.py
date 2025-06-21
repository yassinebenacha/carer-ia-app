from pydantic import BaseModel
from typing import Dict, List, Optional, Any

class HealthResponse(BaseModel):
    """Réponse de l'endpoint de santé"""
    status: str
    version: str
    timestamp: str
    components: Dict[str, Any]

class QuestionOption(BaseModel):
    """Options de réponse pour une question QCM"""
    a: str
    b: str
    c: str
    d: str

class QCMQuestion(BaseModel):
    """Modèle pour une question de QCM"""
    question: str
    options: QuestionOption
    correct_answer: str
    explanation: Optional[str] = None
    source_text: Optional[str] = None

class QCMResponse(BaseModel):
    """Réponse contenant un QCM généré"""
    qcm: List[QCMQuestion]

class TextChunk(BaseModel):
    """Représentation d'un morceau de texte extrait d'un PDF avec métadonnées"""
    text: str
    page: int
    embedding: Optional[List[float]] = None

class SummaryResponse(BaseModel):
    """Réponse contenant un résumé de document"""
    summary: str