# Obsidian Panel

🎮 **Panel de Gestion de Serveurs de Jeux Universel**

Un panel web moderne et élégant pour gérer vos serveurs de jeux. Supporte Minecraft (Java & Bedrock) et les jeux SteamCMD (CS2, Valheim, Rust, ARK, Terraria, etc.).

![Obsidian Panel](https://img.shields.io/badge/version-1.0.0-purple)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Fonctionnalités

- 🐳 **Isolation Docker** - Chaque serveur tourne dans son propre conteneur
- 🎮 **Multi-Jeux** - Minecraft Java/Bedrock, CS2, CSGO, Valheim, Rust, ARK, Terraria
- 📊 **Monitoring Temps Réel** - CPU, RAM, réseau via WebSocket
- 💻 **Console Web** - Terminal interactif pour chaque serveur
- 👥 **Multi-Utilisateurs** - Gestion des rôles admin/user
- 🔐 **Authentification JWT** - Sessions sécurisées
- 🎨 **Interface Moderne** - Design dark élégant avec Tailwind CSS

## 🏗️ Architecture

```
obsidian-panel/
├── backend/                 # API Node.js + Express
│   ├── src/
│   │   ├── routes/         # Routes API REST
│   │   ├── services/       # Services Docker & Serveurs
│   │   ├── middleware/     # Auth & validation
│   │   └── websocket.ts    # WebSocket pour logs temps réel
│   └── prisma/             # Schéma base de données
├── frontend/               # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/         # Pages de l'application
│   │   ├── components/    # Composants réutilisables
│   │   ├── stores/        # État global (Zustand)
│   │   └── lib/           # API & WebSocket clients
└── docker-compose.yml      # Orchestration Docker
```

## 🚀 Installation

### Prérequis

- Node.js 18+
- Docker & Docker Compose
- Linux (recommandé pour la production)

### Développement Local

```bash
# Cloner le repo
git clone https://github.com/your-repo/obsidian-panel.git
cd obsidian-panel

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos paramètres

# Initialiser la base de données
cd backend
npm run db:push
npm run db:generate
cd ..

# Lancer en mode développement
npm run dev
```

L'application sera disponible sur:
- Frontend: http://localhost:5173
- API: http://localhost:3001

### Production avec Docker

```bash
# Configurer les variables d'environnement
export JWT_SECRET="votre-secret-super-securise"

# Construire et lancer
docker-compose up -d

# Voir les logs
docker-compose logs -f
```

Le panel sera accessible sur http://localhost:80

## 📝 Configuration

### Variables d'Environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NODE_ENV` | Environnement (development/production) | development |
| `PORT` | Port de l'API | 3001 |
| `JWT_SECRET` | Clé secrète pour les tokens JWT | - |
| `DATABASE_URL` | URL de la base de données SQLite | file:./data/obsidian.db |
| `DOCKER_SOCKET` | Chemin du socket Docker | /var/run/docker.sock |
| `SERVERS_DIR` | Répertoire des données serveurs | /var/lib/obsidian-panel/servers |

### Premier Utilisateur

Le premier utilisateur enregistré reçoit automatiquement le rôle **admin**.

### Ajouter des Templates de Jeux

Connectez-vous en tant qu'admin et appelez l'endpoint pour initialiser les templates:

```bash
curl -X POST http://localhost:3001/api/game-templates/seed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎮 Jeux Supportés

### Minecraft
- **Java Edition** - Vanilla, Paper, Spigot, Forge, Fabric
- **Bedrock Edition** - Serveur officiel

### SteamCMD
- Counter-Strike 2 (CS2)
- Counter-Strike: Global Offensive
- Valheim
- Rust
- ARK: Survival Evolved
- Terraria

## 🔧 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Utilisateur courant

### Serveurs
- `GET /api/servers` - Liste des serveurs
- `POST /api/servers` - Créer un serveur
- `GET /api/servers/:id` - Détails d'un serveur
- `POST /api/servers/:id/start` - Démarrer
- `POST /api/servers/:id/stop` - Arrêter
- `POST /api/servers/:id/restart` - Redémarrer
- `DELETE /api/servers/:id` - Supprimer
- `GET /api/servers/:id/stats` - Statistiques
- `GET /api/servers/:id/logs` - Logs
- `POST /api/servers/:id/command` - Envoyer une commande

### Templates
- `GET /api/game-templates` - Liste des templates
- `POST /api/game-templates/seed` - Initialiser les templates (admin)

### Utilisateurs (Admin)
- `GET /api/users` - Liste des utilisateurs
- `POST /api/users` - Créer un utilisateur
- `PATCH /api/users/:id` - Modifier un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur

## 🔌 WebSocket Events

### Client → Serveur
- `server:subscribe` - S'abonner aux logs d'un serveur
- `server:unsubscribe` - Se désabonner
- `server:command` - Envoyer une commande
- `server:stats` - Demander les stats

### Serveur → Client
- `server:log` - Nouveau log
- `server:stats` - Mise à jour des statistiques
- `error` - Erreur

## 🛠️ Développement

### Structure du Backend

```typescript
// Exemple de création de serveur
const serverService = new ServerService();
await serverService.createServer({
  name: 'Mon Serveur Minecraft',
  gameType: 'minecraft-java',
  userId: 'user-uuid',
  port: 25565,
  memoryLimit: 4096,
  cpuLimit: 2,
  gameConfig: {
    version: '1.20.4',
    serverType: 'PAPER',
    difficulty: 'normal'
  }
});
```

### Ajouter un Nouveau Jeu

1. Créer un template dans `gameTemplates.ts`
2. Configurer l'image Docker
3. Définir les variables d'environnement
4. Ajouter le schéma de configuration

## 📄 License

MIT License - voir [LICENSE](LICENSE)

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

---

**Obsidian Panel** - Créé avec ❤️ pour la communauté gaming
