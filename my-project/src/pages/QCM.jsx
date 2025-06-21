import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ChatInterface from '../components/ChatInterface';


const QCM = () => {
  const [fileName, setFileName] = useState(null);
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [mode, setMode] = useState('simple');
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentPage, setCurrentPage] = useState(0);
  const [showAnswers, setShowAnswers] = useState([]);
  const [qcmCompleted, setQcmCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState([]);
  const [documentId, setDocumentId] = useState(null);
  const [generationMethod, setGenerationMethod] = useState('rag'); 
  const [backendStatus, setBackendStatus] = useState('unknown');
  const [errorMessage, setErrorMessage] = useState('');

  // Vérifier le statut du backend au chargement
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Timer effect
  useEffect(() => {
    if (mode !== 'timer' || !questions.length || qcmCompleted) return;
    if (timeLeft === 0) {
      if (currentPage < questions.length - 1) {
        setCurrentPage((prev) => prev + 1);
        setTimeLeft(60);
      } else {
        handleCorrection();
        setQcmCompleted(true);
      }
      return;
    }
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, questions, currentPage, qcmCompleted, mode]);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/qdrant-info');
      if (response.ok) {
        setBackendStatus('connected');
        const data = await response.json();
        console.log('Backend connecté:', data);
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      console.warn('Backend non accessible, mode offline:', error);
      setBackendStatus('offline');
    }
  };

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFileName(file ? file.name : null);
    setErrorMessage('');
  };

  const validateFile = (file) => {
    if (!file) {
      throw new Error('Veuillez sélectionner un fichier PDF.');
    }
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Seuls les fichiers PDF sont acceptés.');
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB max
      throw new Error('Le fichier est trop volumineux (max 50MB).');
    }
    
    if (file.size < 1000) { // 1KB min
      throw new Error('Le fichier semble être vide ou corrompu.');
    }
  };

  const handleGenerateQCM = async () => {
    const file = document.getElementById('qcm-upload').files[0];
    
    try {
      validateFile(file);
      setIsLoading(true);
      setErrorMessage('');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('num_questions', numQuestions.toString());

      const response = await fetch('http://127.0.0.1:8000/api/generate-qcm', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log('QCM généré:', data);
      
      if (!data.qcm || !Array.isArray(data.qcm) || data.qcm.length === 0) {
        throw new Error('Aucune question n\'a pu être générée à partir de ce document.');
      }

      // Traitement des questions reçues
      const processedQuestions = data.qcm.map((q, index) => ({
        ...q,
        id: index,
        explanation: q.explanation || "Cette réponse est basée sur l'analyse du contenu du document.",
        source_text: q.source_text || null,
        // S'assurer que les options sont bien formatées
        options: typeof q.options === 'object' ? q.options : {
          a: q.option_a || 'Option A',
          b: q.option_b || 'Option B', 
          c: q.option_c || 'Option C',
          d: q.option_d || 'Option D'
        }
      }));
      
      setQuestions(processedQuestions);
      setUserAnswers(new Array(processedQuestions.length).fill(null));
      setShowAnswers(new Array(processedQuestions.length).fill(false));
      setShowExplanation(new Array(processedQuestions.length).fill(false));
      setScore(null);
      setTimeLeft(60);
      setCurrentPage(0);
      setQcmCompleted(false);
      setDocumentId(data.document_id || null);
      
    } catch (error) {
      console.error('Erreur lors de la génération du QCM:', error);
      setErrorMessage(error.message || 'Erreur de connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionChange = (index, value) => {
    const newAnswers = [...userAnswers];
    newAnswers[index] = value;
    setUserAnswers(newAnswers);
  };
  
  const handleCorrection = () => {
    const calculatedScore = questions.reduce((acc, q, i) => {
      const selectedKey = (userAnswers[i] || '').trim().toLowerCase();
      const correctKey = (q.correct_answer || '').trim().toLowerCase();
      return acc + (selectedKey === correctKey ? 1 : 0);
    }, 0);

    setScore(calculatedScore);
    setQcmCompleted(true);
  };
  
  const handleNext = () => {
    if (currentPage < questions.length - 1) {
      setCurrentPage(currentPage + 1);
      setTimeLeft(60);
    } else {
      handleCorrection();
    }
  };

  const exportPDF = () => {
    // Simple export function - you might want to implement jsPDF here
    const content = questions.map((q, i) => 
      `${i + 1}. ${q.question}\n` +
      `Votre réponse: ${userAnswers[i] || 'Non répondu'}\n` +
      `Bonne réponse: ${q.correct_answer}\n` +
      `Explication: ${q.explanation}\n\n`
    ).join('');
    
    const blob = new Blob([`Résultats du QCM\n\nScore: ${score}/${questions.length}\n\n${content}`], 
      { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultats_qcm.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrev = () => {
    if (mode === 'simple' && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const toggleAnswer = (index) => {
    const newShow = [...showAnswers];
    newShow[index] = !newShow[index];
    setShowAnswers(newShow);
  };

  const toggleExplanation = (index) => {
    const newShow = [...showExplanation];
    newShow[index] = !newShow[index];
    setShowExplanation(newShow);
  };

  const resetQCM = () => {
    setQuestions([]);
    setUserAnswers([]);
    setScore(null);
    setCurrentPage(0);
    setQcmCompleted(false);
    setShowAnswers([]);
    setShowExplanation([]);
    setFileName(null);
    setErrorMessage('');
    document.getElementById('qcm-upload').value = '';
  };

  const getScoreColor = () => {
    if (score === null) return 'text-gray-600';
    const percentage = (score / questions.length) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreEmoji = () => {
    if (score === null) return '📊';
    const percentage = (score / questions.length) * 100;
    if (percentage >= 90) return '🏆';
    if (percentage >= 80) return '🎉';
    if (percentage >= 60) return '👍';
    return '📚';
  };

  return (
        <>
    <Navbar/>
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex flex-col min-h-screen bg-gradient-to-br from-sky-50 to-blue-100"
    >
      {/* Status Bar */}
      <div className="bg-white border-b border-blue-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected' ? 'bg-green-500' : 
                backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              Backend: {
                backendStatus === 'connected' ? 'Connecté (RAG activé)' :
                backendStatus === 'offline' ? 'Hors ligne' : 'Vérification...'
              }
            </span>
          </div>
          {documentId && (
            <span className="text-gray-600">
              Document ID: {documentId.substring(0, 8)}...
            </span>
          )}
        </div>
      </div>

      <main className="flex-grow flex justify-center px-4 py-10">
        <motion.div layout className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
          {/* Partie Gauche - Formulaire */}
          <motion.div layout className="flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-blue-800 mb-4">📎 Importer un PDF</h2>
              <div className="border-2 border-dashed border-teal-500 rounded-lg p-4 text-center hover:bg-blue-50 transition duration-300">
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={handleFileChange} 
                  className="hidden" 
                  id="qcm-upload" 
                />
                <label htmlFor="qcm-upload" className="cursor-pointer text-teal-600 font-semibold">
                  {fileName ? `📄 ${fileName}` : 'Cliquez ici pour importer un fichier PDF'}
                </label>
                <p className="text-xs text-gray-500 mt-2">Max 50MB • Format PDF uniquement</p>
              </div>
            </div>

            <div>
              <label className="block text-blue-800 font-medium mb-2 mt-4">🔢 Nombre de questions</label>
              <select 
                value={numQuestions} 
                onChange={(e) => setNumQuestions(parseInt(e.target.value))} 
                className="w-full p-3 border border-blue-200 rounded-lg focus:border-teal-500 focus:ring focus:ring-teal-200 focus:ring-opacity-50"
              >
                {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </div>

            <div>
              <label className="block text-blue-800 font-medium mb-2 mt-4">🕹️ Mode</label>
              <select 
                value={mode} 
                onChange={(e) => setMode(e.target.value)} 
                className="w-full p-3 border border-blue-200 rounded-lg focus:border-teal-500 focus:ring focus:ring-teal-200 focus:ring-opacity-50"
              >
                <option value="simple">QCM simple</option>
                <option value="timer">QCM avec timer (60s/question)</option>
              </select>
            </div>

            {/* Messages d'erreur */}
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-3"
              >
                <p className="text-red-700 text-sm">❌ {errorMessage}</p>
              </motion.div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={handleGenerateQCM} 
                disabled={isLoading || !fileName} 
                className={`flex-1 px-6 py-3 rounded-xl text-white flex items-center justify-center gap-2 transition shadow-lg ${
                  isLoading || !fileName
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {isLoading ? <Spinner /> : '🎯 Générer le QCM'}
              </button>
              
              {(questions.length > 0 || qcmCompleted) && (
                <button 
                  onClick={resetQCM}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  🔄
                </button>
              )}
            </div>
          </motion.div>

          {/* Partie Droite - QCM */}
          <motion.div layout className="bg-sky-50 rounded-lg p-6 border border-blue-100 overflow-y-auto max-h-[600px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-3xl font-bold text-blue-800">✅ QCM Généré</h2>
              {questions.length > 0 && (
                <span className="text-sm text-gray-600">
                  {qcmCompleted ? `${score}/${questions.length}` : `${currentPage + 1}/${questions.length}`}
                </span>
              )}
            </div>

            {questions.length > 0 && score === null && mode === 'timer' && (
              <div className="text-red-600 font-bold mb-4 text-center text-xl animate-pulse">
                🕒 Temps restant : {formatTime(timeLeft)}
              </div>
            )}

            {questions.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div 
                  key={qcmCompleted ? 'results' : currentPage} 
                  initial={{ opacity: 0, x: 100 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -100 }} 
                  transition={{ duration: 0.3 }}
                >
                  {!qcmCompleted ? (
                    <div className="bg-white p-6 mb-4 rounded-xl shadow-md border border-blue-200">
                      <h3 className="text-lg font-semibold text-blue-700 mb-4">
                        Question {currentPage + 1}: {questions[currentPage].question}
                      </h3>
                      
                      {Object.entries(questions[currentPage].options).map(([key, val]) => (
                        <div key={key} className="mt-3">
                          <label className="inline-flex items-center space-x-3 cursor-pointer hover:bg-blue-50 p-2 rounded-lg transition">
                            <input 
                              type="radio" 
                              name={`q${currentPage}`} 
                              value={key} 
                              checked={userAnswers[currentPage] === key} 
                              onChange={() => handleOptionChange(currentPage, key)}
                              className="text-teal-600 focus:ring-teal-500" 
                            />
                            <span className="text-gray-700">{key.toUpperCase()}) {val}</span>
                          </label>
                        </div>
                      ))}

                      <div className="mt-6 flex justify-between items-center">
                        <button 
                          onClick={handlePrev} 
                          disabled={mode === 'timer' || currentPage === 0} 
                          className="text-blue-600 hover:underline disabled:text-gray-400 flex items-center gap-1"
                        >
                          ⬅️ Précédent
                        </button>
                        
                        {mode === 'simple' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => toggleAnswer(currentPage)} 
                              className="text-teal-600 underline text-sm"
                            >
                              {showAnswers[currentPage] ? 'Cacher la réponse' : 'Voir la réponse'}
                            </button>
                            {showAnswers[currentPage] && (
                              <button 
                                onClick={() => toggleExplanation(currentPage)} 
                                className="text-blue-600 underline text-sm"
                              >
                                {showExplanation[currentPage] ? 'Cacher l\'explication' : 'Voir l\'explication'}
                              </button>
                            )}
                          </div>
                        )}
                        
                        <button 
                          onClick={handleNext} 
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {currentPage === questions.length - 1 ? 'Terminer' : 'Suivant'} ➡️
                        </button>
                      </div>

                      {mode === 'simple' && showAnswers[currentPage] && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg">
                          <p className="text-teal-600 font-semibold">
                            ✅ Bonne réponse : {questions[currentPage].correct_answer.toUpperCase()}) {questions[currentPage].options[questions[currentPage].correct_answer]}
                          </p>
                          
                          {showExplanation[currentPage] && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3"
                            >
                              <h4 className="font-medium text-blue-800 mb-2">💡 Explication :</h4>
                              <p className="text-gray-700 mb-3">
                                {questions[currentPage].explanation}
                              </p>
                              {questions[currentPage].source_text && (
                                <div className="p-3 bg-white rounded border-l-4 border-teal-500">
                                  <strong className="text-sm text-gray-600">📖 Source :</strong>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {questions[currentPage].source_text}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Affichage des résultats
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      className="text-center"
                    >
                      <div className="bg-white p-6 rounded-xl shadow-md mb-6">
                        <div className="text-6xl mb-4">{getScoreEmoji()}</div>
                        <p className={`text-3xl font-bold ${getScoreColor()}`}>
                          Score : {score} / {questions.length}
                        </p>
                        <p className="text-gray-600 mt-2">
                          {((score / questions.length) * 100).toFixed(1)}% de réussite
                        </p>
                      </div>
                      
                      {/* Récapitulatif détaillé */}
                      <div className="text-left">
                        <h3 className="text-lg font-semibold mb-4 text-blue-800">📋 Récapitulatif détaillé</h3>
                        <div className="space-y-4 max-h-80 overflow-y-auto">
                          {questions.map((q, idx) => {
                            const isCorrect = userAnswers[idx] === q.correct_answer;
                            return (
                              <div 
                                key={idx} 
                                className={`p-4 rounded-lg shadow-sm border-l-4 ${
                                  isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
                                }`}
                              >
                                <p className="font-medium text-gray-800">
                                  {idx + 1}. {q.question}
                                </p>
                                <div className="mt-2 text-sm">
                                  <p className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                                    {isCorrect ? '✅' : '❌'} Votre réponse : {userAnswers[idx] ? 
                                      `${userAnswers[idx].toUpperCase()}) ${q.options[userAnswers[idx]]}` : 
                                      'Non répondu'
                                    }
                                  </p>
                                  {!isCorrect && (
                                    <p className="text-green-600 mt-1">
                                      ✅ Bonne réponse : {q.correct_answer.toUpperCase()}) {q.options[q.correct_answer]}
                                    </p>
                                  )}
                                </div>
                                <details className="mt-2">
                                  <summary className="text-blue-600 cursor-pointer hover:underline text-sm">
                                    Voir l'explication
                                  </summary>
                                  <div className="mt-2 p-3 bg-white rounded text-sm border">
                                    <p className="text-gray-700">{q.explanation}</p>
                                    {q.source_text && (
                                      <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                                        <strong className="text-xs text-blue-700">Source :</strong>
                                        <p className="text-xs text-blue-600 mt-1">{q.source_text}</p>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      <button 
                        onClick={exportPDF} 
                        className="mt-6 bg-teal-600 text-white px-6 py-3 rounded-xl hover:bg-teal-700 transition shadow-lg"
                      >
                        📄 Exporter les résultats
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-500">Aucun QCM généré pour l'instant.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Importez un PDF et cliquez sur "Générer le QCM" pour commencer.
                </p>
              </div>
            )}

            {score === null && questions.length > 0 && !qcmCompleted && (
              <button 
                onClick={handleCorrection} 
                className="bg-teal-600 text-white px-8 py-3 rounded-xl mt-4 w-full hover:bg-teal-700 transition shadow-lg"
              >
                🎯 Corriger maintenant
              </button>
            )}
          </motion.div>
        </motion.div>
      </main>
    </motion.div>
          <ChatInterface />

        <Footer/>
    </>
  );
};

const Spinner = () => (
  <div className="flex items-center justify-center space-x-2">
    <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
    <span>Génération en cours...</span>
  </div>
);

export default QCM;