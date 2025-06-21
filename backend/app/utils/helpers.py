import tempfile
import os
import logging
from typing import Tuple, BinaryIO

logger = logging.getLogger(__name__)

def save_upload_file_temp(file_content: bytes) -> Tuple[str, str]:
    """
    Sauvegarde le contenu d'un fichier dans un fichier temporaire
    
    Args:
        file_content: Contenu binaire du fichier
        
    Returns:
        Tuple[str, str]: Nom du fichier temporaire et chemin complet
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_content)
        return tmp.name, os.path.abspath(tmp.name)

def cleanup_temp_file(file_path: str):
    """
    Supprime un fichier temporaire
    
    Args:
        file_path: Chemin du fichier à supprimer
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Fichier temporaire supprimé: {file_path}")
    except Exception as e:
        logger.error(f"Erreur lors de la suppression du fichier temporaire {file_path}: {str(e)}")

def truncate_text(text: str, max_length: int = 3500) -> str:
    """
    Tronque un texte à une longueur maximale
    
    Args:
        text: Texte à tronquer
        max_length: Longueur maximale (défaut: 3500)
        
    Returns:
        str: Texte tronqué
    """
    if len(text) <= max_length:
        return text
    return text[:max_length]