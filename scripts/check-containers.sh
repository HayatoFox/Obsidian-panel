#!/bin/bash
#
# Script de diagnostic des conteneurs Obsidian Panel
# Usage: ./check-containers.sh
#

echo "=========================================="
echo "  Diagnostic Obsidian Panel - Conteneurs"
echo "=========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Vérifier que Docker est actif
echo -e "${BLUE}[1/5] Vérification de Docker...${NC}"
if systemctl is-active --quiet docker; then
    echo -e "  ${GREEN}✓ Docker est actif${NC}"
    docker --version
else
    echo -e "  ${RED}✗ Docker n'est pas actif${NC}"
    echo "  Lancez: systemctl start docker"
    exit 1
fi
echo ""

# 2. Lister tous les conteneurs Docker
echo -e "${BLUE}[2/5] Liste de tous les conteneurs Docker...${NC}"
echo ""
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
echo ""

# 3. Conteneurs en cours d'exécution
echo -e "${BLUE}[3/5] Conteneurs en cours d'exécution...${NC}"
RUNNING=$(docker ps -q | wc -l)
echo -e "  Conteneurs actifs: ${GREEN}${RUNNING}${NC}"
echo ""

# 4. Vérifier les conteneurs créés par Obsidian Panel (préfixe obsidian-)
echo -e "${BLUE}[4/5] Conteneurs Obsidian Panel...${NC}"
OBSIDIAN_CONTAINERS=$(docker ps -a --filter "name=obsidian-" --format "{{.Names}}")
if [ -z "$OBSIDIAN_CONTAINERS" ]; then
    echo -e "  ${YELLOW}Aucun conteneur Obsidian Panel trouvé${NC}"
    echo "  (Les conteneurs créés par le panel ont le préfixe 'obsidian-')"
else
    echo ""
    for container in $OBSIDIAN_CONTAINERS; do
        STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
        CREATED=$(docker inspect --format='{{.Created}}' "$container" 2>/dev/null | cut -d'T' -f1)
        IMAGE=$(docker inspect --format='{{.Config.Image}}' "$container" 2>/dev/null)
        
        case $STATUS in
            "running")
                echo -e "  ${GREEN}●${NC} $container"
                echo -e "    Status: ${GREEN}running${NC}"
                ;;
            "exited")
                echo -e "  ${RED}●${NC} $container"
                echo -e "    Status: ${RED}exited${NC}"
                ;;
            "created")
                echo -e "  ${YELLOW}●${NC} $container"
                echo -e "    Status: ${YELLOW}created (jamais démarré)${NC}"
                ;;
            *)
                echo -e "  ${YELLOW}●${NC} $container"
                echo -e "    Status: ${YELLOW}$STATUS${NC}"
                ;;
        esac
        echo "    Image: $IMAGE"
        echo "    Créé: $CREATED"
        echo ""
    done
fi
echo ""

# 5. Vérifier la base de données SQLite
echo -e "${BLUE}[5/5] Serveurs dans la base de données...${NC}"
DB_PATH="/opt/obsidian-panel/backend/prisma/dev.db"
if [ -f "$DB_PATH" ]; then
    echo ""
    echo "  Serveurs enregistrés:"
    sqlite3 "$DB_PATH" "SELECT id, name, status, containerId, gameType FROM Server;" 2>/dev/null | while IFS='|' read -r id name status containerId gameType; do
        echo ""
        echo -e "  ${BLUE}Serveur: $name${NC}"
        echo "    ID: $id"
        echo "    Type: $gameType"
        
        case $status in
            "running")
                echo -e "    Status DB: ${GREEN}$status${NC}"
                ;;
            "stopped")
                echo -e "    Status DB: ${RED}$status${NC}"
                ;;
            "starting"|"stopping")
                echo -e "    Status DB: ${YELLOW}$status${NC}"
                ;;
            *)
                echo -e "    Status DB: ${YELLOW}$status${NC}"
                ;;
        esac
        
        if [ -n "$containerId" ] && [ "$containerId" != "null" ]; then
            echo "    Container ID: $containerId"
            # Vérifier si le conteneur existe vraiment
            DOCKER_STATUS=$(docker inspect --format='{{.State.Status}}' "$containerId" 2>/dev/null)
            if [ -n "$DOCKER_STATUS" ]; then
                echo -e "    Docker Status: ${GREEN}$DOCKER_STATUS${NC}"
            else
                echo -e "    Docker Status: ${RED}CONTENEUR INTROUVABLE${NC}"
            fi
        else
            echo -e "    Container ID: ${YELLOW}Non créé${NC}"
        fi
    done
    
    # Compter les serveurs
    COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Server;" 2>/dev/null)
    echo ""
    echo "  Total serveurs: $COUNT"
else
    echo -e "  ${YELLOW}Base de données non trouvée à $DB_PATH${NC}"
    echo "  Essayez: /opt/obsidian-panel/backend/prisma/dev.db"
fi

echo ""
echo "=========================================="
echo "  Commandes utiles"
echo "=========================================="
echo ""
echo "  Voir les logs d'un conteneur:"
echo "    docker logs <container_id>"
echo ""
echo "  Démarrer un conteneur arrêté:"
echo "    docker start <container_id>"
echo ""
echo "  Forcer l'arrêt d'un conteneur:"
echo "    docker kill <container_id>"
echo ""
echo "  Supprimer un conteneur:"
echo "    docker rm <container_id>"
echo ""
echo "  Voir les logs du backend:"
echo "    journalctl -u obsidian-backend -f"
echo ""
