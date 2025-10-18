import React, { useState, useEffect } from 'react';
import { HashLink as Link } from 'react-router-hash-link';
import { motion } from 'framer-motion';
import ChatInterface from '../components/ChatInterface';
import { User, LogOut, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { auth } from '../components/firebase'; // Importez votre configuration Firebase
import logo from '../assets/logo3.png'; // Assure-toi que le nom correspond bien au fichier


const AuthModal = ({ isOpen, onClose, mode, onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation email
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validation mot de passe
  const isValidPassword = (password) => {
    return password.length >= 6;
  };

  const handleSubmit = async () => {
    setError('');

    // Validations
    if (!email || !password) {
      setError('Veuillez remplir tous les champs requis');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }

    if (!isValidPassword(password)) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setError('Veuillez entrer votre nom d\'affichage');
        return;
      }
      if (!confirmPassword) {
        setError('Veuillez confirmer votre mot de passe');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        // Créer un nouveau compte
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Mettre à jour le profil avec le nom d'affichage
        await updateProfile(userCredential.user, {
          displayName: displayName
        });
      } else {
        // Se connecter
        await signInWithEmailAndPassword(auth, email, password);
      }
      
      // Réinitialiser le formulaire
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setError('');
      onClose();
    } catch (err) {
      // Gestion des erreurs Firebase
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('Cette adresse email est déjà utilisée');
          break;
        case 'auth/weak-password':
          setError('Le mot de passe est trop faible');
          break;
        case 'auth/user-not-found':
          setError('Aucun compte trouvé avec cette adresse email');
          break;
        case 'auth/wrong-password':
          setError('Mot de passe incorrect');
          break;
        case 'auth/invalid-email':
          setError('Adresse email invalide');
          break;
        case 'auth/network-request-failed':
          setError('Erreur de réseau. Vérifiez votre connexion internet');
          break;
        case 'auth/too-many-requests':
          setError('Trop de tentatives. Veuillez réessayer plus tard');
          break;
        case 'auth/invalid-credential':
          setError('Identifiants invalides. Vérifiez votre email et mot de passe');
          break;
        default:
          setError('Une erreur inattendue s\'est produite : ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fermer la modal en cliquant à l'extérieur
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Réinitialiser les champs quand on change de mode
  const handleSwitchMode = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setError('');
    onSwitchMode();
  };

  // Gérer la touche Escape
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Empêcher le scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
            {mode === 'signin' ? (
              <LogIn className="w-8 h-8 text-teal-600" />
            ) : (
              <UserPlus className="w-8 h-8 text-teal-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-blue-800">
            {mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
          </h2>
          <p className="text-gray-600 mt-2">
            {mode === 'signin'
              ? 'Connectez-vous à votre compte PrepGenius'
              : 'Rejoignez PrepGenius et boostez votre carrière'}
          </p>
        </div>

        <div className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'affichage <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                placeholder="Votre nom"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  error && error.includes('email') 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-teal-500'
                }`}
                placeholder="votre@email.com"
                autoComplete="email"
              />
              {email && isValidEmail(email) && (
                <div className="absolute right-3 top-2.5 text-green-500">✓</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  error && error.includes('mot de passe') 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-teal-500'
                }`}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'signup' && password && (
              <div className="mt-1 text-xs">
                <div className={`${isValidPassword(password) ? 'text-green-600' : 'text-red-600'}`}>
                  {isValidPassword(password) ? '✓' : '✗'} Au moins 6 caractères
                </div>
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-teal-500'
                  }`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && (
                <div className="mt-1 text-xs">
                  <div className={`${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                    {password === confirmPassword ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200 flex items-center space-x-2"
            >
              <span className="text-red-500">⚠️</span>
              <span>{error}</span>
            </motion.div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password || (mode === 'signup' && (!confirmPassword || !displayName.trim()))}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Chargement...</span>
              </>
            ) : (
              <span>{mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}</span>
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {mode === 'signin' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}
            <button
              onClick={handleSwitchMode}
              className="text-teal-600 hover:text-teal-700 font-medium ml-1 underline"
            >
              {mode === 'signin' ? 'S\'inscrire gratuitement' : 'Se connecter'}
            </button>
          </p>
          
          {mode === 'signin' && (
            <button className="text-sm text-gray-500 hover:text-teal-600 mt-2 underline">
              Mot de passe oublié ?
            </button>
          )}
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Fermer"
        >
          <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        {/* Indication pour fermer */}
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
          Appuyez sur Échap ou cliquez à l'extérieur pour fermer
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ user, onSignOut, onOpenAuth }) => {
  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 text-2xl font-bold text-teal-600">
              <img src={logo} alt="PrepGenius Logo" className="h-10 w-10 rounded-full" />
              <span>PrepGenius</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Déconnexion</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="flex items-center space-x-1 text-teal-600 hover:text-teal-700 transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Connexion</span>
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="flex items-center space-x-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded-lg transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Inscription</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p>&copy; 2024 PrepGenius. Tous droits réservés.</p>
      </div>
    </footer>
  );
};

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const handleOpenAuth = (mode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleSwitchMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent"></div>
          <span className="text-teal-600 font-medium">Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} onSignOut={handleSignOut} onOpenAuth={handleOpenAuth} />
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 flex flex-col items-center">
        {/* Hero Section */}
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full px-6 py-20 text-center max-w-4xl"
        >
          <h1 className="text-5xl font-bold text-blue-800 leading-tight">
            Révélez votre potentiel de carrière avec <br />
            <span className="text-teal-600">PrepGenius</span>
          </h1>
          <p className="text-gray-600 mt-6 text-lg">
            Plateforme intelligente pour booster votre carrière : résumés, QCMs, et assistant IA.
          </p>
          
          {user ? (
            <div className="mt-8 space-y-4">
              <p className="text-teal-700 font-medium">
                Bienvenue, {user.displayName || user.email} ! 👋
              </p>
              <Link
                to="#tools"
                className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3 rounded-xl transition shadow-lg"
              >
                🚀 Accéder à vos outils
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => handleOpenAuth('signup')}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3 rounded-xl transition shadow-lg"
                >
                  🚀 Commencer gratuitement
                </button>
                <button
                  onClick={() => handleOpenAuth('signin')}
                  className="bg-white hover:bg-gray-50 text-teal-600 font-semibold px-8 py-3 rounded-xl transition shadow-lg border-2 border-teal-600"
                >
                  Se connecter
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Créez votre compte pour accéder à tous nos outils
              </p>
            </div>
          )}
        </motion.header>

        {/* Tools Section */}
        <section id="tools" className="w-full max-w-7xl px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-blue-800">🛠️ Nos Outils</h2>
            <p className="text-gray-500 mt-2">Tout ce dont vous avez besoin pour avancer dans votre carrière</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Résumé */}
            <motion.div whileHover={{ scale: 1.03 }} className="bg-white shadow-xl rounded-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-blue-700 mb-2">📄 Générateur de Résumé</h3>
              <p className="text-gray-600 mb-4">
                Créez un résumé professionnel en quelques clics avec l'aide de l'IA.
              </p>
              {user ? (
                <Link
                  to="/resume"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg"
                >
                  Lancer l'outil
                </Link>
              ) : (
                <button
                  onClick={() => handleOpenAuth('signup')}
                  className="bg-gray-400 text-white px-5 py-2 rounded-lg cursor-not-allowed"
                >
                  Connexion requise
                </button>
              )}
            </motion.div>

            {/* QCM */}
            <motion.div whileHover={{ scale: 1.03 }} className="bg-white shadow-xl rounded-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-blue-700 mb-2">🧠 QCM de Compétences</h3>
              <p className="text-gray-600 mb-4">
                Testez vos connaissances avec des QCM personnalisés et recevez un feedback instantané.
              </p>
              {user ? (
                <Link
                  to="/qcm"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg"
                >
                  Faire un quiz
                </Link>
              ) : (
                <button
                  onClick={() => handleOpenAuth('signup')}
                  className="bg-gray-400 text-white px-5 py-2 rounded-lg cursor-not-allowed"
                >
                  Connexion requise
                </button>
              )}
            </motion.div>

            {/* Recherche Web */}
            <motion.div whileHover={{ scale: 1.03 }} className="bg-white shadow-xl rounded-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-blue-700 mb-2">🔎 Assistant Recherche Web</h3>
              <p className="text-gray-600 mb-4">
                Gagnez du temps dans votre recherche d'emploi grâce à notre IA filtrante.
              </p>
              {user ? (
                <Link
                  to="/web-agent"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg"
                >
                  Utiliser l'assistant
                </Link>
              ) : (
                <button
                  onClick={() => handleOpenAuth('signup')}
                  className="bg-gray-400 text-white px-5 py-2 rounded-lg cursor-not-allowed"
                >
                  Connexion requise
                </button>
              )}
            </motion.div>
          </div>
        </section>

        {/* Avantages pour les utilisateurs connectés */}
        {user && (
          <section className="w-full max-w-7xl px-6 py-16 bg-white rounded-2xl shadow-lg mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-blue-800">✨ Vos avantages</h2>
              <p className="text-gray-600 mt-2">En tant qu'utilisateur connecté, profitez de :</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-teal-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💾</span>
                </div>
                <h3 className="font-semibold text-blue-700">Sauvegarde automatique</h3>
                <p className="text-sm text-gray-600">Vos résumés sont sauvegardés</p>
              </div>
              
              <div className="text-center">
                <div className="bg-teal-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-semibold text-blue-700">Suivi des progrès</h3>
                <p className="text-sm text-gray-600">Analysez vos performances</p>
              </div>
              
              <div className="text-center">
                <div className="bg-teal-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="font-semibold text-blue-700">Recommandations</h3>
                <p className="text-sm text-gray-600"></p>
              </div>
              
              <div className="text-center">
                <div className="bg-teal-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🚀</span>
                </div>
                <h3 className="font-semibold text-blue-700">Accès prioritaire</h3>
                <p className="text-sm text-gray-600">Nouvelles fonctionnalités en avant-première</p>
              </div>
            </div>
          </section>
        )}
      </div>
      

      <ChatInterface />
          <Footer />
   
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onSwitchMode={handleSwitchMode}
      />
    </>
  );
};

export default HomePage;