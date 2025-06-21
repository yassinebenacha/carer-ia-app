import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any

from app.services.pdf_extractor import PDFExtractor
from app.services.gemini import GeminiService
from app.utils.helpers import save_upload_file_temp, cleanup_temp_file
from app.models.schemas import SummaryResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/summarize/pdf", response_model=SummaryResponse)
async def summarize_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Génère un résumé à partir d'un fichier PDF
    
    Args:
        background_tasks: Tâches d'arrière-plan FastAPI
        file: Fichier PDF téléchargé
        
    Returns:
        SummaryResponse: Résumé généré
        
    Raises:
        HTTPException: Si une erreur survient pendant le processus
    """
    tmp_path = None
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
        
        logger.info(f"Traitement du fichier PDF pour résumé: {file.filename}")
        
        # Extraire le texte du PDF
        extracted_text = PDFExtractor.extract_text(content)
        if not extracted_text or len(extracted_text) < 100:
            raise HTTPException(status_code=400, detail="Le PDF ne contient pas assez de texte pour générer un résumé")
        
        # Générer le résumé avec Gemini
        prompt = f"""
        Résume clairement ce document PDF en suivant ces instructions :
        - Organise par grandes sections avec ## Titres
        - Utilise des listes à puces si nécessaire
        - Formatte proprement en markdown.
        
        Contenu :
        {extracted_text}
        """
        
        logger.info("Génération du résumé avec Gemini")
        summary = await GeminiService.generate_text(prompt)
        
        return {"summary": summary}
        
    except Exception as e:
        logger.error(f"Erreur lors de la génération du résumé: {str(e)}")
        if tmp_path:
            background_tasks.add_task(cleanup_temp_file, tmp_path)
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération du résumé: {str(e)}")