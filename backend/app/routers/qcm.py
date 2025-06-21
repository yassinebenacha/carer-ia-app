import logging
import traceback
import re
import numpy as np
import uuid
import random
from sklearn.metrics.pairwise import cosine_similarity
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any

from app.services.pdf_extractor import PDFExtractor
from app.services.embedding import EmbeddingService
from app.services.qdrant_service import QdrantService
from app.services.gemini import GeminiService
from app.utils.helpers import truncate_text, save_upload_file_temp, cleanup_temp_file
from app.models.schemas import QCMResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/generate-qcm", response_model=QCMResponse)
async def generate_qcm(background_tasks: BackgroundTasks, 
                      file: UploadFile = File(...), 
                      num_questions: int = Form(5)):
    """
    Génère un QCM à partir d'un fichier PDF en utilisant RAG avec Qdrant
    
    Args:
        background_tasks: Tâches d'arrière-plan FastAPI
        file: Fichier PDF téléchargé
        num_questions: Nombre de questions à générer (défaut: 5)
        
    Returns:
        QCMResponse: Liste des questions QCM générées
        
    Raises:
        HTTPException: Si une erreur survient pendant le processus
    """
    tmp_path = None
    document_id = str(uuid.uuid4())  # ID unique pour ce document
    
    try:
        # Vérifier le format de fichier
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")
            
        # Lire le contenu du fichier
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Le fichier PDF est vide")
            
        # Sauvegarder temporairement le PDF
        tmp_path, tmp_abs_path = save_upload_file_temp(content)
        background_tasks.add_task(cleanup_temp_file, tmp_path)
        
        logger.info(f"Traitement du fichier PDF: {file.filename} (ID: {document_id})")

        # Extraire texte du PDF avec chunks
        pdf_text, chunks = PDFExtractor.extract_text_with_chunks(content)
        if not pdf_text or len(pdf_text) < 100:
            raise HTTPException(status_code=400, detail="Le PDF ne contient pas assez de texte pour générer un QCM")
            
        logger.info(f"Extraction de {len(chunks)} chunks de texte depuis le PDF")

        # Calculer les embeddings et stocker dans Qdrant
        if len(chunks) > 0:
            chunks_with_embeddings = EmbeddingService.compute_embeddings(
                chunks, 
                store_in_qdrant=True, 
                document_id=document_id
            )
            logger.info(f"Calcul des embeddings et stockage dans Qdrant pour {len(chunks_with_embeddings)} chunks")
        else:
            chunks_with_embeddings = []
            logger.warning("Aucun chunk de texte extrait pour les embeddings")
            
        # Générer le QCM avec contexte RAG utilisant Qdrant
        qcm_json = generate_qcm_with_rag_qdrant(pdf_text, document_id, num_questions)
        
        # Nettoyer Qdrant après génération (optionnel)
        # background_tasks.add_task(cleanup_qdrant_document, document_id)
        
        return {"qcm": qcm_json}
    
    except Exception as e:
        logger.error(f"Erreur lors de la génération du QCM avec RAG: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Nettoyer Qdrant en cas d'erreur
        try:
            QdrantService.delete_document_chunks(document_id)
        except:
            pass
            
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération du QCM: {str(e)}")


def shuffle_options(options: Dict[str, str], correct_answer: str) -> tuple[Dict[str, str], str]:
    """
    Mélange les options d'une question QCM pour éviter le biais de position
    
    Args:
        options: Dictionnaire des options {a: "option1", b: "option2", ...}
        correct_answer: Lettre de la réponse correcte actuelle
        
    Returns:
        tuple: (nouvelles_options, nouvelle_lettre_correcte)
    """
    try:
        # Créer une liste des valeurs des options
        option_values = list(options.values())
        
        # Identifier quelle option était correcte
        correct_option_text = options[correct_answer]
        
        # Mélanger les options
        random.shuffle(option_values)
        
        # Recréer le dictionnaire avec les nouvelles positions
        new_options = {}
        new_correct_answer = 'a'  # par défaut
        letters = ['a', 'b', 'c', 'd']
        
        for i, option_text in enumerate(option_values):
            letter = letters[i]
            new_options[letter] = option_text
            
            # Trouver la nouvelle position de l'option correcte
            if option_text == correct_option_text:
                new_correct_answer = letter
        
        return new_options, new_correct_answer
        
    except Exception as e:
        logger.error(f"Erreur lors du mélange des options: {str(e)}")
        # En cas d'erreur, retourner les options originales
        return options, correct_answer


def generate_qcm_with_rag_qdrant(pdf_text: str, document_id: str, num_questions: int) -> List[Dict[str, Any]]:
    """
    Génère un QCM en utilisant RAG avec Qdrant pour chaque question
    
    Args:
        pdf_text: Texte complet du PDF
        document_id: ID du document dans Qdrant
        num_questions: Nombre de questions à générer
        
    Returns:
        List[Dict]: Liste des questions QCM générées
    """
    try:
        # **APPROCHE RAG AVEC QDRANT**
        
        # 1. Générer des concepts/thèmes à partir du texte
        concept_prompt = f"""
        Analyse le texte suivant et identifie {num_questions} concepts importants ou thèmes principaux 
        qui pourraient faire l'objet de questions QCM pertinentes.
        
        Réponds UNIQUEMENT avec une liste numérotée, un concept par ligne :
        1. [Premier concept]
        2. [Deuxième concept]
        3. [Troisième concept]
        
        Texte à analyser:
        {truncate_text(pdf_text, 2000)}
        """
        
        concept_response = GeminiService.query_rest_api(concept_prompt)
        concepts_text = concept_response["candidates"][0]["content"]["parts"][0]["text"]
        
        # Extraire les concepts de manière plus robuste
        concepts = extract_concepts_from_text(concepts_text, num_questions)
        logger.info(f"Concepts identifiés: {concepts}")
        
        if not concepts:
            logger.warning("Aucun concept extrait. Retour à la méthode traditionnelle.")
            return generate_traditional_qcm(pdf_text, num_questions)
        
        # 2. Générer une question pour chaque concept en utilisant Qdrant
        qcm_questions = []
        
        # MODIFICATION: S'assurer qu'on a assez de concepts
        concepts_to_use = concepts[:num_questions] if len(concepts) >= num_questions else concepts
        
        # Si on n'a pas assez de concepts, en générer plus
        if len(concepts_to_use) < num_questions:
            logger.info(f"Pas assez de concepts ({len(concepts_to_use)}), génération de concepts supplémentaires")
            additional_concepts = generate_additional_concepts(pdf_text, num_questions - len(concepts_to_use))
            concepts_to_use.extend(additional_concepts)
        
        for i, concept in enumerate(concepts_to_use):
            if len(qcm_questions) >= num_questions:
                break
                
            logger.info(f"Génération de question pour le concept {i+1}/{len(concepts_to_use)}: {concept}")
            
            try:
                # Trouver les chunks pertinents pour ce concept via Qdrant
                relevant_chunks = find_context_for_concept_qdrant(concept, document_id, top_k=3)
                
                if relevant_chunks:
                    # Utiliser le contexte des chunks pertinents
                    context_text = "\n".join([chunk["text"] for chunk in relevant_chunks])
                    source_pages = list(set([str(chunk.get("page", "?")) for chunk in relevant_chunks]))
                    source_info = f"Page(s): {', '.join(source_pages)}"
                else:
                    # Fallback sur un extrait du texte principal
                    context_text = truncate_text(pdf_text, 1500)
                    source_info = "Basé sur le contenu global du document"
                
                # Générer la question avec contexte
                question_data = generate_single_question(concept, context_text, source_info)
                
                if question_data:
                    qcm_questions.append(question_data)
                else:
                    logger.warning(f"Échec de génération pour le concept: {concept}")
                    
            except Exception as e:
                logger.error(f"Erreur lors de la génération de la question pour '{concept}': {str(e)}")
                continue
        
        # 3. Compléter avec des questions traditionnelles si nécessaire
        if len(qcm_questions) < num_questions:
            remaining = num_questions - len(qcm_questions)
            logger.info(f"Génération de {remaining} questions supplémentaires avec la méthode traditionnelle")
            
            traditional_questions = generate_traditional_qcm(pdf_text, remaining)
            qcm_questions.extend(traditional_questions[:remaining])
        
        # MODIFICATION: Vérifier qu'on a exactement le bon nombre
        final_questions = qcm_questions[:num_questions]
        logger.info(f"Questions générées: {len(final_questions)}/{num_questions}")
        
        return final_questions
    
    except Exception as e:
        logger.error(f"Erreur dans generate_qcm_with_rag_qdrant: {str(e)}")
        logger.error(traceback.format_exc())
        # Fallback à la méthode classique en cas d'erreur
        return generate_traditional_qcm(pdf_text, num_questions)


def generate_additional_concepts(pdf_text: str, num_needed: int) -> List[str]:
    """
    Génère des concepts supplémentaires si nécessaire
    """
    try:
        additional_prompt = f"""
        À partir du texte suivant, identifie {num_needed} concepts ou thèmes DIFFÉRENTS 
        qui n'ont pas encore été mentionnés et qui pourraient faire l'objet de questions QCM.
        
        Réponds UNIQUEMENT avec une liste numérotée:
        1. [Concept 1]
        2. [Concept 2]
        
        Texte:
        {truncate_text(pdf_text, 2000)}
        """
        
        response = GeminiService.query_rest_api(additional_prompt)
        concepts_text = response["candidates"][0]["content"]["parts"][0]["text"]
        
        return extract_concepts_from_text(concepts_text, num_needed)
        
    except Exception as e:
        logger.error(f"Erreur lors de la génération de concepts supplémentaires: {str(e)}")
        return []

def find_context_for_concept_qdrant(concept: str, document_id: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Trouve les chunks les plus pertinents pour un concept donné via Qdrant
    
    Args:
        concept: Le concept à rechercher
        document_id: ID du document dans Qdrant
        top_k: Nombre de chunks à retourner
        
    Returns:
        List[Dict]: Liste des chunks pertinents
    """
    try:
        # Utiliser le service d'embedding pour rechercher dans Qdrant
        similar_chunks = EmbeddingService.search_similar_content(
            query=concept,
            top_k=top_k,
            document_id=document_id
        )
        
        logger.info(f"Trouvé {len(similar_chunks)} chunks pertinents pour le concept '{concept}'")
        return similar_chunks
        
    except Exception as e:
        logger.error(f"Erreur lors de la recherche de contexte pour '{concept}': {str(e)}")
        return []


def extract_concepts_from_text(concepts_text: str, max_concepts: int) -> List[str]:
    """
    Extrait les concepts d'un texte généré par l'IA
    """
    concepts = []
    lines = concepts_text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Chercher des patterns comme "1.", "1)", "- ", etc.
        concept_match = re.match(r'^(?:\d+[\.\)]\s*|[-•]\s*)(.*)', line)
        if concept_match:
            concept = concept_match.group(1).strip()
            if concept and len(concept) > 5:  # Éviter les concepts trop courts
                concepts.append(concept)
        elif line and not any(char.isdigit() for char in line[:5]):
            # Si pas de numérotation mais contenu valide
            concepts.append(line.strip())
    
    return concepts[:max_concepts]


def generate_single_question(concept: str, context: str, source_info: str) -> Dict[str, Any]:
    """
    Génère une seule question QCM pour un concept donné avec mélange des options
    """
    try:
        # NOUVEAU: Prompt amélioré pour éviter le biais
        question_prompt = f"""
        Génère UNE SEULE question QCM pertinente sur le concept suivant: "{concept}"
        
        Utilise ce contexte extrait du document:
        {truncate_text(context, 1500)}
        
        IMPORTANT: La bonne réponse ne doit PAS toujours être l'option C. Varie la position de la bonne réponse.
        
        Format EXACT de réponse attendu:
        Question: [Ta question ici]
        a) [Option A]
        b) [Option B]
        c) [Option C]
        d) [Option D]
        Correcte: [lettre de la bonne réponse - peut être a, b, c, ou d]
        Explication: [Explication de 1-2 phrases]
        
        RESPECTE exactement ce format et assure-toi que la bonne réponse est distribuée aléatoirement.
        """
        
        response = GeminiService.query_rest_api(question_prompt)
        generated_text = response["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        question_data = parse_single_question(generated_text, context, source_info)
        
        # NOUVEAU: Mélanger les options après parsing
        if question_data and question_data.get("options") and question_data.get("correct_answer"):
            shuffled_options, new_correct = shuffle_options(
                question_data["options"], 
                question_data["correct_answer"]
            )
            question_data["options"] = shuffled_options
            question_data["correct_answer"] = new_correct
            
            logger.info(f"Question générée - Réponse correcte: {new_correct}")
        
        return question_data
        
    except Exception as e:
        logger.error(f"Erreur lors de la génération de question pour '{concept}': {str(e)}")
        return None


def parse_single_question(generated_text: str, context: str, source_info: str) -> Dict[str, Any]:
    """
    Parse le texte généré pour extraire une question QCM
    """
    try:
        lines = [line.strip() for line in generated_text.split('\n') if line.strip()]
        
        question_dict = {}
        options = {}
        
        for line in lines:
            line_lower = line.lower()
            
            # Chercher la question
            if line_lower.startswith('question:'):
                question_dict["question"] = line.split(':', 1)[1].strip()
            
            # Chercher les options
            elif re.match(r'^[abcd]\)', line_lower):
                key = line[0].lower()
                value = line[2:].strip()
                options[key] = value
            
            # Chercher la réponse correcte
            elif 'correcte:' in line_lower or 'correct:' in line_lower:
                correct_match = re.search(r'[abcd]', line_lower)
                if correct_match:
                    question_dict["correct_answer"] = correct_match.group(0)
            
            # Chercher l'explication
            elif 'explication:' in line_lower:
                explanation = line.split(':', 1)[1].strip()
                question_dict["explanation"] = explanation
        
        # Validation et complétion
        if not question_dict.get("question"):
            return None
            
        if len(options) != 4:
            return None
            
        if not question_dict.get("correct_answer"):
            # NOUVEAU: Choisir une réponse aléatoire au lieu de toujours 'a'
            question_dict["correct_answer"] = random.choice(['a', 'b', 'c', 'd'])
            
        if not question_dict.get("explanation"):
            question_dict["explanation"] = "Cette réponse est correcte selon l'analyse du document."
        
        question_dict["options"] = options
        question_dict["source_text"] = f"{source_info}\n{truncate_text(context, 200)}"
        
        return question_dict
        
    except Exception as e:
        logger.error(f"Erreur lors du parsing de la question: {str(e)}")
        return None


def generate_traditional_qcm(pdf_text: str, num_questions: int) -> List[Dict[str, Any]]:
    """
    Génère un QCM de manière traditionnelle (fallback) avec mélange des options
    """
    try:
        text_for_qcm = truncate_text(pdf_text, 3500)
        
        # NOUVEAU: Prompt amélioré pour éviter le biais
        prompt = f"""
        À partir du texte suivant, génère {num_questions} questions QCM.
        
        IMPORTANT: Varie la position des bonnes réponses - ne les mets pas toujours en option C.
        Distribue les bonnes réponses entre les options a, b, c, et d de manière équilibrée.
        
        Format EXACT attendu pour CHAQUE question:
        Question 1: [Question]
        a) [Option A]
        b) [Option B]
        c) [Option C]  
        d) [Option D]
        Réponse: [lettre correcte - varie entre a, b, c, d]
        
        Question 2: [Question]
        a) [Option A]
        b) [Option B]
        c) [Option C]
        d) [Option D]
        Réponse: [lettre correcte - différente de la question précédente si possible]
        
        [Continue pour {num_questions} questions]
        
        Assure-toi que les bonnes réponses sont distribuées de manière équilibrée.
        
        Texte à analyser:
        {text_for_qcm}
        """
        
        response = GeminiService.query_rest_api(prompt)
        generated_text = response["candidates"][0]["content"]["parts"][0]["text"]
        
        questions = parse_traditional_qcm(generated_text)
        
        # NOUVEAU: Mélanger les options de chaque question
        for question in questions:
            if question.get("options") and question.get("correct_answer"):
                shuffled_options, new_correct = shuffle_options(
                    question["options"], 
                    question["correct_answer"]
                )
                question["options"] = shuffled_options
                question["correct_answer"] = new_correct
                
                logger.info(f"Question traditionnelle - Réponse correcte: {new_correct}")
        
        return questions
        
    except Exception as e:
        logger.error(f"Erreur dans generate_traditional_qcm: {str(e)}")
        return []


def parse_traditional_qcm(generated_text: str) -> List[Dict[str, Any]]:
    """
    Parse le QCM généré de manière traditionnelle
    """
    try:
        questions = []
        current_question = {}
        current_options = {}
        
        lines = [line.strip() for line in generated_text.split('\n') if line.strip()]
        
        for line in lines:
            line_lower = line.lower()
            
            # Nouvelle question
            if line_lower.startswith('question'):
                # Sauvegarder la question précédente si elle existe
                if current_question.get("question") and current_options:
                    current_question["options"] = current_options.copy()
                    if not current_question.get("explanation"):
                        current_question["explanation"] = "Cette réponse est correcte selon l'analyse du document."
                    if not current_question.get("source_text"):
                        current_question["source_text"] = "Basé sur le contenu global du document."
                    questions.append(current_question.copy())
                
                # Commencer une nouvelle question
                current_question = {"question": line.split(':', 1)[1].strip()}
                current_options = {}
            
            # Options
            elif re.match(r'^[abcd]\)', line_lower):
                key = line[0].lower()
                value = line[2:].strip()
                current_options[key] = value
            
            # Réponse correcte
            elif 'réponse:' in line_lower or 'answer:' in line_lower:
                correct_match = re.search(r'[abcd]', line_lower)
                if correct_match:
                    current_question["correct_answer"] = correct_match.group(0)
                else:
                    # NOUVEAU: Si pas de correspondance, choisir aléatoirement
                    current_question["correct_answer"] = random.choice(['a', 'b', 'c', 'd'])
        
        # Ajouter la dernière question
        if current_question.get("question") and current_options:
            current_question["options"] = current_options
            if not current_question.get("explanation"):
                current_question["explanation"] = "Cette réponse est correcte selon l'analyse du document."
            if not current_question.get("source_text"):
                current_question["source_text"] = "Basé sur le contenu global du document."
            questions.append(current_question)
        
        return questions
        
    except Exception as e:
        logger.error(f"Erreur lors du parsing du QCM traditionnel: {str(e)}")
        return []


def cleanup_qdrant_document(document_id: str):
    """
    Nettoie les données d'un document dans Qdrant (tâche d'arrière-plan)
    """
    try:
        QdrantService.delete_document_chunks(document_id)
        logger.info(f"Nettoyage Qdrant terminé pour le document {document_id}")
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage Qdrant pour {document_id}: {str(e)}")


# Endpoint supplémentaire pour les statistiques Qdrant
@router.get("/qdrant-info")
async def get_qdrant_info():
    """
    Retourne des informations sur la collection Qdrant
    """
    try:
        info = QdrantService.get_collection_info()
        return {"status": "success", "collection_info": info}
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des infos Qdrant: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur Qdrant: {str(e)}")


# Endpoint pour rechercher du contenu similaire
@router.post("/search-content")
async def search_content(query: str = Form(...), 
                        document_id: str = Form(None),
                        top_k: int = Form(5)):
    """
    Recherche du contenu similaire dans Qdrant
    """
    try:
        results = EmbeddingService.search_similar_content(
            query=query,
            top_k=top_k,
            document_id=document_id
        )
        
        return {
            "status": "success",
            "query": query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la recherche de contenu: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur de recherche: {str(e)}")


# Endpoint pour nettoyer un document spécifique
@router.delete("/cleanup-document/{document_id}")
async def cleanup_document(document_id: str):
    """
    Supprime tous les chunks d'un document spécifique de Qdrant
    """
    try:
        success = QdrantService.delete_document_chunks(document_id)
        
        if success:
            return {"status": "success", "message": f"Document {document_id} supprimé"}
        else:
            return {"status": "error", "message": "Erreur lors de la suppression"}
            
    except Exception as e:
        logger.error(f"Erreur lors de la suppression du document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur de suppression: {str(e)}")


# NOUVEAU: Fonction utilitaire pour vérifier la distribution des réponses
def analyze_answer_distribution(questions: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Analyse la distribution des réponses correctes pour détecter les biais
    
    Returns:
        Dict: Nombre de fois chaque option est correcte
    """
    distribution = {'a': 0, 'b': 0, 'c': 0, 'd': 0}
    
    for question in questions:
        correct = question.get("correct_answer", "").lower()
        if correct in distribution:
            distribution[correct] += 1
    
    logger.info(f"Distribution des réponses correctes: {distribution}")
    return distribution


# NOUVEAU: Endpoint pour analyser la distribution
@router.post("/analyze-distribution")
async def analyze_qcm_distribution(background_tasks: BackgroundTasks, 
                                  file: UploadFile = File(...), 
                                  num_questions: int = Form(10)):
    """
    Génère un QCM et analyse la distribution des réponses correctes
    """
    try:
        # Utiliser la même logique que generate_qcm mais avec analyse
        document_id = str(uuid.uuid4())
        content = await file.read()
        
        pdf_text, chunks = PDFExtractor.extract_text_with_chunks(content)
        
        if len(chunks) > 0:
            EmbeddingService.compute_embeddings(
                chunks, 
                store_in_qdrant=True, 
                document_id=document_id
            )
        
        qcm_questions = generate_qcm_with_rag_qdrant(pdf_text, document_id, num_questions)
        distribution = analyze_answer_distribution(qcm_questions)
        
        return {
            "qcm": qcm_questions,
            "distribution": distribution,
            "total_questions": len(qcm_questions),
            "is_balanced": max(distribution.values()) - min(distribution.values()) <= 2
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de l'analyse de distribution: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")