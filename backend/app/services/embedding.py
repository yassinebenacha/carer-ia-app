import logging
import numpy as np
import traceback
import uuid
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Import du service Qdrant (à ajouter)
from app.services.qdrant_service import QdrantService

logger = logging.getLogger(__name__)

class EmbeddingService:
    _model = None
    
    @classmethod
    def get_model(cls):
        """
        Charge le modèle d'embedding s'il n'est pas déjà chargé
        
        Returns:
            SentenceTransformer: Le modèle d'embedding
            
        Raises:
            HTTPException: Si une erreur survient lors du chargement du modèle
        """
        if cls._model is None:
            try:
                # Utiliser un modèle multilingue pour supporter le français
                # La version distilée est plus légère et rapide tout en gardant une bonne précision
                cls._model = SentenceTransformer('distiluse-base-multilingual-cased-v1')
                logger.info("Modèle d'embedding chargé avec succès")
            except Exception as e:
                logger.error(f"Erreur lors du chargement du modèle d'embedding: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(
                    status_code=500, 
                    detail=f"Erreur lors du chargement du modèle d'embedding: {str(e)}"
                )
        return cls._model
    
    @classmethod
    def compute_embeddings(cls, chunks: List[Dict[str, Any]], store_in_qdrant: bool = True, document_id: str = None) -> List[Dict[str, Any]]:
        """
        Calcule les embeddings pour tous les chunks de texte et les stocke dans Qdrant
        
        Args:
            chunks: Liste de chunks de texte avec métadonnées
            store_in_qdrant: Si True, stocke les embeddings dans Qdrant
            document_id: ID du document pour Qdrant (généré automatiquement si absent)
            
        Returns:
            List[Dict]: Chunks avec leurs embeddings calculés
            
        Raises:
            HTTPException: Si une erreur survient lors du calcul des embeddings
        """
        model = cls.get_model()
        texts = [chunk["text"] for chunk in chunks]
        
        try:
            # Calculer les embeddings par lots pour plus d'efficacité
            embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
            
            # Associer les embeddings aux chunks
            for i, chunk in enumerate(chunks):
                # Convertir l'embedding en liste pour la sérialisation JSON
                chunk["embedding"] = embeddings[i].tolist()
            
            # Stocker dans Qdrant si demandé
            if store_in_qdrant:
                if document_id is None:
                    document_id = str(uuid.uuid4())
                
                point_ids = QdrantService.store_chunks(chunks, document_id)
                
                # Ajouter les IDs Qdrant aux chunks
                for i, chunk in enumerate(chunks):
                    if i < len(point_ids):
                        chunk["qdrant_id"] = point_ids[i]
                        chunk["document_id"] = document_id
            
            return chunks
            
        except Exception as e:
            logger.error(f"Erreur lors du calcul des embeddings: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Erreur lors du calcul des embeddings: {str(e)}")
    
    @classmethod
    def find_relevant_context(cls, 
                             question: str, 
                             options: Dict[str, str], 
                             correct_answer: str, 
                             chunks: List[Dict[str, Any]] = None, 
                             top_k: int = 2,
                             use_qdrant: bool = True,
                             document_id: str = None) -> Optional[str]:
        """
        Trouve les chunks les plus pertinents pour une question en utilisant Qdrant ou les embeddings locaux
        
        Args:
            question: Le texte de la question
            options: Les options de réponse
            correct_answer: La réponse correcte
            chunks: Liste de chunks avec embeddings (pour méthode locale)
            top_k: Nombre de meilleurs chunks à récupérer
            use_qdrant: Si True, utilise Qdrant pour la recherche
            document_id: ID du document pour filtrer dans Qdrant
            
        Returns:
            str: Texte combiné des chunks les plus pertinents, ou None en cas d'erreur
        """
        try:
            model = cls.get_model()
            
            # Créer une requête combinant la question et les options
            query = question
            for key, value in options.items():
                query += f" {value}"
            
            # Calculer l'embedding de la requête
            query_embedding = model.encode(query, convert_to_numpy=True)
            
            if use_qdrant:
                # Utiliser Qdrant pour la recherche
                similar_chunks = QdrantService.search_similar_chunks(
                    query_embedding=query_embedding.tolist(),
                    limit=top_k,
                    score_threshold=0.3,  # Seuil de similarité ajustable
                    document_id=document_id
                )
                
                # Si la recherche avec filtre échoue, essayer sans filtre
                if not similar_chunks and document_id:
                    logger.warning(f"Recherche avec filtre document_id={document_id} a échoué, essai sans filtre")
                    similar_chunks = QdrantService.search_similar_chunks_without_filter(
                        query_embedding=query_embedding.tolist(),
                        limit=top_k,
                        score_threshold=0.3
                    )
                
                if not similar_chunks:
                    logger.warning("Aucun chunk similaire trouvé dans Qdrant")
                    return None
                
                # Formater le contexte
                context_text = "\n".join([
                    f"[Extrait page {chunk['page']}, pertinence: {chunk['similarity']:.2f}] {chunk['text']}" 
                    for chunk in similar_chunks
                ])
                
                return context_text
            
            else:
                # Méthode locale (code original)
                if not chunks:
                    logger.warning("Aucun chunk fourni pour la recherche locale")
                    return None
                
                # Calculer la similarité cosinus entre la requête et chaque chunk
                similarities = []
                for i, chunk in enumerate(chunks):
                    if chunk["embedding"] is None:
                        # Si un chunk n'a pas d'embedding, le calculer maintenant
                        chunk["embedding"] = model.encode(chunk["text"], convert_to_numpy=True).tolist()
                    
                    # Convertir en numpy arrays
                    query_emb_array = np.array(query_embedding).reshape(1, -1)
                    chunk_emb_array = np.array(chunk["embedding"]).reshape(1, -1)
                    
                    sim = cosine_similarity(query_emb_array, chunk_emb_array)[0][0]
                    similarities.append((i, sim))
                
                # Trier les chunks par similarité décroissante
                similarities.sort(key=lambda x: x[1], reverse=True)
                
                # Sélectionner les top_k chunks les plus pertinents
                best_chunks = []
                for i in range(min(top_k, len(similarities))):
                    chunk_idx, sim = similarities[i]
                    chunk = chunks[chunk_idx]
                    best_chunks.append({
                        "text": chunk["text"],
                        "page": chunk["page"],
                        "similarity": float(sim)  # Convertir en float pour sérialisation JSON
                    })
                
                if not best_chunks:
                    return None
                
                # Joindre les textes des meilleurs chunks
                context_text = "\n".join([f"[Extrait page {c['page']}, pertinence: {c['similarity']:.2f}] {c['text']}" 
                                        for c in best_chunks])
                
                return context_text
            
        except Exception as e:
            logger.error(f"Erreur lors de la recherche de contexte pertinent: {str(e)}")
            logger.error(traceback.format_exc())
            # En cas d'erreur, retourner None pour que le système puisse continuer
            return None
    
    @classmethod
    def search_similar_content(cls, 
                              query: str, 
                              top_k: int = 5, 
                              document_id: str = None) -> List[Dict[str, Any]]:
        """
        Recherche de contenu similaire dans Qdrant avec fallback
        
        Args:
            query: Texte de recherche
            top_k: Nombre de résultats à retourner
            document_id: Filtrer par document spécifique
            
        Returns:
            List[Dict]: Liste des chunks similaires
        """
        try:
            model = cls.get_model()
            
            # Calculer l'embedding de la requête
            query_embedding = model.encode(query, convert_to_numpy=True)
            
            # Rechercher dans Qdrant avec filtre
            similar_chunks = QdrantService.search_similar_chunks(
                query_embedding=query_embedding.tolist(),
                limit=top_k,
                score_threshold=0.3,
                document_id=document_id
            )
            
            # Si la recherche avec filtre échoue, essayer sans filtre
            if not similar_chunks and document_id:
                logger.warning(f"Recherche avec filtre document_id={document_id} a échoué, essai sans filtre")
                similar_chunks = QdrantService.search_similar_chunks_without_filter(
                    query_embedding=query_embedding.tolist(),
                    limit=top_k,
                    score_threshold=0.3
                )
            
            return similar_chunks
            
        except Exception as e:
            logger.error(f"Erreur lors de la recherche de contenu similaire: {str(e)}")
            return []