// src/services/resumeService.js
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc,
  query,
  orderBy,
  where,
  getDoc
} from 'firebase/firestore';
import { db } from '../components/firebase';

const COLLECTION_NAME = 'resumes';

// Ajouter un nouveau résumé avec association utilisateur obligatoire
export const addResume = async (resumeData, userId) => {
  if (!userId) {
    throw new Error('L\'ID utilisateur est requis pour sauvegarder un résumé');
  }

  if (!resumeData.title || !resumeData.content) {
    throw new Error('Le titre et le contenu sont requis');
  }

  try {
    const docData = {
      ...resumeData,
      userId, // ID de l'utilisateur Firebase
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('Adding resume to Firestore for user:', userId);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    console.log('Resume added with ID:', docRef.id);
    
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error('Erreur lors de l\'ajout du résumé:', error);
    throw new Error('Impossible de sauvegarder le résumé. Erreur: ' + error.message);
  }
};

// Récupérer les résumés d'un utilisateur spécifique
export const getResumes = async (userId) => {
  if (!userId) {
    throw new Error('L\'ID utilisateur est requis pour récupérer les résumés');
  }

  try {
    console.log('Fetching resumes for user:', userId);
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const resumes = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Double vérification de sécurité
      if (data.userId === userId) {
        resumes.push({ id: doc.id, ...data });
      }
    });
    
    console.log('Found', resumes.length, 'resumes for user:', userId);
    return resumes;
  } catch (error) {
    console.error('Erreur lors de la récupération des résumés:', error);
    
    // Si l'erreur est liée à l'index, essayer sans orderBy
    if (error.code === 'failed-precondition' || error.message.includes('index')) {
      try {
        console.log('Retrying without orderBy due to index issue');
        const q = query(
          collection(db, COLLECTION_NAME),
          where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        const resumes = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.userId === userId) {
            resumes.push({ id: doc.id, ...data });
          }
        });
        
        // Trier manuellement par date de création
        resumes.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        });
        
        console.log('Found', resumes.length, 'resumes for user (without index):', userId);
        return resumes;
      } catch (fallbackError) {
        console.error('Erreur lors de la récupération des résumés (fallback):', fallbackError);
        throw new Error('Impossible de récupérer vos résumés. Veuillez réessayer.');
      }
    } else {
      throw new Error('Impossible de récupérer vos résumés. Erreur: ' + error.message);
    }
  }
};

// Supprimer un résumé (avec vérification de propriété)
export const deleteResume = async (resumeId, userId = null) => {
  if (!resumeId) {
    throw new Error('L\'ID du résumé est requis');
  }

  try {
    console.log('Deleting resume:', resumeId, 'for user:', userId);
    
    // Si un userId est fourni, vérifier que le résumé appartient à cet utilisateur
    if (userId) {
      const resumeRef = doc(db, COLLECTION_NAME, resumeId);
      const resumeDoc = await getDoc(resumeRef);
      
      if (!resumeDoc.exists()) {
        throw new Error('Le résumé n\'existe pas');
      }
      
      const resumeData = resumeDoc.data();
      if (resumeData.userId !== userId) {
        throw new Error('Vous n\'êtes pas autorisé à supprimer ce résumé');
      }
    }
    
    await deleteDoc(doc(db, COLLECTION_NAME, resumeId));
    console.log('Resume deleted successfully:', resumeId);
  } catch (error) {
    console.error('Erreur lors de la suppression du résumé:', error);
    throw new Error('Impossible de supprimer le résumé. Erreur: ' + error.message);
  }
};

