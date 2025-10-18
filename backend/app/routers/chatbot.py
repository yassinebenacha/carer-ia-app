# app/routers/chatbot.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from openai import AsyncOpenAI
import uuid
from datetime import datetime
import logging
import os

# Configuration du logging
logger = logging.getLogger(__name__)

# Configuration OpenAI - IMPORTANT: Utilisez des variables d'environnement en production
client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

router = APIRouter()

# Stockage en mémoire pour l'historique des conversations (utiliser une base de données en production)
conversation_history: Dict[str, List[Dict]] = {}

# Modèles Pydantic
class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: datetime

class ConversationHistory(BaseModel):
    session_id: str
    messages: List[Dict]

# System prompt pour PrepGenius Bot
SYSTEM_PROMPT = """Tu es PrepGenius Bot, l'assistant virtuel officiel de PrepGenius, une plateforme gratuite dédiée à l'apprentissage et à la préparation aux examens pour les étudiants.

PrepGenius propose trois outils basés sur l'intelligence artificielle :
📄 Générateur de Résumé de Cours : Importation de fichiers PDF de cours pour produire un résumé automatique, clair et téléchargeable.
🧠 QCM de Compétences : Quiz personnalisés avec choix du nombre de questions et d'un mode chronométré ou non, accompagnés d'un feedback instantané.
🔍 Assistant de Recherche IA (CrewAI) : Outil intelligent qui utilise SerpAPI et Gemini pour rechercher, filtrer et classer les meilleurs cours, examens, QCMs et résumés disponibles en ligne.

RÈGLES STRICTES :
1. Si la question est liée à la plateforme ou ses outils, réponds avec une explication claire et concise en français.
2. Si l'utilisateur demande de l'aide pour répondre à une question de QCM, réponds toujours : "Je ne peux pas t'aider directement pour les QCMs. Tu peux consulter la réponse et lire l'explication sur la plateforme après avoir soumis le quiz."
3. Si la question n'a aucun lien avec PrepGenius ou ses outils, réponds : "Je ne peux pas répondre à cette question, je suis uniquement un assistant pour la plateforme PrepGenius. Les fondateurs de PrepGenius sont Achraf Menach, Abdellatif Chakor et Yassine Benacha."

Les fondateurs de PrepGenius sont : Achraf Menach, Abdellatif Chakor et Yassine Benacha."""

# Few-shot examples pour améliorer les réponses
FEW_SHOT_EXAMPLES = [
    {"role": "user", "content": "Qu'est-ce que PrepGenius ?"},
    {"role": "assistant", "content": "PrepGenius est une plateforme gratuite dédiée à l'apprentissage et à la préparation aux examens pour les étudiants. Elle propose trois outils basés sur l'intelligence artificielle pour faciliter vos études."},

    {"role": "user", "content": "Quels sont les outils disponibles sur la plateforme ?"},
    {"role": "assistant", "content": "PrepGenius propose trois outils principaux : le Générateur de Résumé de Cours pour créer des résumés automatiques à partir de vos PDF, les QCM de Compétences pour tester vos connaissances avec un feedback instantané, et l'Assistant de Recherche IA qui utilise CrewAI pour trouver les meilleures ressources éducatives en ligne."},
    
    {"role": "user", "content": "Comment fonctionne le générateur de résumé ?"},
    {"role": "assistant", "content": "Le Générateur de Résumé de Cours vous permet d'importer vos fichiers PDF de cours pour produire automatiquement un résumé clair et structuré. Le résumé généré est téléchargeable et vous aide à réviser efficacement."},
    
    {"role": "user", "content": "Comment fonctionnent les QCM de compétences ?"},
    {"role": "assistant", "content": "L'outil QCM de Compétences vous permet de tester vos connaissances avec des questionnaires personnalisés. Vous pouvez choisir le nombre de questions et sélectionner le mode : QCM simple ou QCM avec timer. Vous recevez ensuite un feedback instantané sur vos performances."},
    
    {"role": "user", "content": "Aide-moi à répondre à cette question de QCM : Quelle est la capitale de la France ?"},
    {"role": "assistant", "content": "Je ne peux pas t'aider directement pour les QCMs. Tu peux consulter la réponse et lire l'explication sur la plateforme après avoir soumis le quiz."},
    
    {"role": "user", "content": "Qui sont les fondateurs de PrepGenius ?"},
    {"role": "assistant", "content": "Les fondateurs de PrepGenius sont Achraf Menach, Abdellatif Chakor et Yassine Benacha."},

    {"role": "user", "content": "Quel temps fait-il aujourd'hui ?"},
    {"role": "assistant", "content": "Je ne peux pas répondre à cette question, je suis uniquement un assistant pour la plateforme PrepGenius. Les fondateurs de PrepGenius sont Achraf Menach, Abdellatif Chakor et Yassine Benacha."}
]

