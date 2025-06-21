import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ChatInterface from '../components/ChatInterface';

import { 
  Search, Book, FileText, CheckSquare, FileQuestion, 
  Loader, AlertCircle, Download, Star, ExternalLink,
  Settings, Filter, Bookmark, Share2, Eye, Clock,
  TrendingUp, Award, ChevronDown, RefreshCw
} from 'lucide-react';

const AISearchAgent = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('courses');
  const [maxResults, setMaxResults] = useState(5);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [savedResults, setSavedResults] = useState([]);
  const [searchStats, setSearchStats] = useState(null);
  
  // URL de l'API FastAPI
  const API_URL = 'http://127.0.0.1:8000/api/search';
  const HEALTH_URL = 'http://127.0.0.1:8000/api/search/health';
  
  const searchCategories = [
    { 
      id: 'courses', 
      label: 'Cours', 
      icon: <Book size={18} />, 
      color: 'blue',
      description: 'Supports pédagogiques et cours complets'
    },
    { 
      id: 'exams', 
      label: 'Examens', 
      icon: <FileText size={18} />, 
      color: 'red',
      description: 'Sujets d\'examen et corrigés'
    },
    { 
      id: 'qcm', 
      label: 'QCMs', 
      icon: <CheckSquare size={18} />, 
      color: 'green',
      description: 'Questionnaires à choix multiples'
    },
    { 
      id: 'summaries', 
      label: 'Résumés', 
      icon: <FileQuestion size={18} />, 
      color: 'purple',
      description: 'Fiches de révision et synthèses'
    }
  ];

  const maxResultsOptions = [3, 5, 10, 15, 20];
  const sortOptions = [
    { value: 'relevance', label: 'Pertinence', icon: <TrendingUp size={16} /> },
    { value: 'title', label: 'Titre (A-Z)', icon: <Book size={16} /> },
    { value: 'source', label: 'Source', icon: <ExternalLink size={16} /> }
  ];

  // Vérifier la santé de l'API au démarrage
  useEffect(() => {
    checkAPIHealth();
    loadSearchHistory();
    loadSavedResults();
  }, []);

  const checkAPIHealth = async () => {
    try {
      const response = await fetch(HEALTH_URL);
      if (!response.ok) {
        setError("⚠️ Serveur API non disponible. Vérifiez que FastAPI est démarré.");
      }
    } catch (err) {
      setError("⚠️ Impossible de connecter au serveur. Démarrez le backend FastAPI.");
    }
  };

  const loadSearchHistory = () => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  };

  const loadSavedResults = () => {
    const saved = localStorage.getItem('savedResults');
    if (saved) {
      setSavedResults(JSON.parse(saved));
    }
  };

  const saveSearchToHistory = (searchQuery, searchType, resultsCount) => {
    const historyItem = {
      query: searchQuery,
      searchType,
      resultsCount,
      timestamp: new Date().toISOString()
    };
    
    const newHistory = [historyItem, ...searchHistory.slice(0, 9)]; // Garder les 10 dernières
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const performSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          search_type: searchType,
          max_results: maxResults
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const data = await response.json();
      const searchTime = Date.now() - startTime;
      
      setResults(data.results || []);
      setSearchStats({
        totalFound: data.total_found,
        searchTime: searchTime,
        summary: data.analysis_summary
      });
      
      // Sauvegarder dans l'historique
      saveSearchToHistory(query, searchType, data.results?.length || 0);
      
    } catch (err) {
      setError("Une erreur s'est produite lors de la recherche. Vérifiez que le serveur FastAPI est bien démarré.");
      console.error("Erreur de recherche:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const saveResult = (result) => {
    const saved = {
      ...result,
      savedAt: new Date().toISOString(),
      searchQuery: query
    };
    
    const newSaved = [saved, ...savedResults.filter(r => r.url !== result.url)];
    setSavedResults(newSaved);
    localStorage.setItem('savedResults', JSON.stringify(newSaved));
  };

  const isResultSaved = (url) => {
    return savedResults.some(r => r.url === url);
  };

  const sortResults = (results) => {
    switch (sortBy) {
      case 'title':
        return [...results].sort((a, b) => a.title.localeCompare(b.title));
      case 'source':
        return [...results].sort((a, b) => a.source.localeCompare(b.source));
      case 'relevance':
      default:
        return [...results].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const getCategoryColor = (categoryId) => {
    const category = searchCategories.find(c => c.id === categoryId);
    return category?.color || 'blue';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
        <>
      <Navbar />
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header amélioré */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                  <Search className="text-white" size={24} />
                </div>
                Agent de Recherche Intelligent
              </h1>
              <p className="text-gray-600 mt-2">
                Recherchez des ressources éducatives avec analyse IA avancée
              </p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="bg-gray-100 hover:bg-gray-200 p-3 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Panneau de paramètres */}
          {showSettings && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Settings size={18} />
                Paramètres de recherche
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de résultats
                  </label>
                  <select
                    value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {maxResultsOptions.map(num => (
                      <option key={num} value={num}>{num} résultats</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trier par
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={checkAPIHealth}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Tester API
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Barre de recherche améliorée */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Entrez votre requête de recherche..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pl-12 text-lg"
              />
              <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
            </div>
            <button
              onClick={performSearch}
              disabled={isLoading || !query.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              {isLoading ? (
                <Loader className="animate-spin mr-2" size={20} />
              ) : (
                <Search className="mr-2" size={20} />
              )}
              {isLoading ? 'Recherche...' : 'Rechercher'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar gauche */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Catégories de recherche */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Filter size={18} />
                Catégories
              </h3>
              <div className="space-y-2">
                {searchCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSearchType(category.id)}
                    className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-all duration-200 text-left ${
                      searchType === category.id 
                        ? `bg-${category.color}-100 text-${category.color}-700 border border-${category.color}-300 shadow-sm` 
                        : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category.icon}
                    <div>
                      <div className="font-medium">{category.label}</div>
                      <div className="text-xs opacity-75">{category.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Historique de recherche */}
            {searchHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Clock size={18} />
                    Historique
                  </h3>
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Effacer
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(item.query);
                        setSearchType(item.searchType);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      <div className="font-medium text-gray-800 truncate">
                        {item.query}
                      </div>
                      <div className="text-gray-500 text-xs flex items-center justify-between">
                        <span className={`text-${getCategoryColor(item.searchType)}-600`}>
                          {searchCategories.find(c => c.id === item.searchType)?.label}
                        </span>
                        <span>{item.resultsCount} résultats</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contenu principal */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Message d'information */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-6 rounded-lg">
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-4">
                  <Award className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-blue-800">Agents IA en action</p>
                  <p className="text-blue-700 mt-1">
                    Notre équipe d'agents IA utilise SerpAPI et Gemini pour rechercher, analyser et classer les meilleures ressources éducatives selon vos critères.
                  </p>
                </div>
              </div>
            </div>

            {/* Statistiques de recherche */}
            {searchStats && !isLoading && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{results.length}</div>
                    <div className="text-sm text-gray-600">Résultats affichés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{searchStats.totalFound}</div>
                    <div className="text-sm text-gray-600">Total trouvés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{searchStats.searchTime}ms</div>
                    <div className="text-sm text-gray-600">Temps de recherche</div>
                  </div>
                </div>
                {searchStats.summary && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Analyse IA:</span> {searchStats.summary}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Messages d'erreur */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-6 text-red-700 rounded-lg">
                <div className="flex">
                  <AlertCircle className="mr-3 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <p className="font-medium">Une erreur est survenue</p>
                    <p className="mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* État de chargement */}
            {isLoading && (
              <div className="bg-white rounded-xl shadow-lg p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative">
                    <Loader className="animate-spin text-blue-600 mb-4" size={48} />
                    <div className="absolute inset-0 animate-ping">
                      <Loader className="text-blue-300" size={48} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-gray-800 mb-2">
                      Recherche et analyse en cours...
                    </p>
                    <p className="text-gray-600">
                      Les agents IA analysent les meilleures ressources pour vous
                    </p>
                    <div className="mt-4 flex items-center justify-center space-x-1">
                      <div className="animate-bounce bg-blue-500 w-2 h-2 rounded-full"></div>
                      <div className="animate-bounce bg-blue-500 w-2 h-2 rounded-full" style={{animationDelay: '0.1s'}}></div>
                      <div className="animate-bounce bg-blue-500 w-2 h-2 rounded-full" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Résultats de recherche */}
            {!isLoading && results.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <span>Résultats ({results.length})</span>
                    <span className="bg-gradient-to-r from-green-100 to-blue-100 text-green-800 text-sm px-3 py-1 rounded-full flex items-center gap-1">
                      <Award size={14} />
                      Analysés par IA
                    </span>
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {sortResults(results).map((result, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-grow">
                            <h4 className="text-lg font-semibold text-blue-600 hover:text-blue-700 mb-2">
                              <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                {result.title}
                                <ExternalLink size={16} />
                              </a>
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <ExternalLink size={14} />
                                {result.source}
                              </span>
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                {result.fileType}
                              </span>
                              {result.relevanceScore && (
                                <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                  <Star size={14} />
                                  {(result.relevanceScore * 100).toFixed(0)}% pertinent
                                </span>
                              )}
                            </div>
                            
                            <p className="text-gray-700 mb-3 leading-relaxed">{result.description}</p>
                            
                            {result.analysis && (
                              <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
                                <p className="text-sm text-green-800">
                                  <span className="font-medium">Analyse IA:</span> {result.analysis}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <Download size={16} />
                            Accéder à la ressource
                          </a>
                          
                          <button 
                            onClick={() => saveResult(result)}
                            disabled={isResultSaved(result.url)}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                              isResultSaved(result.url)
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                            }`}
                          >
                            <Bookmark size={16} />
                            {isResultSaved(result.url) ? 'Sauvegardé' : 'Sauvegarder'}
                          </button>
                          
                          <button className="bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center gap-2 transition-colors">
                            <Eye size={16} />
                            Aperçu
                          </button>
                          
                          <button className="bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 flex items-center gap-2 transition-colors">
                            <Share2 size={16} />
                            Partager
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Aucun résultat */}
            {!isLoading && query && results.length === 0 && !error && (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <FileQuestion size={64} className="mx-auto mb-4 text-gray-400" />
                <p className="text-xl font-semibold text-gray-800 mb-2">Aucun résultat trouvé</p>
                <p className="text-gray-600 mb-6">
                  Essayez d'autres termes de recherche, changez de catégorie ou augmentez le nombre de résultats.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {searchCategories.filter(c => c.id !== searchType).map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSearchType(category.id)}
                      className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors bg-${category.color}-50 text-${category.color}-700 border-${category.color}-200 hover:bg-${category.color}-100`}
                    >
                      {category.icon}
                      Essayer {category.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
          <ChatInterface />

          <Footer />
        </>
  );
};

export default AISearchAgent;