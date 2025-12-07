#!/bin/bash

#===============================================================================
#
#    ██████╗ ██████╗ ███████╗██╗██████╗ ██╗ █████╗ ███╗   ██╗
#   ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██║██╔══██╗████╗  ██║
#   ██║   ██║██████╔╝███████╗██║██║  ██║██║███████║██╔██╗ ██║
#   ██║   ██║██╔══██╗╚════██║██║██║  ██║██║██╔══██║██║╚██╗██║
#   ╚██████╔╝██████╔╝███████║██║██████╔╝██║██║  ██║██║ ╚████║
#    ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
#                      PANEL INSTALLER
#
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR=$(pwd)
DATA_DIR="${INSTALL_DIR}/data"
SERVERS_DIR="${DATA_DIR}/servers"
BACKUPS_DIR="${DATA_DIR}/backups"
LOGS_DIR="${DATA_DIR}/logs"

# Default values
DEPENDENCIES_INSTALLED=0
DEFAULT_PORT=3000
DEFAULT_FRONTEND_PORT=5173
JWT_SECRET=""
ADMIN_EMAIL=""
ADMIN_USERNAME=""
ADMIN_PASSWORD=""

# Port ranges for game servers
# Minecraft (Java & Bedrock)
MINECRAFT_PORT_START=25565
MINECRAFT_PORT_END=25570
MINECRAFT_RCON_START=25575
MINECRAFT_RCON_END=25580

# Source Engine Games (GMod, CS2, Core Keeper)
SOURCE_PORT_START=27015
SOURCE_PORT_END=27020

# Valheim (UDP only, needs 3 consecutive ports per server)
VALHEIM_PORT_START=2456
VALHEIM_PORT_END=2467

# Palworld
PALWORLD_PORT_START=8211
PALWORLD_PORT_END=8215

# Vintage Story
VINTAGESTORY_PORT_START=42420
VINTAGESTORY_PORT_END=42425

# Terraria
TERRARIA_PORT_START=7777
TERRARIA_PORT_END=7782

# Stardew Valley
STARDEW_PORT_START=24642
STARDEW_PORT_END=24647

# Hytale (ports TBD - placeholder for future)
HYTALE_PORT_START=25000
HYTALE_PORT_END=25005

#===============================================================================
# Helper Functions
#===============================================================================

