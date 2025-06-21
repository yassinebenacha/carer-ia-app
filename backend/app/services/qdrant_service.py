import logging
import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, PayloadSchemaType
from fastapi import HTTPException
import traceback

logger = logging.getLogger(__name__)

class QdrantService:
    _client = None
    _collection_name = "documents_embeddings"
    
    @classmethod
    def get_client(cls):
        """
        Initialise et retourne le client Qdrant
        
        Returns:
            QdrantClient: Le client Qdrant configuré
        """
        if cls._client is None:
            try:
                cls._client = QdrantClient(
                    url="https://45814fa2-931d-4ff2-9f9a-c0a356d79a1a.us-west-2-0.aws.cloud.qdrant.io",
                    api_key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.MJF_7emDzQFN2R7LbbzBunTsNDqpsG1Bc3C1iMpi_Ug"
                )
                logger.info("Client Qdrant initialisé avec succès")
                
                # Créer la collection si elle n'existe pas
                cls._ensure_collection_exists()
                
                # Créer les index nécessaires
                cls._create_indexes()
                
            except Exception as e:
                logger.error(f"Erreur lors de l'initialisation du client Qdrant: {str(e)}")
                logger.error(traceback.format_exc())
                raise HTTPException(
                    status_code=500, 
                    detail=f"Erreur lors de la connexion à Qdrant: {str(e)}"
                )
        return cls._client
    
    @classmethod
    def _ensure_collection_exists(cls):
        """
        S'assure que la collection existe, la crée si nécessaire
        """
        try:
            client = cls._client
            collections = client.get_collections()
            
            # Vérifier si la collection existe
            collection_exists = any(
                collection.name == cls._collection_name 
                for collection in collections.collections
            )
            
            if not collection_exists:
                # Créer la collection avec les paramètres appropriés
                # 512 dimensions pour le modèle distiluse-base-multilingual-cased-v1
                client.create_collection(
                    collection_name=cls._collection_name,
                    vectors_config=VectorParams(size=512, distance=Distance.COSINE)
                )
                logger.info(f"Collection '{cls._collection_name}' créée avec succès")
            else:
                logger.info(f"Collection '{cls._collection_name}' existe déjà")
                
        except Exception as e:
            logger.error(f"Erreur lors de la création/vérification de la collection: {str(e)}")
            raise
    
    @classmethod
    def _create_indexes(cls):
        """
        Crée les index nécessaires pour les filtres
        """
        try:
            client = cls._client
            
            # Créer un index pour le champ document_id
            try:
                client.create_payload_index(
                    collection_name=cls._collection_name,
                    field_name="document_id",
                    field_schema=PayloadSchemaType.KEYWORD
                )
                logger.info("Index créé pour le champ 'document_id'")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info("Index 'document_id' existe déjà")
                else:
                    logger.warning(f"Erreur lors de la création de l'index document_id: {str(e)}")
            
            # Créer un index pour le champ page (optionnel, peut être utile)
            try:
                client.create_payload_index(
                    collection_name=cls._collection_name,
                    field_name="page",
                    field_schema=PayloadSchemaType.INTEGER
                )
                logger.info("Index créé pour le champ 'page'")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info("Index 'page' existe déjà")
                else:
                    logger.warning(f"Erreur lors de la création de l'index page: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Erreur lors de la création des index: {str(e)}")
            # Ne pas lever d'exception car les index peuvent ne pas être critiques
    
    @classmethod
    def store_chunks(cls, chunks: List[Dict[str, Any]], document_id: str = None) -> List[str]:
        """
        Stocke les chunks avec leurs embeddings dans Qdrant
        
        Args:
            chunks: Liste de chunks avec embeddings
            document_id: ID du document (optionnel, généré automatiquement si absent)
            
        Returns:
            List[str]: Liste des IDs des points stockés
            
        Raises:
            HTTPException: Si une erreur survient lors du stockage
        """
        try:
            client = cls.get_client()
            
            if document_id is None:
                document_id = str(uuid.uuid4())
            
            # Préparer les points pour Qdrant
            points = []
            point_ids = []
            
            for i, chunk in enumerate(chunks):
                if chunk.get("embedding") is None:
                    logger.warning(f"Chunk {i} n'a pas d'embedding, ignoré")
                    continue
                
                point_id = str(uuid.uuid4())
                point_ids.append(point_id)
                
                # Créer le payload avec les métadonnées
                payload = {
                    "text": chunk["text"],
                    "page": chunk.get("page", 0),
                    "document_id": document_id,
                    "chunk_index": i
                }
                
                # Créer le point
                point = PointStruct(
                    id=point_id,
                    vector=chunk["embedding"],
                    payload=payload
                )
                points.append(point)
            
            # Insérer les points dans Qdrant
            if points:
                client.upsert(
                    collection_name=cls._collection_name,
                    points=points
                )
                logger.info(f"Stocké {len(points)} chunks dans Qdrant pour le document {document_id}")
            
            return point_ids
            
        except Exception as e:
            logger.error(f"Erreur lors du stockage dans Qdrant: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=500, 
                detail=f"Erreur lors du stockage dans Qdrant: {str(e)}"
            )
    
    @classmethod
    def search_similar_chunks(cls, 
                             query_embedding: List[float], 
                             limit: int = 5,
                             score_threshold: float = 0.5,
                             document_id: str = None) -> List[Dict[str, Any]]:
        """
        Recherche les chunks similaires dans Qdrant
        
        Args:
            query_embedding: Embedding de la requête
            limit: Nombre maximum de résultats
            score_threshold: Seuil de similarité minimum
            document_id: Filtrer par document (optionnel)
            
        Returns:
            List[Dict]: Liste des chunks similaires avec leurs scores
        """
        try:
            client = cls.get_client()
            
            # Préparer le filtre si document_id est spécifié
            query_filter = None
            if document_id:
                query_filter = {
                    "must": [
                        {
                            "key": "document_id",
                            "match": {"value": document_id}
                        }
                    ]
                }
            
            # Effectuer la recherche
            search_results = client.search(
                collection_name=cls._collection_name,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=score_threshold,
                query_filter=query_filter
            )
            
            # Formater les résultats
            similar_chunks = []
            for result in search_results:
                chunk_data = {
                    "id": result.id,
                    "text": result.payload["text"],
                    "page": result.payload.get("page", 0),
                    "document_id": result.payload.get("document_id"),
                    "chunk_index": result.payload.get("chunk_index", 0),
                    "similarity": float(result.score)
                }
                similar_chunks.append(chunk_data)
            
            logger.info(f"Trouvé {len(similar_chunks)} chunks similaires dans Qdrant")
            return similar_chunks
            
        except Exception as e:
            logger.error(f"Erreur lors de la recherche dans Qdrant: {str(e)}")
            logger.error(traceback.format_exc())
            # Retourner une liste vide en cas d'erreur pour permettre au système de continuer
            return []
    
    @classmethod
    def search_similar_chunks_without_filter(cls, 
                                           query_embedding: List[float], 
                                           limit: int = 5,
                                           score_threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Recherche les chunks similaires dans Qdrant SANS filtre (fallback)
        
        Args:
            query_embedding: Embedding de la requête
            limit: Nombre maximum de résultats
            score_threshold: Seuil de similarité minimum
            
        Returns:
            List[Dict]: Liste des chunks similaires avec leurs scores
        """
        try:
            client = cls.get_client()
            
            # Effectuer la recherche sans filtre
            search_results = client.search(
                collection_name=cls._collection_name,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=score_threshold
            )
            
            # Formater les résultats
            similar_chunks = []
            for result in search_results:
                chunk_data = {
                    "id": result.id,
                    "text": result.payload["text"],
                    "page": result.payload.get("page", 0),
                    "document_id": result.payload.get("document_id"),
                    "chunk_index": result.payload.get("chunk_index", 0),
                    "similarity": float(result.score)
                }
                similar_chunks.append(chunk_data)
            
            logger.info(f"Trouvé {len(similar_chunks)} chunks similaires dans Qdrant (sans filtre)")
            return similar_chunks
            
        except Exception as e:
            logger.error(f"Erreur lors de la recherche dans Qdrant (sans filtre): {str(e)}")
            return []
    
    @classmethod
    def delete_document_chunks(cls, document_id: str) -> bool:
        """
        Supprime tous les chunks d'un document spécifique
        
        Args:
            document_id: ID du document à supprimer
            
        Returns:
            bool: True si la suppression a réussi
        """
        try:
            client = cls.get_client()
            
            # Supprimer tous les points avec ce document_id
            client.delete(
                collection_name=cls._collection_name,
                points_selector={
                    "filter": {
                        "must": [
                            {
                                "key": "document_id",
                                "match": {"value": document_id}
                            }
                        ]
                    }
                }
            )
            
            logger.info(f"Chunks du document {document_id} supprimés de Qdrant")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du document {document_id}: {str(e)}")
            return False
    
    @classmethod
    def get_collection_info(cls) -> Dict[str, Any]:
        """
        Retourne des informations sur la collection
        
        Returns:
            Dict: Informations sur la collection
        """
        try:
            client = cls.get_client()
            
            collection_info = client.get_collection(cls._collection_name)
            
            return {
                "name": collection_info.name,
                "vectors_count": collection_info.vectors_count,
                "indexed_vectors_count": collection_info.indexed_vectors_count,
                "points_count": collection_info.points_count,
                "status": collection_info.status
            }
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des infos de collection: {str(e)}")
            return {}
    
    @classmethod
    def recreate_collection_with_indexes(cls) -> bool:
        """
        Recrée la collection avec les index appropriés (méthode d'urgence)
        
        Returns:
            bool: True si la recréation a réussi
        """
        try:
            client = cls.get_client()
            
            # Supprimer la collection existante
            try:
                client.delete_collection(cls._collection_name)
                logger.info(f"Collection '{cls._collection_name}' supprimée")
            except:
                pass
            
            # Recréer la collection
            client.create_collection(
                collection_name=cls._collection_name,
                vectors_config=VectorParams(size=512, distance=Distance.COSINE)
            )
            
            # Créer les index
            cls._create_indexes()
            
            logger.info(f"Collection '{cls._collection_name}' recréée avec les index")
            return True
            
        except Exception as e:
            logger.error(f"Erreur lors de la recréation de la collection: {str(e)}")
            return False