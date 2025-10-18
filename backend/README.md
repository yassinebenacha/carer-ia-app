# PrepGenius Backend

API complète pour PrepGenius : analyse de PDF, génération de QCM, résumés, recherches intelligentes et assistant chatbot.

## 🚀 Installation

### Prérequis
- Python 3.8+
- pip (gestionnaire de packages Python)

### Installation des dépendances

```bash
# Cloner le projet
git clone https://github.com/AchrafMenach/pfa-final.git
cd pfa-final/backend

# Installer les dépendances
pip install -r requirements.txt
```

### Configuration des variables d'environnement

1. Copiez le fichier d'exemple :
```bash
cp .env.example .env
```

2. Modifiez le fichier `.env` avec vos clés API :
```env
# Configuration des APIs externes
SERPAPI_KEY=your_serpapi_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## 🏃‍♂️ Démarrage

```bash
# Démarrer le serveur de développement
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ou directement avec Python
cd app
python main.py
```

L'API sera disponible sur : http://localhost:8000

## 📚 Documentation

- **Documentation interactive** : http://localhost:8000/docs
- **Documentation alternative** : http://localhost:8000/redoc

## 🔧 Fonctionnalités

### 📄 Générateur de Résumé de Cours
- Endpoint : `POST /api/summarize/pdf`
- Analyse et résume automatiquement les fichiers PDF

### 🧠 QCM de Compétences
- Endpoint : `POST /api/generate-qcm`
- Génère des questionnaires à choix multiples personnalisés

### 🔍 Assistant de Recherche IA
- Endpoint : `POST /api/search`
- Recherche intelligente avec SerpAPI et analyse Gemini

### 🤖 PrepGenius Bot - Assistant virtuel
- Endpoint : `POST /api/chat`
- Assistant conversationnel intelligent

### ⚡ Health Check
- Endpoint : `GET /health`
- Vérification de l'état des services

## 📦 Dépendances principales

- **FastAPI** : Framework web moderne et rapide
- **Uvicorn** : Serveur ASGI haute performance
- **Google Generative AI** : Intégration Gemini
- **OpenAI** : Intégration GPT
- **Sentence Transformers** : Embeddings de texte
- **Qdrant Client** : Base de données vectorielle
- **PyMuPDF** : Traitement des fichiers PDF
- **Scikit-learn** : Outils d'apprentissage automatique

## 🛠️ Structure du projet

```
backend/
├── app/
│   ├── main.py              # Point d'entrée de l'application
│   ├── routers/             # Endpoints API
│   │   ├── health.py        # Health checks
│   │   ├── qcm.py          # Génération QCM
│   │   ├── summary.py       # Résumés PDF
│   │   ├── search.py        # Recherche IA
│   │   └── chatbot.py       # Assistant virtuel
│   ├── services/            # Services métier
│   │   ├── gemini.py        # Service Gemini
│   │   ├── pdf_extractor.py # Extraction PDF
│   │   ├── embedding.py     # Embeddings
│   │   └── qdrant_service.py # Service Qdrant
│   ├── models/              # Modèles de données
│   └── utils/               # Utilitaires
├── requirements.txt         # Dépendances Python
├── .env.example            # Variables d'environnement
└── README.md               # Documentation
```

## 🔐 Sécurité

- Utilisez des variables d'environnement pour les clés API
- Ne commitez jamais vos clés API dans le code
- Configurez CORS appropriément pour la production

## 🐛 Dépannage

### Erreur d'installation des dépendances
```bash
# Mettre à jour pip
pip install --upgrade pip

# Installer avec verbose pour plus d'informations
pip install -r requirements.txt -v
```

### Problèmes de CORS
Vérifiez la configuration CORS dans `app/main.py` et ajustez les origines autorisées.

## 📞 Support

Pour toute question ou problème, contactez l'équipe de développement :
- Achraf Menach
- Abdellatif Chakor  
- Yassine Benacha
