// src/components/ThemeProvider.js
import React from 'react';

// Définition des constantes de thème pour toute l'application
export const THEME = {
  // Couleurs
  colors: {
    primary: 'blue-600',       // Couleur principale de l'application
    secondary: 'teal-600',     // Couleur secondaire pour les boutons d'action
    accent: 'purple-600',      // Couleur d'accent pour les éléments importants
    success: 'green-600',      // Pour les confirmations et validations
    error: 'red-600',          // Pour les erreurs et alertes
    background: 'bg-gradient-to-br from-blue-50 to-blue-100', // Fond d'écran uniforme
    card: 'white',             // Couleur de fond des cartes
  },
  
  // Typographie
  text: {
    heading: 'text-blue-700',  // Couleur des titres principaux
    subheading: 'text-blue-600', // Couleur des sous-titres
    body: 'text-gray-700',     // Couleur du texte principal
    muted: 'text-gray-500',    // Texte secondaire
  },
  
  // Espacement et tailles
  spacing: {
    section: 'py-10 px-4',     // Espacement des sections
    container: 'max-w-7xl mx-auto', // Conteneur standard
  },
  
  // Styles de composants
  components: {
    // Styles pour les boutons primaires
    primaryButton: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300',
    
    // Styles pour les boutons secondaires
    secondaryButton: 'bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300',
    
    // Styles pour les boutons de succès/validation
    successButton: 'bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300',
    
    // Styles pour les cartes
    card: 'bg-white rounded-xl shadow-md p-6',
    
    // Styles pour les inputs
    input: 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none',
    
    // Styles pour les zones de texte
    textarea: 'w-full border border-gray-300 p-4 rounded-xl resize-none focus:ring-2 focus:ring-blue-400 outline-none',
    
    // Style pour les zones de téléchargement
    uploadArea: 'border-2 border-dashed border-blue-400 rounded-lg p-4 text-center hover:bg-blue-50 transition duration-300',
  }
};

// Composant ThemeProvider pour envelopper votre application
const ThemeProvider = ({ children }) => {
  return (
    <div className={`min-h-screen ${THEME.colors.background}`}>
      {children}
    </div>
  );
};

export default ThemeProvider;