print_header() {
    echo -e "${PURPLE}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║    ██████╗ ██████╗ ███████╗██╗██████╗ ██╗ █████╗ ███╗   ██╗      ║"
    echo "║   ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██║██╔══██╗████╗  ██║      ║"
    echo "║   ██║   ██║██████╔╝███████╗██║██║  ██║██║███████║██╔██╗ ██║      ║"
    echo "║   ██║   ██║██╔══██╗╚════██║██║██║  ██║██║██╔══██║██║╚██╗██║      ║"
    echo "║   ╚██████╔╝██████╔╝███████║██║██████╔╝██║██║  ██║██║ ╚████║      ║"
    echo "║    ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝      ║"
    echo "║                                                                   ║"
    echo "║                    Game Server Panel Installer                    ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${CYAN}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

detect_os_id() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

install_dependencies_alma() {
    print_step "Installation des dépendances (AlmaLinux)..."

    sudo dnf install -y curl dnf-plugins-core >/dev/null
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - >/dev/null
    sudo dnf install -y nodejs git openssl >/dev/null

    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo >/dev/null
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
    sudo systemctl enable --now docker >/dev/null

    if id "$USER" &>/dev/null && [ "$USER" != "root" ]; then
        sudo usermod -aG docker "$USER" || true
        print_info "Ajout de $USER au groupe docker (reconnexion requise)"
    fi

    print_success "Dépendances AlmaLinux installées"
}

generate_secret() {
    openssl rand -hex 32
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_warning "Ce script n'est pas exécuté en tant que root."
        print_info "Certaines opérations peuvent nécessiter sudo."
        echo ""
    fi
}

#===============================================================================
# Dependency Checks
#===============================================================================

check_dependencies() {
    print_step "Vérification des dépendances système..."
    
    local missing_deps=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("nodejs")
    else
        NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            print_error "Node.js version 18+ requise (actuel: $(node -v))"
            missing_deps+=("nodejs>=18")
        else
            print_success "Node.js $(node -v) détecté"
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        print_success "npm $(npm -v) détecté"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    else
        print_success "Docker $(docker --version | cut -d ' ' -f 3 | tr -d ',') détecté"
        
        # Check if Docker daemon is running
        if ! docker info &> /dev/null; then
            print_warning "Le daemon Docker n'est pas en cours d'exécution"
            print_info "Démarrez Docker avec: sudo systemctl start docker"
        fi
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    else
        print_success "Git $(git --version | cut -d ' ' -f 3) détecté"
    fi
    
    # Check OpenSSL
    if ! command -v openssl &> /dev/null; then
        missing_deps+=("openssl")
    else
        print_success "OpenSSL détecté"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        OS_ID=$(detect_os_id)
        if [ "$DEPENDENCIES_INSTALLED" -eq 0 ] && [[ "$OS_ID" == "almalinux" ]]; then
            DEPENDENCIES_INSTALLED=1
            install_dependencies_alma
            check_dependencies
            return
        fi

        print_error "Dépendances manquantes: ${missing_deps[*]}"
        echo ""
        print_info "Installation des dépendances sur Ubuntu/Debian:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs docker.io git openssl"
        echo "  sudo systemctl enable docker && sudo systemctl start docker"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        print_info "Installation des dépendances sur CentOS/RHEL:"
        echo "  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -"
        echo "  sudo yum install -y nodejs docker git openssl"
        echo "  sudo systemctl enable docker && sudo systemctl start docker"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        exit 1
    fi
    
    print_success "Toutes les dépendances sont satisfaites"
}

#===============================================================================
# Directory Setup
#===============================================================================

setup_directories() {
    print_step "Création des répertoires..."
    
    # Create main data directories
    mkdir -p "$DATA_DIR"
    mkdir -p "$SERVERS_DIR"
    mkdir -p "$BACKUPS_DIR"
    mkdir -p "$LOGS_DIR"
    
    # Create subdirectories for different game types
    mkdir -p "$SERVERS_DIR/minecraft"
    mkdir -p "$SERVERS_DIR/steamcmd"
    
    # Create backup subdirectories
    mkdir -p "$BACKUPS_DIR/auto"
    mkdir -p "$BACKUPS_DIR/manual"
    
    # Create Prisma data directory
    mkdir -p "${INSTALL_DIR}/backend/prisma/data"
    
    # Set permissions
    chmod -R 755 "$DATA_DIR"
    
    print_success "Répertoires créés:"
    print_info "  - Données: $DATA_DIR"
    print_info "  - Serveurs: $SERVERS_DIR"
    print_info "  - Backups: $BACKUPS_DIR"
    print_info "  - Logs: $LOGS_DIR"
}

#===============================================================================
# Configuration
#===============================================================================

configure_environment() {
    print_step "Configuration de l'environnement..."
    
    # Generate JWT secret if not provided
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(generate_secret)
        print_info "JWT secret généré automatiquement"
    fi
    
    # Ask for configuration if interactive
    if [ -t 0 ]; then
        echo ""
        echo -e "${PURPLE}Configuration du panel:${NC}"
        echo ""
        
        # Backend port
        read -p "Port du backend [${DEFAULT_PORT}]: " input_port
        BACKEND_PORT=${input_port:-$DEFAULT_PORT}
        
        # Frontend port
        read -p "Port du frontend [${DEFAULT_FRONTEND_PORT}]: " input_frontend_port
        FRONTEND_PORT=${input_frontend_port:-$DEFAULT_FRONTEND_PORT}
        
        # Admin credentials
        echo ""
        echo -e "${PURPLE}Création du compte administrateur:${NC}"
        
        while [ -z "$ADMIN_EMAIL" ]; do
            read -p "Email admin: " ADMIN_EMAIL
        done
        
        while [ -z "$ADMIN_USERNAME" ]; do
            read -p "Nom d'utilisateur admin: " ADMIN_USERNAME
        done
        
        while [ -z "$ADMIN_PASSWORD" ]; do
            read -s -p "Mot de passe admin (min 8 caractères): " ADMIN_PASSWORD
            echo ""
            if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
                print_error "Le mot de passe doit contenir au moins 8 caractères"
                ADMIN_PASSWORD=""
            fi
        done
    else
        # Non-interactive mode - use defaults
        BACKEND_PORT=$DEFAULT_PORT
        FRONTEND_PORT=$DEFAULT_FRONTEND_PORT
        ADMIN_EMAIL="admin@obsidian.local"
        ADMIN_USERNAME="admin"
        ADMIN_PASSWORD="admin123456"
        print_warning "Mode non-interactif: utilisation des valeurs par défaut"
        print_warning "Compte admin: admin / admin123456 - CHANGEZ-LE IMMÉDIATEMENT!"
    fi
    
    # Create backend .env file
    cat > "${INSTALL_DIR}/backend/.env" << EOF
# Obsidian Panel - Backend Configuration
# Generated on $(date)

# Server
PORT=${BACKEND_PORT}
NODE_ENV=production

# Database
DATABASE_URL="file:./prisma/data/obsidian.db"

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Paths
SERVERS_PATH=${SERVERS_DIR}
BACKUPS_PATH=${BACKUPS_DIR}
LOGS_PATH=${LOGS_DIR}

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# Admin (used for initial setup)
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF

    chmod 600 "${INSTALL_DIR}/backend/.env"
    print_success "Fichier backend/.env créé"
    
    # Create frontend .env file
    cat > "${INSTALL_DIR}/frontend/.env" << EOF
# Obsidian Panel - Frontend Configuration
# Generated on $(date)

VITE_API_URL=http://31.39.12.93:${BACKEND_PORT}
VITE_WS_URL=ws://31.39.12.93:${BACKEND_PORT}
EOF

    print_success "Fichier frontend/.env créé"
}

#===============================================================================
# Installation
#===============================================================================

install_backend() {
    print_step "Installation du backend..."
    
    cd "${INSTALL_DIR}/backend"
    
    # Install dependencies
    print_info "Installation des dépendances npm..."
    npm install --legacy-peer-deps 2>&1 | tail -5
    
    # Generate Prisma client
    print_info "Génération du client Prisma..."
    npx prisma generate
    
    # Run migrations
    print_info "Exécution des migrations de base de données..."
    npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
    
    # Build TypeScript
    print_info "Compilation TypeScript..."
    npm run build
    
    print_success "Backend installé"
}

install_frontend() {
    print_step "Installation du frontend..."
    
    cd "${INSTALL_DIR}/frontend"
    
    # Install dependencies
    print_info "Installation des dépendances npm..."
    npm install --legacy-peer-deps 2>&1 | tail -5
    
    # Build frontend
    print_info "Build du frontend..."
    npm run build
    
    print_success "Frontend installé"
}

#===============================================================================
# Docker Setup
#===============================================================================

setup_docker() {
    print_step "Configuration de Docker..."
    
    # Check Docker socket permissions
    if [ -S /var/run/docker.sock ]; then
        if ! [ -r /var/run/docker.sock ] || ! [ -w /var/run/docker.sock ]; then
            print_warning "Permissions Docker socket limitées"
            print_info "Exécutez: sudo usermod -aG docker $USER && newgrp docker"
        fi
    fi
    
    # Create Docker network for game servers
    if ! docker network ls | grep -q "obsidian-network"; then
        docker network create obsidian-network 2>/dev/null || true
        print_success "Réseau Docker 'obsidian-network' créé"
    else
        print_info "Réseau Docker 'obsidian-network' existe déjà"
    fi
    
    # Pull base images (optional, can be slow)
    echo ""
    read -p "Voulez-vous pré-télécharger les images Docker des jeux ? (o/N): " pull_images
    
    if [[ "$pull_images" =~ ^[Oo]$ ]]; then
        print_info "Téléchargement des images Docker (cela peut prendre du temps)..."
        
        # Minecraft
        print_info "  - itzg/minecraft-server..."
        docker pull itzg/minecraft-server:latest 2>/dev/null && \
            print_success "  Image Minecraft téléchargée" || \
            print_warning "  Échec du téléchargement de l'image Minecraft"
        
        # SteamCMD base
        print_info "  - steamcmd/steamcmd..."
        docker pull steamcmd/steamcmd:latest 2>/dev/null && \
            print_success "  Image SteamCMD téléchargée" || \
            print_warning "  Échec du téléchargement de l'image SteamCMD"
    fi
    
    print_success "Docker configuré"
}

#===============================================================================
# Firewall Setup (AlmaLinux / RHEL / CentOS / Fedora with firewalld)
#===============================================================================

setup_firewall() {
    print_step "Configuration du firewall..."
    
    # Check if firewalld is available
    if ! command -v firewall-cmd &> /dev/null; then
        print_warning "firewalld n'est pas installé"
        print_info "Sur AlmaLinux/RHEL/CentOS: sudo dnf install firewalld"
        print_info "Configuration manuelle des ports requise"
        echo ""
        print_info "Ports à ouvrir manuellement:"
        echo "  - Panel Backend:     ${BACKEND_PORT:-3000}/tcp"
        echo "  - Panel Frontend:    ${FRONTEND_PORT:-5173}/tcp"
        echo "  - Minecraft:         ${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END}/tcp,udp"
        echo "  - Minecraft RCON:    ${MINECRAFT_RCON_START}-${MINECRAFT_RCON_END}/tcp"
        echo "  - GMod/CS2/CoreKeeper: ${SOURCE_PORT_START}-${SOURCE_PORT_END}/tcp,udp"
        echo "  - Valheim:           ${VALHEIM_PORT_START}-${VALHEIM_PORT_END}/udp"
        echo "  - Palworld:          ${PALWORLD_PORT_START}-${PALWORLD_PORT_END}/udp"
        echo "  - Vintage Story:     ${VINTAGESTORY_PORT_START}-${VINTAGESTORY_PORT_END}/tcp"
        echo "  - Terraria:          ${TERRARIA_PORT_START}-${TERRARIA_PORT_END}/tcp,udp"
        echo "  - Stardew Valley:    ${STARDEW_PORT_START}-${STARDEW_PORT_END}/udp"
        echo "  - Hytale (futur):    ${HYTALE_PORT_START}-${HYTALE_PORT_END}/tcp,udp"
        return 0
    fi
    
    # Check if firewalld is running
    if ! systemctl is-active --quiet firewalld; then
        print_warning "firewalld n'est pas actif"
        read -p "Voulez-vous démarrer et activer firewalld ? (o/N): " start_firewall
        if [[ "$start_firewall" =~ ^[Oo]$ ]]; then
            sudo systemctl enable --now firewalld
            print_success "firewalld démarré et activé"
        else
            print_info "Configuration firewall ignorée"
            return 0
        fi
    fi
    
    echo ""
    echo -e "${PURPLE}Configuration des règles firewall:${NC}"
    echo ""
    echo "Les ports suivants seront ouverts:"
    echo ""
    echo "  ┌──────────────────────────────────────────────────────────────────────┐"
    echo "  │ Service              │ Ports                    │ Protocol          │"
    echo "  ├──────────────────────────────────────────────────────────────────────┤"
    echo "  │ Panel Backend        │ ${BACKEND_PORT:-3000}                      │ TCP               │"
    echo "  │ Panel Frontend       │ ${FRONTEND_PORT:-5173}                     │ TCP               │"
    echo "  ├──────────────────────────────────────────────────────────────────────┤"
    echo "  │ Minecraft            │ ${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END}                │ TCP + UDP         │"
    echo "  │ Minecraft RCON       │ ${MINECRAFT_RCON_START}-${MINECRAFT_RCON_END}                │ TCP               │"
    echo "  │ Source (GMod/CS2)    │ ${SOURCE_PORT_START}-${SOURCE_PORT_END}                │ TCP + UDP         │"
    echo "  │ Valheim              │ ${VALHEIM_PORT_START}-${VALHEIM_PORT_END}                 │ UDP               │"
    echo "  │ Palworld             │ ${PALWORLD_PORT_START}-${PALWORLD_PORT_END}                 │ UDP               │"
    echo "  │ Vintage Story        │ ${VINTAGESTORY_PORT_START}-${VINTAGESTORY_PORT_END}               │ TCP               │"
    echo "  │ Terraria             │ ${TERRARIA_PORT_START}-${TERRARIA_PORT_END}                  │ TCP + UDP         │"
    echo "  │ Stardew Valley       │ ${STARDEW_PORT_START}-${STARDEW_PORT_END}               │ UDP               │"
    echo "  │ Hytale (futur)       │ ${HYTALE_PORT_START}-${HYTALE_PORT_END}               │ TCP + UDP         │"
    echo "  └──────────────────────────────────────────────────────────────────────┘"
    echo ""
    
    read -p "Voulez-vous appliquer ces règles firewall ? (O/n): " apply_firewall
    if [[ "$apply_firewall" =~ ^[Nn]$ ]]; then
        print_info "Configuration firewall ignorée"
        return 0
    fi
    
    print_info "Application des règles firewall..."
    
    # Panel ports
    print_info "  → Ports du panel..."
    sudo firewall-cmd --permanent --add-port=${BACKEND_PORT:-3000}/tcp 2>/dev/null || true
    sudo firewall-cmd --permanent --add-port=${FRONTEND_PORT:-5173}/tcp 2>/dev/null || true
    
    # Minecraft ports (TCP + UDP) + RCON (TCP)
    print_info "  → Ports Minecraft (${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END}, RCON: ${MINECRAFT_RCON_START}-${MINECRAFT_RCON_END})..."
    sudo firewall-cmd --permanent --add-port=${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END}/tcp 2>/dev/null || true
    sudo firewall-cmd --permanent --add-port=${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END}/udp 2>/dev/null || true
    sudo firewall-cmd --permanent --add-port=${MINECRAFT_RCON_START}-${MINECRAFT_RCON_END}/tcp 2>/dev/null || true
    
    # Source Engine ports - GMod, CS2, Core Keeper (TCP + UDP)
    print_info "  → Ports Source Engine - GMod/CS2/Core Keeper (${SOURCE_PORT_START}-${SOURCE_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${SOURCE_PORT_START}-${SOURCE_PORT_END}/tcp 2>/dev/null || true
    sudo firewall-cmd --permanent --add-port=${SOURCE_PORT_START}-${SOURCE_PORT_END}/udp 2>/dev/null || true
    
    # Valheim ports (UDP only)
    print_info "  → Ports Valheim (${VALHEIM_PORT_START}-${VALHEIM_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${VALHEIM_PORT_START}-${VALHEIM_PORT_END}/udp 2>/dev/null || true
    
    # Palworld ports (UDP)
    print_info "  → Ports Palworld (${PALWORLD_PORT_START}-${PALWORLD_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${PALWORLD_PORT_START}-${PALWORLD_PORT_END}/udp 2>/dev/null || true
    
    # Vintage Story ports (TCP)
    print_info "  → Ports Vintage Story (${VINTAGESTORY_PORT_START}-${VINTAGESTORY_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${VINTAGESTORY_PORT_START}-${VINTAGESTORY_PORT_END}/tcp 2>/dev/null || true
    
    # Terraria ports (TCP + UDP)
    print_info "  → Ports Terraria (${TERRARIA_PORT_START}-${TERRARIA_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${TERRARIA_PORT_START}-${TERRARIA_PORT_END}/tcp 2>/dev/null || true
    sudo firewall-cmd --permanent --add-port=${TERRARIA_PORT_START}-${TERRARIA_PORT_END}/udp 2>/dev/null || true
    
    # Stardew Valley ports (UDP)
    print_info "  → Ports Stardew Valley (${STARDEW_PORT_START}-${STARDEW_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${STARDEW_PORT_START}-${STARDEW_PORT_END}/udp 2>/dev/null || true
    
    # Hytale ports (TCP + UDP) - placeholder for future
    print_info "  → Ports Hytale (${HYTALE_PORT_START}-${HYTALE_PORT_END})..."
    sudo firewall-cmd --permanent --add-port=${HYTALE_PORT_START}-${HYTALE_PORT_END}/tcp 2>/dev/null || true
    sudo firewall-cmd --permanent --add-port=${HYTALE_PORT_START}-${HYTALE_PORT_END}/udp 2>/dev/null || true
    
    # Reload firewall to apply changes
    print_info "  → Rechargement du firewall..."
    sudo firewall-cmd --reload
    
    print_success "Règles firewall appliquées"
    
    # Show current configuration
    echo ""
    print_info "Configuration firewall actuelle:"
    sudo firewall-cmd --list-ports | tr ' ' '\n' | sort -t'/' -k1 -n | head -20
}

#===============================================================================
# Firewall Setup for UFW (Ubuntu/Debian)
#===============================================================================

setup_ufw() {
    print_step "Configuration du firewall UFW..."
    
    if ! command -v ufw &> /dev/null; then
        print_warning "UFW n'est pas installé"
        return 0
    fi
    
    echo ""
    echo -e "${PURPLE}Configuration des règles UFW:${NC}"
    echo ""
    
    read -p "Voulez-vous configurer UFW ? (O/n): " apply_ufw
    if [[ "$apply_ufw" =~ ^[Nn]$ ]]; then
        print_info "Configuration UFW ignorée"
        return 0
    fi
    
    # Panel ports
    print_info "  → Ports du panel..."
    sudo ufw allow ${BACKEND_PORT:-3000}/tcp comment 'Obsidian Panel Backend' 2>/dev/null || true
    sudo ufw allow ${FRONTEND_PORT:-5173}/tcp comment 'Obsidian Panel Frontend' 2>/dev/null || true
    
    # Minecraft ports + RCON
    print_info "  → Ports Minecraft..."
    sudo ufw allow ${MINECRAFT_PORT_START}:${MINECRAFT_PORT_END}/tcp comment 'Minecraft TCP' 2>/dev/null || true
    sudo ufw allow ${MINECRAFT_PORT_START}:${MINECRAFT_PORT_END}/udp comment 'Minecraft UDP' 2>/dev/null || true
    sudo ufw allow ${MINECRAFT_RCON_START}:${MINECRAFT_RCON_END}/tcp comment 'Minecraft RCON' 2>/dev/null || true
    
    # Source Engine - GMod, CS2, Core Keeper
    print_info "  → Ports Source Engine (GMod/CS2/Core Keeper)..."
    sudo ufw allow ${SOURCE_PORT_START}:${SOURCE_PORT_END}/tcp comment 'Source TCP' 2>/dev/null || true
    sudo ufw allow ${SOURCE_PORT_START}:${SOURCE_PORT_END}/udp comment 'Source UDP' 2>/dev/null || true
    
    # Valheim ports
    print_info "  → Ports Valheim..."
    sudo ufw allow ${VALHEIM_PORT_START}:${VALHEIM_PORT_END}/udp comment 'Valheim UDP' 2>/dev/null || true
    
    # Palworld ports
    print_info "  → Ports Palworld..."
    sudo ufw allow ${PALWORLD_PORT_START}:${PALWORLD_PORT_END}/udp comment 'Palworld UDP' 2>/dev/null || true
    
    # Vintage Story ports
    print_info "  → Ports Vintage Story..."
    sudo ufw allow ${VINTAGESTORY_PORT_START}:${VINTAGESTORY_PORT_END}/tcp comment 'VintageStory TCP' 2>/dev/null || true
    
    # Terraria ports
    print_info "  → Ports Terraria..."
    sudo ufw allow ${TERRARIA_PORT_START}:${TERRARIA_PORT_END}/tcp comment 'Terraria TCP' 2>/dev/null || true
    sudo ufw allow ${TERRARIA_PORT_START}:${TERRARIA_PORT_END}/udp comment 'Terraria UDP' 2>/dev/null || true
    
    # Stardew Valley ports
    print_info "  → Ports Stardew Valley..."
    sudo ufw allow ${STARDEW_PORT_START}:${STARDEW_PORT_END}/udp comment 'Stardew UDP' 2>/dev/null || true
    
    # Hytale ports (future)
    print_info "  → Ports Hytale (futur)..."
    sudo ufw allow ${HYTALE_PORT_START}:${HYTALE_PORT_END}/tcp comment 'Hytale TCP' 2>/dev/null || true
    sudo ufw allow ${HYTALE_PORT_START}:${HYTALE_PORT_END}/udp comment 'Hytale UDP' 2>/dev/null || true
    
    # Enable UFW if not enabled
    if ! sudo ufw status | grep -q "Status: active"; then
        read -p "UFW n'est pas actif. Voulez-vous l'activer ? (o/N): " enable_ufw
        if [[ "$enable_ufw" =~ ^[Oo]$ ]]; then
            sudo ufw --force enable
            print_success "UFW activé"
        fi
    fi
    
    print_success "Règles UFW appliquées"
}

#===============================================================================
# Auto-detect and configure firewall
#===============================================================================

configure_firewall() {
    print_step "Détection du système de firewall..."
    
    # Detect OS and firewall system
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID=$ID
        OS_LIKE=$ID_LIKE
    fi
    
    # Check for firewalld (AlmaLinux, RHEL, CentOS, Fedora)
    if command -v firewall-cmd &> /dev/null; then
        print_info "Système détecté: firewalld (AlmaLinux/RHEL/CentOS/Fedora)"
        setup_firewall
    # Check for UFW (Ubuntu, Debian)
    elif command -v ufw &> /dev/null; then
        print_info "Système détecté: UFW (Ubuntu/Debian)"
        setup_ufw
    # Check for iptables as fallback
    elif command -v iptables &> /dev/null; then
        print_warning "Seul iptables est disponible"
        print_info "Configuration manuelle requise. Ports à ouvrir:"
        echo ""
        echo "  # Panel"
        echo "  iptables -A INPUT -p tcp --dport ${BACKEND_PORT:-3000} -j ACCEPT"
        echo "  iptables -A INPUT -p tcp --dport ${FRONTEND_PORT:-5173} -j ACCEPT"
        echo ""
        echo "  # Minecraft (${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END}) + RCON"
        echo "  iptables -A INPUT -p tcp --dport ${MINECRAFT_PORT_START}:${MINECRAFT_PORT_END} -j ACCEPT"
        echo "  iptables -A INPUT -p udp --dport ${MINECRAFT_PORT_START}:${MINECRAFT_PORT_END} -j ACCEPT"
        echo "  iptables -A INPUT -p tcp --dport ${MINECRAFT_RCON_START}:${MINECRAFT_RCON_END} -j ACCEPT"
        echo ""
        echo "  # Source Engine - GMod/CS2/Core Keeper (${SOURCE_PORT_START}-${SOURCE_PORT_END})"
        echo "  iptables -A INPUT -p tcp --dport ${SOURCE_PORT_START}:${SOURCE_PORT_END} -j ACCEPT"
        echo "  iptables -A INPUT -p udp --dport ${SOURCE_PORT_START}:${SOURCE_PORT_END} -j ACCEPT"
        echo ""
        echo "  # Valheim (${VALHEIM_PORT_START}-${VALHEIM_PORT_END})"
        echo "  iptables -A INPUT -p udp --dport ${VALHEIM_PORT_START}:${VALHEIM_PORT_END} -j ACCEPT"
        echo ""
        echo "  # Palworld (${PALWORLD_PORT_START}-${PALWORLD_PORT_END})"
        echo "  iptables -A INPUT -p udp --dport ${PALWORLD_PORT_START}:${PALWORLD_PORT_END} -j ACCEPT"
        echo ""
        echo "  # Vintage Story (${VINTAGESTORY_PORT_START}-${VINTAGESTORY_PORT_END})"
        echo "  iptables -A INPUT -p tcp --dport ${VINTAGESTORY_PORT_START}:${VINTAGESTORY_PORT_END} -j ACCEPT"
        echo ""
        echo "  # Terraria (${TERRARIA_PORT_START}-${TERRARIA_PORT_END})"
        echo "  iptables -A INPUT -p tcp --dport ${TERRARIA_PORT_START}:${TERRARIA_PORT_END} -j ACCEPT"
        echo "  iptables -A INPUT -p udp --dport ${TERRARIA_PORT_START}:${TERRARIA_PORT_END} -j ACCEPT"
        echo ""
        echo "  # Stardew Valley (${STARDEW_PORT_START}-${STARDEW_PORT_END})"
        echo "  iptables -A INPUT -p udp --dport ${STARDEW_PORT_START}:${STARDEW_PORT_END} -j ACCEPT"
        echo ""
        echo "  # Hytale (${HYTALE_PORT_START}-${HYTALE_PORT_END})"
        echo "  iptables -A INPUT -p tcp --dport ${HYTALE_PORT_START}:${HYTALE_PORT_END} -j ACCEPT"
        echo "  iptables -A INPUT -p udp --dport ${HYTALE_PORT_START}:${HYTALE_PORT_END} -j ACCEPT"
        echo ""
    else
        print_warning "Aucun système de firewall détecté"
    fi
}

#===============================================================================
# Service Setup
#===============================================================================

create_systemd_service() {
    print_step "Création des services systemd..."
    
    # Backend service
    sudo tee /etc/systemd/system/obsidian-backend.service > /dev/null << EOF
[Unit]
Description=Obsidian Panel Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=${INSTALL_DIR}/backend
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service (serves built files with a simple server)
    sudo tee /etc/systemd/system/obsidian-frontend.service > /dev/null << EOF
[Unit]
Description=Obsidian Panel Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=${INSTALL_DIR}/frontend
ExecStart=$(which npx) serve -s dist -l ${FRONTEND_PORT:-5173}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
    
    print_success "Services systemd créés"
    print_info "  - obsidian-backend.service"
    print_info "  - obsidian-frontend.service"
}

#===============================================================================
# Seed Database
#===============================================================================

seed_database() {
    print_step "Initialisation de la base de données..."
    
    cd "${INSTALL_DIR}/backend"
    
    # Create admin user and seed game templates using a Node script
    node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const hashedPassword = await bcrypt.hash('${ADMIN_PASSWORD}', 12);
    
    const admin = await prisma.user.upsert({
        where: { email: '${ADMIN_EMAIL}' },
        update: {},
        create: {
            email: '${ADMIN_EMAIL}',
            username: '${ADMIN_USERNAME}',
            password: hashedPassword,
            role: 'admin'
        }
    });
    
    console.log('Admin user created:', admin.username);
    
    // Seed game templates (aligned with backend defaults)
    const templates = [
        {
            name: 'minecraft-java',
            displayName: 'Minecraft Java Edition',
            category: 'minecraft',
            description: 'Serveur Minecraft Java avec support Vanilla, Paper, Fabric, Forge et NeoForge',
            dockerImage: 'itzg/minecraft-server:latest',
            defaultPort: 25565,
            defaultQueryPort: 25565,
            defaultRconPort: 25575,
            defaultMemory: 2048,
            defaultCpu: 2.0,
            defaultDisk: 10240,
            startupCommand: '',
            configSchema: JSON.stringify({
                difficulty: { type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
                gamemode: { type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], default: 'survival' },
                motd: { type: 'string', default: 'Un serveur Minecraft' },
                onlineMode: { type: 'boolean', default: true },
                pvp: { type: 'boolean', default: true },
                allowNether: { type: 'boolean', default: true },
                viewDistance: { type: 'number', min: 3, max: 32, default: 10 }
            }),
            envTemplate: JSON.stringify({
                EULA: 'TRUE'
            }),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 25565, rcon: 25575 },
                    { port: 25566, rcon: 25576 },
                    { port: 25567, rcon: 25577 },
                    { port: 25568, rcon: 25578 },
                    { port: 25569, rcon: 25579 },
                    { port: 25570, rcon: 25580 }
                ],
                protocol: 'tcp+udp',
                rconProtocol: 'tcp'
            })
        },
        {
            name: 'gmod',
            displayName: 'Garry\'s Mod',
            category: 'steamcmd',
            description: 'Serveur Garry\'s Mod - Sandbox physics game',
            dockerImage: 'cm2network/gmod:latest',
            defaultPort: 27015,
            defaultQueryPort: 27015,
            defaultRconPort: 27015,
            defaultMemory: 2048,
            defaultCpu: 2.0,
            defaultDisk: 20480,
            startupCommand: './srcds_run -game garrysmod',
            configSchema: JSON.stringify({
                maxPlayers: { type: 'number', min: 2, max: 128, default: 24 },
                gamemode: { type: 'select', options: ['sandbox', 'terrortown', 'prop_hunt', 'murder', 'darkrp', 'deathrun'], default: 'sandbox' },
                map: { type: 'string', default: 'gm_flatgrass' },
                workshopCollection: { type: 'string', default: '', description: 'ID de collection Workshop' },
                srcdsToken: { type: 'string', default: '', description: 'Token GSLT Steam (requis)' }
            }),
            envTemplate: JSON.stringify({}),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 27015 },
                    { port: 27016 },
                    { port: 27017 },
                    { port: 27018 },
                    { port: 27019 },
                    { port: 27020 }
                ],
                protocol: 'tcp+udp'
            })
        },
        {
            name: 'cs2',
            displayName: 'Counter-Strike 2',
            category: 'steamcmd',
            description: 'Serveur Counter-Strike 2 dédié',
            dockerImage: 'joedwards32/cs2:latest',
            defaultPort: 27015,
            defaultQueryPort: 27015,
            defaultRconPort: 27015,
            defaultMemory: 4096,
            defaultCpu: 2.0,
            defaultDisk: 40960,
            startupCommand: '',
            configSchema: JSON.stringify({
                serverName: { type: 'string', default: 'CS2 Server' },
                maxPlayers: { type: 'number', min: 2, max: 64, default: 16 },
                tickrate: { type: 'select', options: ['64', '128'], default: '128' },
                gameType: { type: 'select', options: [
                    { value: '0', label: 'Casual' },
                    { value: '1', label: 'Compétitif' },
                    { value: '2', label: 'Wingman' },
                    { value: '3', label: 'Deathmatch' }
                ], default: '0' },
                map: { type: 'string', default: 'de_dust2' }
            }),
            envTemplate: JSON.stringify({}),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 27015 },
                    { port: 27016 },
                    { port: 27017 },
                    { port: 27018 },
                    { port: 27019 },
                    { port: 27020 }
                ],
                protocol: 'tcp+udp'
            })
        },
        {
            name: 'valheim',
            displayName: 'Valheim',
            category: 'steamcmd',
            description: 'Serveur Valheim - Survie Viking avec amis',
            dockerImage: 'lloesche/valheim-server:latest',
            defaultPort: 2456,
            defaultQueryPort: 2457,
            defaultRconPort: null,
            defaultMemory: 4096,
            defaultCpu: 2.0,
            defaultDisk: 5120,
            startupCommand: '',
            configSchema: JSON.stringify({
                serverName: { type: 'string', default: 'Serveur Valheim' },
                worldName: { type: 'string', default: 'Dedicated' },
                password: { type: 'string', default: '', description: 'Min 5 caractères ou vide' },
                public: { type: 'boolean', default: true },
                crossplay: { type: 'boolean', default: false }
            }),
            envTemplate: JSON.stringify({}),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 2456, query: 2457, steam: 2458 },
                    { port: 2459, query: 2460, steam: 2461 },
                    { port: 2462, query: 2463, steam: 2464 },
                    { port: 2465, query: 2466, steam: 2467 }
                ],
                protocol: 'udp',
                note: 'Valheim nécessite 3 ports consécutifs par serveur'
            })
        },
        {
            name: 'palworld',
            displayName: 'Palworld',
            category: 'steamcmd',
            description: 'Serveur Palworld - Pokémon meets Survival',
            dockerImage: 'thijsvanloef/palworld-server-docker:latest',
            defaultPort: 8211,
            defaultQueryPort: 27015,
            defaultRconPort: 25575,
            defaultMemory: 8192,
            defaultCpu: 4.0,
            defaultDisk: 20480,
            startupCommand: '',
            configSchema: JSON.stringify({
                serverName: { type: 'string', default: 'Serveur Palworld' },
                serverDescription: { type: 'string', default: '' },
                maxPlayers: { type: 'number', min: 1, max: 32, default: 16 },
                password: { type: 'string', default: '' },
                difficulty: { type: 'select', options: ['None', 'Normal', 'Difficult'], default: 'Normal' },
                dayTimeSpeedRate: { type: 'number', min: 0.1, max: 5, default: 1.0 },
                nightTimeSpeedRate: { type: 'number', min: 0.1, max: 5, default: 1.0 },
                expRate: { type: 'number', min: 0.1, max: 20, default: 1.0 }
            }),
            envTemplate: JSON.stringify({
                MULTITHREADING: 'true',
                COMMUNITY: 'false'
            }),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 8211, query: 27015 },
                    { port: 8212, query: 27016 },
                    { port: 8213, query: 27017 },
                    { port: 8214, query: 27018 },
                    { port: 8215, query: 27019 }
                ],
                protocol: 'udp'
            })
        },
        {
            name: 'core-keeper',
            displayName: 'Core Keeper',
            category: 'steamcmd',
            description: 'Serveur Core Keeper - Mining sandbox aventure',
            dockerImage: 'escapefromtarkov/corekeeper:latest',
            defaultPort: 27015,
            defaultQueryPort: 27015,
            defaultRconPort: null,
            defaultMemory: 2048,
            defaultCpu: 2.0,
            defaultDisk: 5120,
            startupCommand: '',
            configSchema: JSON.stringify({
                worldName: { type: 'string', default: 'CoreKeeperWorld' },
                maxPlayers: { type: 'number', min: 1, max: 8, default: 8 },
                gameId: { type: 'string', default: '', description: 'Game ID pour rejoindre' }
            }),
            envTemplate: JSON.stringify({}),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 27015 },
                    { port: 27016 },
                    { port: 27017 },
                    { port: 27018 },
                    { port: 27019 },
                    { port: 27020 }
                ],
                protocol: 'udp'
            })
        },
        {
            name: 'terraria',
            displayName: 'Terraria',
            category: 'steamcmd',
            description: 'Serveur Terraria - Aventure 2D sandbox',
            dockerImage: 'ryshe/terraria:latest',
            defaultPort: 7777,
            defaultQueryPort: 7777,
            defaultRconPort: null,
            defaultMemory: 1024,
            defaultCpu: 1.0,
            defaultDisk: 2048,
            startupCommand: '',
            configSchema: JSON.stringify({
                worldName: { type: 'string', default: 'world' },
                maxPlayers: { type: 'number', min: 1, max: 255, default: 8 },
                password: { type: 'string', default: '' },
                difficulty: { type: 'select', options: [
                    { value: '0', label: 'Normal' },
                    { value: '1', label: 'Expert' },
                    { value: '2', label: 'Master' },
                    { value: '3', label: 'Journey' }
                ], default: '0' },
                worldSize: { type: 'select', options: [
                    { value: '1', label: 'Petit' },
                    { value: '2', label: 'Moyen' },
                    { value: '3', label: 'Grand' }
                ], default: '2' }
            }),
            envTemplate: JSON.stringify({}),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 7777 },
                    { port: 7778 },
                    { port: 7779 },
                    { port: 7780 },
                    { port: 7781 },
                    { port: 7782 }
                ],
                protocol: 'tcp'
            })
        },
        {
            name: 'vintage-story',
            displayName: 'Vintage Story',
            category: 'steamcmd',
            description: 'Serveur Vintage Story - Survie médiévale réaliste',
            dockerImage: 'devidian/vintagestory:latest',
            defaultPort: 42420,
            defaultQueryPort: 42420,
            defaultRconPort: null,
            defaultMemory: 2048,
            defaultCpu: 2.0,
            defaultDisk: 10240,
            startupCommand: '',
            configSchema: JSON.stringify({
                worldName: { type: 'string', default: 'ObsidianWorld' },
                maxPlayers: { type: 'number', min: 1, max: 128, default: 32 },
                whitelist: { type: 'boolean', default: false }
            }),
            envTemplate: JSON.stringify({}),
            portConfig: JSON.stringify({
                portRanges: [
                    { port: 42420 },
                    { port: 42421 },
                    { port: 42422 },
                    { port: 42423 },
                    { port: 42424 },
                    { port: 42425 }
                ],
                protocol: 'tcp'
            })
        }
    ];
    
    for (const template of templates) {
        await prisma.gameTemplate.upsert({
            where: { name: template.name },
            update: template,
            create: template
        });
    }
    
    console.log('Game templates seeded:', templates.length);
}

