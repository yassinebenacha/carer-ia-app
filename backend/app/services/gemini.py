import logging
import requests
import re
from typing import Dict, List, Any, Optional
from fastapi import HTTPException
import google.generativeai as genai

logger = logging.getLogger(__name__)

class GeminiService:
    # Clé API (en production, utilisez des variables d'environnement)
    API_KEY = "AIzaSyAczCyyNGdK7xsBSu2itvilLGMtn6d0QiY"
    
    # API URL et configuration d'en-têtes pour méthode HTTP directe
    API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    HEADERS = {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
    }
    
    # Configuration pour la bibliothèque officielle
    @classmethod
    def initialize_client(cls):
        """Initialise le client officiel Google Generative AI"""
        genai.configure(api_key=cls.API_KEY)
    
    @classmethod
    def query_rest_api(cls, prompt: str) -> Dict[str, Any]:
        """
        Envoie une requête à Gemini via l'API REST.
        
        Args:
            prompt: Le texte du prompt
            
        Returns:
            Dict: La réponse JSON de l'API
            
        Raises:
            HTTPException: Si une erreur survient lors de l'appel à l'API
        """
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        }
        try:
            response = requests.post(cls.API_URL, headers=cls.HEADERS, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur lors de l'appel à l'API Gemini: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de l'appel à l'API Gemini: {str(e)}")
    
    @classmethod
    async def generate_text(cls, prompt: str) -> str:
        """
        Génère du texte via le client officiel Google Generative AI.
        
        Args:
            prompt: Le texte du prompt
            
        Returns:
            str: Le texte généré
            
        Raises:
            HTTPException: Si une erreur survient lors de la génération
        """
        try:
            cls.initialize_client()
            model = genai.GenerativeModel(model_name="gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Erreur lors de la génération de texte avec Gemini: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de la génération de texte: {str(e)}")

    @classmethod
    def parse_qcm_text(cls, qcm_text: str) -> List[Dict[str, Any]]:
        """
        Transforme le texte brut généré en structure JSON de QCM.
        
        Args:
            qcm_text: Le texte QCM généré par Gemini
            
        Returns:
            List[Dict]: Questions QCM structurées
        """
        questions = []
        qcm_blocks = qcm_text.strip().split('\n\n')

        for block in qcm_blocks:
            lines = block.strip().split('\n')
            if len(lines) < 6:
                continue  # Ignorer si format incorrect

            # Nettoyer le numéro de la question
            question_text = lines[0].strip()
            question_text = re.sub(r'^\d+\.\s*', '', question_text)  # Supprimer le numéro s'il existe

            options = {
                'a': lines[1][2:].strip(),
                'b': lines[2][2:].strip(),
                'c': lines[3][2:].strip(),
                'd': lines[4][2:].strip()
            }
            
            # Extraire seulement la lettre de la réponse correcte
            correct_line = lines[5].split(":")[-1].strip().lower()
            correct = re.search(r'[abcd]', correct_line)
            correct_answer = correct.group(0) if correct else 'a'  # Défaut à 'a' en cas d'erreur

            questions.append({
                "question": question_text,
                "options": options,
                "correct_answer": correct_answer
            })

        return questions
    
    @classmethod
    def generate_explanation(cls, question: str, options: Dict[str, str], 
                           correct_answer: str, context: Optional[str] = None) -> str:
        """
        Génère une explication pour la réponse correcte en utilisant le contexte.
        
        Args:
            question: Texte de la question
            options: Options de réponse
            correct_answer: Lettre de la réponse correcte
            context: Contexte extrait du document (optionnel)
            
        Returns:
            str: Explication générée
        """
        # Retirer tout caractère non alphabétique (comme les parenthèses)
        clean_correct_answer = ''.join(c for c in correct_answer if c.isalpha()).lower()
        
        prompt = f"""
        Je suis en train d'aider un étudiant à comprendre pourquoi la réponse est correcte.
        
        Question : {question}
        Options :
        a) {options['a']}
        b) {options['b']}
        c) {options['c']}
        d) {options['d']}
        
        La réponse correcte est : {clean_correct_answer}) {options.get(clean_correct_answer, "Réponse non trouvée")}
        
        Contexte extrait du document :
        {context or "Le contexte n'est pas disponible pour cette question."}
        
        Fournir une explication claire et pédagogique de 2-3 phrases de pourquoi cette réponse est correcte, 
        en se basant sur le contexte fourni. Ne pas mentionner le "contexte extrait" dans votre réponse.
        """
        
        try:
            response = cls.query_rest_api(prompt)
            explanation = response["candidates"][0]["content"]["parts"][0]["text"].strip()
            return explanation
        except Exception as e:
            logger.error(f"Erreur lors de la génération d'explication: {e}")
            return "Pas d'explication disponible pour cette question."