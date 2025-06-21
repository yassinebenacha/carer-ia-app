import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { HiOutlineUpload, HiOutlineMenuAlt2, HiX, HiTrash } from 'react-icons/hi';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { addResume, getResumes, deleteResume } from '../services/resumeService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../components/firebase';
import ChatInterface from '../components/ChatInterface';


const Resume = () => {
  const [fileName, setFileName] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Écouter l'état d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state changed:', currentUser ? currentUser.uid : 'No user');
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Charger l'historique quand l'utilisateur change
  useEffect(() => {
    if (!authLoading && user) {
      console.log('Loading history for user:', user.uid);
      loadHistory();
    } else if (!authLoading && !user) {
      // Si pas d'utilisateur connecté, vider l'historique
      console.log('No user, clearing history');
      setHistory([]);
      setSelectedSummary(null);
      setLoadingHistory(false);
    }
  }, [user, authLoading]);

  const loadHistory = async () => {
    if (!user) {
      console.log('No user available for loading history');
      return;
    }
    
    try {
      setLoadingHistory(true);
      console.log('Fetching resumes for user:', user.uid);
      const resumes = await getResumes(user.uid);
      console.log('Fetched resumes:', resumes.length);
      setHistory(resumes);
      
      // Si aucun résumé n'est sélectionné et qu'il y a des résumés, sélectionner le plus récent
      if (!selectedSummary && resumes.length > 0) {
        setSelectedSummary(resumes[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
      // En cas d'erreur, afficher un message à l'utilisateur
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fonction pour rafraîchir l'historique
  const refreshHistory = async () => {
    if (user) {
      await loadHistory();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFileName(file ? file.name : null);
  };

  const handleGenerate = async () => {
    if (!user) {
      alert('Vous devez être connecté pour utiliser cette fonctionnalité.');
      return;
    }

    try {
      setLoading(true);
      let result = "";

      if (fileName) {
        const formData = new FormData();
        formData.append('file', document.getElementById('pdf-upload').files[0]);

        const response = await axios.post('http://127.0.0.1:8000/api/summarize/pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        result = response.data.summary;
      } else {
        const response = await axios.post('http://127.0.0.1:8000/api/summarize/generate', { text: prompt });
        result = response.data.summary;
      }

      // Préparer les données du résumé avec l'ID utilisateur
      const resumeData = {
        title: `Résumé ${new Date().toLocaleString('fr-FR')}`,
        content: result,
        source: fileName ? 'pdf' : 'text',
        originalFileName: fileName,
        originalPrompt: fileName ? null : prompt,
        userEmail: user.email // Optionnel : stocker l'email pour debug
      };

      console.log('Saving resume for user:', user.uid);
      // Sauvegarder dans Firebase avec l'userId
      const savedResume = await addResume(resumeData, user.uid);
      console.log('Resume saved:', savedResume.id);
      
      // Mettre à jour l'état local en ajoutant le nouveau résumé au début
      setHistory(prevHistory => [savedResume, ...prevHistory]);
      setSelectedSummary(savedResume);
      
      // Réinitialiser le formulaire
      setFileName(null);
      setPrompt('');
      const fileInput = document.getElementById('pdf-upload');
      if (fileInput) fileInput.value = '';
      
    } catch (err) {
      console.error('Erreur de résumé :', err);
      alert('Erreur lors de la génération du résumé. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResume = async (resumeId, event) => {
    event.stopPropagation();
    
    if (!user) {
      alert('Vous devez être connecté pour supprimer un résumé.');
      return;
    }
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce résumé ?')) {
      try {
        console.log('Deleting resume:', resumeId);
        await deleteResume(resumeId, user.uid); // Passer l'userId pour la vérification
        
        // Mettre à jour l'état local
        setHistory(prevHistory => prevHistory.filter(item => item.id !== resumeId));
        
        // Si le résumé supprimé était sélectionné, sélectionner le premier de la liste ou null
        if (selectedSummary && selectedSummary.id === resumeId) {
          const remainingResumes = history.filter(item => item.id !== resumeId);
          setSelectedSummary(remainingResumes.length > 0 ? remainingResumes[0] : null);
        }
        
        console.log('Resume deleted successfully');
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du résumé: ' + error.message);
      }
    }
  };

  const exportPdf = () => {
    if (!selectedSummary) return;
    
    try {
      const doc = new jsPDF();
      
      // Configuration pour le texte français
      const lines = doc.splitTextToSize(selectedSummary.content, 180);
      doc.text(lines, 10, 10);
      doc.save(`${selectedSummary.title}.pdf`);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF.');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    try {
      const firebaseDate = date.toDate ? date.toDate() : new Date(date);
      return firebaseDate.toLocaleString('fr-FR');
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return '';
    }
  };

  // Affichage de chargement pendant la vérification de l'authentification
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-blue-600 font-medium">Vérification de l'authentification...</span>
        </div>
      </div>
    );
  }

  // Affichage si l'utilisateur n'est pas connecté
  if (!user) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-md"
          >
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <HiOutlineUpload className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-blue-800 mb-2">Connexion requise</h2>
              <p className="text-gray-600">
                Vous devez être connecté pour utiliser le générateur de résumé et sauvegarder vos documents.
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                Se connecter
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition"
              >
                Retour à l'accueil
              </button>
            </div>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="flex h-screen bg-gradient-to-br from-blue-50 to-gray-100 overflow-hidden">
        {/* Sidebar */}
        <motion.div
          initial={{ x: -300 }}
          animate={{ x: sidebarOpen ? 0 : -300 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-40 flex flex-col p-4"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-blue-700">Historique</h2>
              <p className="text-xs text-gray-500">{user.displayName || user.email}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={refreshHistory}
                className="text-blue-500 hover:text-blue-700 text-sm"
                title="Actualiser"
              >
                🔄
              </button>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-red-500">
                <HiX size={24} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {loadingHistory ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-2">Aucun résumé encore.</p>
                <p className="text-xs text-gray-300">Créez votre premier résumé !</p>
              </div>
            ) : (
              history.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => setSelectedSummary(item)}
                  className={`p-3 rounded-lg cursor-pointer relative group transition-colors ${
                    selectedSummary?.id === item.id 
                      ? 'bg-blue-200 border-2 border-blue-400' 
                      : 'bg-blue-100 hover:bg-blue-200'
                  }`}
                >
                  <div className="pr-8">
                    <div className="font-medium text-sm">{item.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(item.createdAt)}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {item.source === 'pdf' ? `📄 ${item.originalFileName}` : '📝 Texte'}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteResume(item.id, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                  >
                    <HiTrash size={16} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Menu bouton */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          <HiOutlineMenuAlt2 size={24} />
        </button>

        {/* Contenu principal */}
        <div className="flex flex-1 flex-col lg:flex-row p-8 overflow-y-auto w-full gap-8">
          {/* Formulaire */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 bg-white shadow-md rounded-2xl p-6 space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-blue-700 mb-2">Générateur de Résumé</h1>
              <p className="text-sm text-gray-600">
                Connecté en tant que <span className="font-medium text-blue-600">{user.displayName || user.email}</span>
              </p>
            </div>

            {/* Upload PDF */}
            <div className="border-2 border-dashed border-blue-400 p-6 text-center rounded-xl">
              <input type="file" accept="application/pdf" id="pdf-upload" onChange={handleFileChange} className="hidden" />
              <label htmlFor="pdf-upload" className="cursor-pointer text-blue-600 font-semibold flex items-center justify-center gap-2">
                <HiOutlineUpload size={20} />
                {fileName ? fileName : 'Cliquez ici pour importer un fichier PDF'}
              </label>
            </div>



            <button
              onClick={handleGenerate}
              disabled={loading || (!fileName && !prompt.trim())}
              className="bg-teal-600 text-white px-6 py-2 rounded-xl hover:bg-teal-700 transition font-semibold w-full disabled:opacity-50"
            >
              {loading ? 'Génération...' : 'Générer le Résumé'}
            </button>

            {loading && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
              </div>
            )}
          </motion.div>

          {/* Résumé */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex-1 bg-white shadow-md rounded-2xl p-6 space-y-4"
          >
            {selectedSummary ? (
              <motion.div
                key={selectedSummary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-blue-700">{selectedSummary.title}</h2>
                    <p className="text-sm text-gray-500">{formatDate(selectedSummary.createdAt)}</p>
                  </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto pr-2 scroll-smooth rounded-xl border border-gray-200 p-4 bg-white shadow-inner mt-4">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-blue-700 mb-4 mt-6" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-2xl font-semibold text-blue-600 mt-4 mb-2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-xl font-medium text-blue-500 mt-3 mb-1" {...props} />,
                      p: ({ node, ...props }) => <p className="text-gray-700 text-justify mb-4 leading-relaxed" {...props} />,
                      li: ({ node, ...props }) => <li className="list-disc ml-6 mb-2 text-gray-700" {...props} />,
                      strong: ({ node, ...props }) => <strong className="text-gray-900 font-semibold" {...props} />,
                    }}
                  >
                    {selectedSummary.content}
                  </ReactMarkdown>
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={exportPdf}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition"
                  >
                    Exporter en PDF
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 italic text-lg mb-4">Aucun résumé sélectionné.</p>
                <p className="text-gray-500 text-sm">Générez un nouveau résumé ou sélectionnez-en un dans l'historique.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
            <ChatInterface />

      <Footer />
    </>
  );
};

export default Resume;