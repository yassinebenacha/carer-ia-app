# 🎓 PrepGenius - Intelligent Learning Platform

<div align="center">

![PrepGenius Logo](./my-project/src/assets/logo3.png)

**Révélez votre potentiel de carrière avec PrepGenius**

*Une plateforme intelligente pour booster votre carrière : résumés, QCMs, recherche web IA et assistant virtuel*

[![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Modern-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Table of Contents

- [🌟 Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [📦 Project Structure](#-project-structure)
- [🔧 Technologies](#-technologies)
- [📚 API Documentation](#-api-documentation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🌟 Features

### 📄 **Générateur de Résumé de Cours**
Analysez et résumez automatiquement vos fichiers PDF avec l'IA. Obtenez des résumés concis et structurés en quelques secondes.

### 🧠 **QCM de Compétences**
Générez des questionnaires à choix multiples personnalisés basés sur vos documents. Testez vos connaissances et améliorez votre apprentissage.

### 🔍 **Assistant de Recherche IA**
Recherche intelligente avec SerpAPI et analyse Gemini. Trouvez les informations les plus pertinentes sur le web.

### 🤖 **CarerBot - Assistant Virtuel**
Assistant conversationnel intelligent pour répondre à vos questions et vous guider dans votre apprentissage.

### ⚡ **Health Check**
Vérification en temps réel de l'état des services et de la disponibilité de l'API.

---

## 🏗️ Architecture

```
Career-IA/
├── 📁 backend/                 # API FastAPI
│   ├── app/
│   │   ├── main.py            # Point d'entrée
│   │   ├── routers/           # Endpoints API
│   │   │   ├── health.py      # Health checks
│   │   │   ├── qcm.py         # Génération QCM
│   │   │   ├── summary.py     # Résumés PDF
│   │   │   ├── search.py      # Recherche IA
│   │   │   └── chatbot.py     # Assistant virtuel
│   │   ├── services/          # Services métier
│   │   │   ├── gemini.py      # Service Gemini
│   │   │   ├── pdf_extractor.py
│   │   │   ├── embedding.py   # Embeddings
│   │   │   └── qdrant_service.py
│   │   ├── models/            # Modèles de données
│   │   └── utils/             # Utilitaires
│   └── requirements.txt
│
└── 📁 my-project/              # Frontend React
    ├── src/
    │   ├── pages/             # Pages principales
    │   │   ├── HomePage.jsx
    │   │   ├── Resume.jsx
    │   │   ├── QCM.jsx
    │   │   └── AISearchAgent.jsx
    │   ├── components/        # Composants réutilisables
    │   │   ├── ChatInterface.jsx
    │   │   ├── Navbar.jsx
    │   │   └── Footer.jsx
    │   ├── services/          # Services API
    │   └── assets/            # Images et logos
    └── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (Backend)
- **Node.js 14+** (Frontend)
- **npm** ou **yarn**

### Backend Setup

```bash
# Naviguer vers le dossier backend
cd backend

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés API (SERPAPI_KEY, GEMINI_API_KEY, OPENAI_API_KEY)

# Démarrer le serveur
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**API disponible sur:** `http://localhost:8000`
**Documentation interactive:** `http://localhost:8000/docs`

### Frontend Setup

```bash
# Naviguer vers le dossier frontend
cd my-project

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start
```

**Application disponible sur:** `http://localhost:3000`

---

## 📦 Project Structure

### Backend - FastAPI
- **Framework:** FastAPI + Uvicorn
- **Validation:** Pydantic
- **IA/ML:** Google Generative AI, OpenAI, Sentence Transformers
- **Base de données:** Qdrant (vectorielle)
- **PDF:** PyMuPDF
- **Recherche:** SerpAPI

### Frontend - React
- **Framework:** React 18.3+
- **Routing:** React Router v7
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Auth:** Firebase
- **HTTP Client:** Axios
- **Export:** jsPDF, html2canvas

---

## 🔧 Technologies

| Catégorie | Technologies |
|-----------|--------------|
| **Backend** | FastAPI, Uvicorn, Python 3.8+ |
| **Frontend** | React, React Router, Tailwind CSS |
| **IA/ML** | Google Gemini, OpenAI GPT, Sentence Transformers |
| **Database** | Qdrant (Vector DB) |
| **Auth** | Firebase |
| **APIs** | SerpAPI, Google Generative AI, OpenAI |
| **Tools** | PyMuPDF, Scikit-learn, Framer Motion |

---

## 📚 API Documentation

### Endpoints Principaux

#### 📄 Résumés
```
POST /api/summarize/pdf
```
Génère un résumé d'un fichier PDF.

#### 🧠 QCM
```
POST /api/generate-qcm
```
Génère un questionnaire à choix multiples.

#### 🔍 Recherche
```
POST /api/search
GET /api/search/types
```
Effectue une recherche intelligente.

#### 🤖 ChatBot
```
POST /api/chat
GET /api/chat/history/{session_id}
POST /api/chat/new-session
```
Interaction avec l'assistant virtuel.

#### ⚡ Health
```
GET /health
```
Vérification de l'état des services.

**Documentation complète:** `http://localhost:8000/docs`

---

## 🤝 Contributing

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add AmazingFeature'`)
4. Poussez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📄 License

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

<div align="center">

### 🌟 Aimez ce projet ? Donnez-lui une ⭐ !

**PrepGenius** - Révélez votre potentiel de carrière avec l'IA

[⬆ Retour en haut](#-prepgenius---intelligent-learning-platform)

</div>

