// frontend/src/components/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo3.png'; // Assure-toi que le nom correspond bien au fichier

const Navbar = () => {
  return (
    <nav className="bg-white shadow-md py-4 px-6 flex justify-between items-center">
      {/* Logo & Nom */}
      <Link to="/" className="flex items-center space-x-3">
        <img src={logo} alt="PrepGenius Logo" className="h-10 w-auto rounded-full" />
        <span className="text-2xl font-bold text-blue-800 tracking-wide">PrepGenius</span>
      </Link>

      {/* Navigation links */}
      <div className="flex space-x-6 text-sm md:text-base">
        <Link
          to="/resume"
          className="text-gray-700 hover:text-teal-600 transition font-medium"
        >
          Générateur de Résumé
        </Link>
        <Link
          to="/qcm"
          className="text-gray-700 hover:text-teal-600 transition font-medium"
        >
          QCM / Quiz
        </Link>
        <Link
          to="/web-agent"
          className="text-gray-700 hover:text-teal-600 transition font-medium"
        >
          Recherche Web
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
