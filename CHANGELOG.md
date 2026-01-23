# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### En cours de développement
- Aucune modification en cours

---

## [2.1.0] - 2026-01-23

### ✨ Ajouté

#### Gestion de Projets
- Création, édition et suppression de projets de prospection
- Statuts de projets : actif, terminé, archivé
- Attribution de couleurs personnalisées aux projets
- Organisation des parcelles par projet
- Composant `ProjectsPanel.tsx` pour la gestion visuelle

#### Tableau de Bord Amélioré
- Dashboard interactif avec graphiques (Recharts)
- KPIs visuels : transactions, prix moyen, prix/m², surface moyenne
- Graphique d'évolution des prix par année (courbe)
- Graphique de répartition par type de bien (camembert)
- Graphique du nombre de transactions par année (barres)
- 3 onglets : Vue d'ensemble, Évolution, Répartition
- Composant `Dashboard.tsx`

#### Historique & Alertes
- Historique automatique des 50 dernières recherches avec horodatage
- Système d'alertes personnalisées par commune
- Configuration de critères de filtrage pour les alertes
- Activation/désactivation des alertes
- Composants `HistoryPanel.tsx` et `AlertsPanel.tsx`

#### Rapports PDF Professionnels
- Backend : Générateur de PDF avec ReportLab
- Templates personnalisables avec branding
- Contenu : statistiques détaillées, évolution des prix, liste des parcelles
- Export automatique avec nom de projet personnalisé
- Module backend `report_generator.py`
- Endpoint API `/api/reports/generate`
- Composant frontend `ReportGenerator.tsx`

#### Données Enrichies
- API démographiques : population, densité, surface (via API Geo)
- Intégration photos aériennes IGN Géoportail (WMS/WMTS)
- Calcul du potentiel de développement avec score
- Facteurs de calcul : activité marché, évolution prix, densité, diversité
- 3 nouveaux endpoints backend :
  - `/api/enrichissement/demographics/{code_insee}`
  - `/api/enrichissement/aerial-photos`
  - `/api/enrichissement/potential/{code_insee}`

#### Interface Moderne
- Mode sombre/clair avec toggle dans le header
- ThemeProvider React pour gestion du thème
- Support dark mode Tailwind CSS sur tous les composants
- Header réorganisé avec icônes claires et séparateurs visuels
- Panneaux latéraux optimisés (gauche/droite)
- Design professionnel et responsive
- Composant `ThemeContext.tsx`

### 📦 Dépendances

#### Frontend
- `recharts` : Bibliothèque de graphiques React
- Configuration Tailwind avec `darkMode: 'class'`

#### Backend
- `reportlab==4.0.9` : Génération de PDF
- `Pillow==10.2.0` : Traitement d'images pour PDF

### 🔧 Modifié
- `App.tsx` : Intégration de tous les nouveaux composants
- `main.tsx` : Ajout du ThemeProvider
- `types/index.ts` : Nouveaux types TypeScript (Project, SearchHistory, Alert)
- `main.py` : Nouveaux endpoints API backend
- `requirements.txt` : Nouvelles dépendances Python
- `package.json` : Nouvelle dépendance recharts

### 📝 Technique
- +7 nouveaux composants React/TypeScript
- +3 nouveaux endpoints API backend
- +2773 lignes de code
- 15 fichiers modifiés/créés
- Build testé et fonctionnel
- Persistence : localStorage pour projets/historique/alertes

---

## [2.0.0] - 2026-01-22

### ✨ Ajouté
- Application complète de prospection foncière
- Interface cartographique avec MapLibre GL
- Intégration des données DVF (transactions immobilières)
- Affichage des parcelles cadastrales
- Système de recherche d'adresse avec autocomplétion
- Filtres avancés (type, prix, surface, année)
- Panneau de statistiques détaillées
- Export CSV et GeoJSON
- Gestion des favoris avec notes
- Panneau des risques naturels et technologiques
- Informations d'urbanisme (PLU/PLUi)

### 🏗️ Architecture
- Frontend : React 18 + TypeScript + Vite
- Backend : FastAPI (Python)
- Base de données : Redis (cache)
- Déploiement : Docker Compose
- Serveur web : Nginx

### 🔐 Sécurité
- Rate limiting par endpoint
- Headers de sécurité
- CORS configuré
- Validation des entrées

### 📊 APIs Intégrées
- Base Adresse Nationale (BAN)
- Cadastre (data.gouv.fr)
- DVF (Demandes de Valeurs Foncières)
- API Geo (communes, départements)
- Georisques (risques naturels/technologiques)
- GPU IGN (urbanisme)

---

## [1.0.0] - 2026-01-15

### ✨ Version Initiale
- Mise en place du projet
- Structure de base Frontend/Backend
- Configuration Docker
- Scripts de déploiement

---

## Types de Changements

- `✨ Ajouté` : Nouvelles fonctionnalités
- `🔧 Modifié` : Changements dans les fonctionnalités existantes
- `🗑️ Supprimé` : Fonctionnalités retirées
- `🐛 Corrigé` : Corrections de bugs
- `🔐 Sécurité` : Correctifs de sécurité
- `📦 Dépendances` : Mises à jour de dépendances
- `📝 Documentation` : Modifications de documentation
- `🏗️ Architecture` : Changements d'architecture
- `⚡ Performance` : Améliorations de performance

---

## Comment Mettre à Jour

Pour mettre à jour vers une version spécifique :

```bash
# Mise à jour vers la dernière version
sudo ./update.sh

# Mise à jour vers une version spécifique
sudo ./update.sh --tag v2.1.0

# Mise à jour sans interruption de service
sudo ./update.sh --no-downtime

# Retour à la version précédente
sudo ./update.sh --rollback
```

Consultez [UPDATES.md](./UPDATES.md) pour plus d'informations.

---

**Légende des versions :**
- Format : `MAJOR.MINOR.PATCH`
- MAJOR : Changements incompatibles (breaking changes)
- MINOR : Nouvelles fonctionnalités rétrocompatibles
- PATCH : Corrections de bugs rétrocompatibles