def get_or_create_session_id(session_id: Optional[str] = None) -> str:
    """Génère un nouvel ID de session ou utilise celui fourni"""
    if session_id and session_id in conversation_history:
        return session_id
    new_session_id = str(uuid.uuid4())
    conversation_history[new_session_id] = []
    return new_session_id

def add_to_conversation(session_id: str, role: str, content: str):
    """Ajoute un message à l'historique de la conversation"""
    if session_id not in conversation_history:
        conversation_history[session_id] = []
    
    conversation_history[session_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })

async def get_chatbot_response(message: str, session_id: str) -> str:
    """Génère une réponse du chatbot en utilisant GPT-4"""
    try:
        # Construire les messages pour l'API OpenAI
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Ajouter les few-shot examples
        messages.extend(FEW_SHOT_EXAMPLES)
        
        # Ajouter l'historique de la conversation (limité aux 10 derniers échanges pour éviter de dépasser les limites de tokens)
        if session_id in conversation_history:
            recent_history = conversation_history[session_id][-10:]  # Garder seulement les 10 derniers
            for msg in recent_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Ajouter le message actuel de l'utilisateur
        messages.append({"role": "user", "content": message})
        
        # Appel à l'API OpenAI avec la nouvelle syntaxe
        response = await client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            max_tokens=500,
            temperature=0.3,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )
        
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        logger.error(f"Erreur lors de l'appel à OpenAI: {str(e)}")
        return "Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants."

@router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(request: ChatMessage):
    """Endpoint principal pour discuter avec PrepGenius Bot"""
    try:
        # Valider que le message n'est pas vide
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Le message ne peut pas être vide")
        
        # Obtenir ou créer un ID de session
        session_id = get_or_create_session_id(request.session_id)
        
        # Ajouter le message de l'utilisateur à l'historique
        add_to_conversation(session_id, "user", request.message)
        
        # Obtenir la réponse du chatbot
        bot_response = await get_chatbot_response(request.message, session_id)
        
        # Ajouter la réponse du bot à l'historique
        add_to_conversation(session_id, "assistant", bot_response)
        
        return ChatResponse(
            response=bot_response,
            session_id=session_id,
            timestamp=datetime.now()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur dans chat_with_bot: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/chat/history/{session_id}", response_model=ConversationHistory)
async def get_conversation_history(session_id: str):
    """Récupère l'historique d'une conversation"""
    if session_id not in conversation_history:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    return ConversationHistory(
        session_id=session_id,
        messages=conversation_history[session_id]
    )

@router.delete("/chat/history/{session_id}")
async def clear_conversation_history(session_id: str):
    """Efface l'historique d'une conversation"""
    if session_id not in conversation_history:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    del conversation_history[session_id]
    return {"message": "Historique de conversation supprimé avec succès"}

@router.get("/chat/sessions")
async def get_active_sessions():
    """Récupère la liste des sessions actives"""
    sessions = []
    for session_id, messages in conversation_history.items():
        if messages:  # Seulement les sessions avec des messages
            last_message_time = messages[-1]["timestamp"]
            sessions.append({
                "session_id": session_id,
                "message_count": len(messages),
                "last_activity": last_message_time
            })
    
    return {"active_sessions": sessions}

@router.post("/chat/new-session")
async def create_new_session():
    """Crée une nouvelle session de chat"""
    session_id = str(uuid.uuid4())
    conversation_history[session_id] = []
    return {"session_id": session_id, "message": "Nouvelle session créée avec succès"}