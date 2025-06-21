import logging
import fitz  # PyMuPDF
import io
from typing import List, Tuple, Dict, Any
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class PDFExtractor:
    @staticmethod
    def extract_text(file_data: bytes) -> str:
        """
        Extrait tout le texte d'un fichier PDF.
        
        Args:
            file_data: Contenu binaire du fichier PDF
            
        Returns:
            str: Texte extrait du PDF
            
        Raises:
            HTTPException: Si une erreur survient lors de l'extraction
        """
        try:
            # Utilisation de PyMuPDF
            doc = fitz.open(stream=file_data, filetype="pdf")
            full_text = ""
            
            for page in doc:
                full_text += page.get_text() + "\n"
                
            return full_text
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction du texte PDF: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de l'extraction du PDF: {str(e)}")
    
    @staticmethod
    def extract_text_with_chunks(file_data: bytes) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extrait le texte brut et des chunks structurés d'un fichier PDF.
        
        Args:
            file_data: Contenu binaire du fichier PDF
            
        Returns:
            Tuple[str, List[Dict]]: Texte complet et liste de chunks avec métadonnées
            
        Raises:
            HTTPException: Si une erreur survient lors de l'extraction
        """
        try:
            doc = fitz.open(stream=file_data, filetype="pdf")
            full_text = ""
            
            # Extraire texte de chaque page
            for page in doc:
                full_text += page.get_text()
            
            # Extraire également le texte par paragraphes pour le RAG
            chunks = []
            for page_num, page in enumerate(doc):
                # Obtenir les blocs de texte de la page
                blocks = page.get_text("blocks")
                for block in blocks:
                    if isinstance(block, tuple) and len(block) > 4:  # Vérifier si c'est un bloc de texte
                        text_chunk = block[4].strip()
                        if len(text_chunk) > 30:  # Ignorer les blocs trop courts
                            chunks.append({
                                "text": text_chunk,
                                "page": page_num + 1,
                                "embedding": None  # Sera calculé à la demande
                            })
            
            return full_text, chunks
        except Exception as e:
            logger.error(f"Erreur lors de l'extraction du texte PDF avec chunks: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de l'extraction du PDF: {str(e)}")

    @staticmethod
    def validate_pdf(file_data: bytes) -> bool:
        """
        Valide que le fichier est bien un PDF valide.
        
        Args:
            file_data: Contenu binaire du fichier
            
        Returns:
            bool: True si le fichier est un PDF valide
            
        Raises:
            HTTPException: Si le fichier n'est pas un PDF valide
        """
        try:
            doc = fitz.open(stream=file_data, filetype="pdf")
            if doc.page_count == 0:
                raise ValueError("Le PDF ne contient aucune page")
                
            # Vérifier qu'il y a du texte dans le document
            has_text = False
            for page in doc:
                if page.get_text().strip():
                    has_text = True
                    break
                    
            if not has_text:
                raise ValueError("Le PDF ne contient pas de texte extractible")
                
            return True
        except Exception as e:
            logger.error(f"Validation du PDF échouée: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Fichier PDF invalide: {str(e)}")