// Mettre à jour un résumé (avec vérification de propriété)
export const updateResume = async (resumeId, updates, userId = null) => {
  if (!resumeId) {
    throw new Error('L\'ID du résumé est requis');
  }

  try {
    console.log('Updating resume:', resumeId, 'for user:', userId);
    
    // Si un userId est fourni, vérifier que le résumé appartient à cet utilisateur
    if (userId) {
      const resumeRef = doc(db, COLLECTION_NAME, resumeId);
      const resumeDoc = await getDoc(resumeRef);
      
      if (!resumeDoc.exists()) {
        throw new Error('Le résumé n\'existe pas');
      }
      
      const resumeData = resumeDoc.data();
      if (resumeData.userId !== userId) {
        throw new Error('Vous n\'êtes pas autorisé à modifier ce résumé');
      }
    }

    const docRef = doc(db, COLLECTION_NAME, resumeId);
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };
    
    // S'assurer qu'on ne peut pas changer le userId
    if (updateData.userId && userId && updateData.userId !== userId) {
      delete updateData.userId;
    }
    
    await updateDoc(docRef, updateData);
    console.log('Resume updated successfully:', resumeId);
    return { id: resumeId, ...updateData };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du résumé:', error);
    throw new Error('Impossible de mettre à jour le résumé. Erreur: ' + error.message);
  }
};

// Obtenir un résumé spécifique par ID (avec vérification de propriété)
export const getResumeById = async (resumeId, userId) => {
  if (!resumeId || !userId) {
    throw new Error('L\'ID du résumé et l\'ID utilisateur sont requis');
  }

  try {
    console.log('Getting resume by ID:', resumeId, 'for user:', userId);
    
    const resumeRef = doc(db, COLLECTION_NAME, resumeId);
    const resumeDoc = await getDoc(resumeRef);
    
    if (!resumeDoc.exists()) {
      throw new Error('Résumé non trouvé');
    }
    
    const resumeData = resumeDoc.data();
    if (resumeData.userId !== userId) {
      throw new Error('Vous n\'avez pas accès à ce résumé');
    }
    
    return { id: resumeDoc.id, ...resumeData };
  } catch (error) {
    console.error('Erreur lors de la récupération du résumé:', error);
    throw new Error('Impossible de récupérer le résumé. Erreur: ' + error.message);
  }
};

// Obtenir les statistiques des résumés d'un utilisateur
export const getResumeStats = async (userId) => {
  if (!userId) {
    throw new Error('L\'ID utilisateur est requis');
  }

  try {
    console.log('Getting resume stats for user:', userId);
    const resumes = await getResumes(userId);
    
    const stats = {
      total: resumes.length,
      pdfResumes: resumes.filter(r => r.source === 'pdf').length,
      textResumes: resumes.filter(r => r.source === 'text').length,
      thisWeek: 0,
      thisMonth: 0
    };
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    resumes.forEach(resume => {
      const createdAt = resume.createdAt?.toDate ? resume.createdAt.toDate() : new Date(resume.createdAt);
      
      if (createdAt >= oneWeekAgo) {
        stats.thisWeek++;
      }
      if (createdAt >= oneMonthAgo) {
        stats.thisMonth++;
      }
    });
    
    console.log('Resume stats calculated:', stats);
    return stats;
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques:', error);
    return {
      total: 0,
      pdfResumes: 0,
      textResumes: 0,
      thisWeek: 0,
      thisMonth: 0
    };
  }
};

// Fonction utilitaire pour vérifier la connectivité Firebase
export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    const testQuery = query(collection(db, COLLECTION_NAME), where('userId', '==', 'test'));
    await getDocs(testQuery);
    console.log('Firebase connection successful');
    return true;
  } catch (error) {
    console.error('Firebase connection failed:', error);
    return false;
  }
};

// Fonction pour nettoyer les anciens résumés (optionnel)
export const cleanupOldResumes = async (userId, daysToKeep = 30) => {
  if (!userId) {
    throw new Error('L\'ID utilisateur est requis');
  }

  try {
    console.log('Cleaning up old resumes for user:', userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const resumes = await getResumes(userId);
    const oldResumes = resumes.filter(resume => {
      const createdAt = resume.createdAt?.toDate ? resume.createdAt.toDate() : new Date(resume.createdAt);
      return createdAt < cutoffDate;
    });
    
    console.log('Found', oldResumes.length, 'old resumes to cleanup');
    
    const deletePromises = oldResumes.map(resume => deleteResume(resume.id, userId));
    await Promise.all(deletePromises);
    
    console.log('Cleanup completed');
    return oldResumes.length;
  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    throw new Error('Impossible de nettoyer les anciens résumés. Erreur: ' + error.message);
  }
};