main()
    .catch(console.error)
    .finally(() => prisma.\$disconnect());
" 2>/dev/null && print_success "Base de données initialisée" || print_warning "Initialisation partielle (le backend le fera au démarrage)"
}

#===============================================================================
# Final Steps
#===============================================================================

print_completion() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║            ✓ INSTALLATION TERMINÉE AVEC SUCCÈS !                  ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${CYAN}Informations de connexion:${NC}"
    echo "  URL Backend:  http://localhost:${BACKEND_PORT:-3000}"
    echo "  URL Frontend: http://localhost:${FRONTEND_PORT:-5173}"
    echo ""
    echo -e "${CYAN}Compte administrateur:${NC}"
    echo "  Email:    ${ADMIN_EMAIL}"
    echo "  Username: ${ADMIN_USERNAME}"
    echo "  Password: [celui que vous avez défini]"
    echo ""
    echo -e "${CYAN}Démarrage manuel:${NC}"
    echo "  Backend:  cd backend && npm run dev"
    echo "  Frontend: cd frontend && npm run dev"
    echo ""
    echo -e "${CYAN}Démarrage avec systemd:${NC}"
    echo "  sudo systemctl start obsidian-backend"
    echo "  sudo systemctl start obsidian-frontend"
    echo "  sudo systemctl enable obsidian-backend obsidian-frontend"
    echo ""
    echo -e "${CYAN}Répertoires:${NC}"
    echo "  Données serveurs: ${SERVERS_DIR}"
    echo "  Backups:          ${BACKUPS_DIR}"
    echo "  Logs:             ${LOGS_DIR}"
    echo ""
    echo -e "${CYAN}Plages de ports configurées:${NC}"
    echo "  Minecraft:          ${MINECRAFT_PORT_START}-${MINECRAFT_PORT_END} (TCP/UDP) + RCON ${MINECRAFT_RCON_START}-${MINECRAFT_RCON_END}"
    echo "  GMod/CS2/CoreKeeper: ${SOURCE_PORT_START}-${SOURCE_PORT_END} (TCP/UDP)"
    echo "  Valheim:            ${VALHEIM_PORT_START}-${VALHEIM_PORT_END} (UDP)"
    echo "  Palworld:           ${PALWORLD_PORT_START}-${PALWORLD_PORT_END} (UDP)"
    echo "  Vintage Story:      ${VINTAGESTORY_PORT_START}-${VINTAGESTORY_PORT_END} (TCP)"
    echo "  Terraria:           ${TERRARIA_PORT_START}-${TERRARIA_PORT_END} (TCP/UDP)"
    echo "  Stardew Valley:     ${STARDEW_PORT_START}-${STARDEW_PORT_END} (UDP)"
    echo "  Hytale (futur):     ${HYTALE_PORT_START}-${HYTALE_PORT_END} (TCP/UDP)"
    echo ""
    echo -e "${PURPLE}Merci d'utiliser Obsidian Panel !${NC}"
    echo ""
}

#===============================================================================
# Main Installation Flow
#===============================================================================

main() {
    print_header
    
    echo -e "${YELLOW}Ce script va installer Obsidian Panel sur votre système.${NC}"
    echo ""
    
    check_root
    check_dependencies
    setup_directories
    configure_environment
    install_backend
    install_frontend
    setup_docker
    configure_firewall
    
    # Ask for systemd services
    if [ -t 0 ] && command -v systemctl &> /dev/null; then
        echo ""
        read -p "Voulez-vous créer les services systemd ? (o/N): " create_services
        if [[ "$create_services" =~ ^[Oo]$ ]]; then
            create_systemd_service
        fi
    fi
    
    seed_database
    print_completion
}

# Run main function
main "$@"
