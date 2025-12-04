import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all game templates
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await prisma.gameTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }]
    });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching game templates:', error);
    res.status(500).json({ error: 'Failed to fetch game templates' });
  }
});

// Get single template
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const template = await prisma.gameTemplate.findUnique({
      where: { id: req.params.id }
    });

    if (!template) {
      res.status(404).json({ error: 'Game template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching game template:', error);
    res.status(500).json({ error: 'Failed to fetch game template' });
  }
});

// Create game template (admin only)
router.post(
  '/',
  requireAdmin,
  [
    body('name').isLength({ min: 1, max: 64 }).trim(),
    body('displayName').isLength({ min: 1, max: 128 }).trim(),
    body('category').isIn(['minecraft', 'steamcmd']),
    body('description').optional().isString(),
    body('dockerImage').notEmpty(),
    body('defaultPort').isInt({ min: 1024, max: 65535 }),
    body('defaultQueryPort').optional().isInt({ min: 1024, max: 65535 }),
    body('defaultRconPort').optional().isInt({ min: 1024, max: 65535 }),
    body('defaultMemory').optional().isInt({ min: 512, max: 32768 }),
    body('defaultCpu').optional().isFloat({ min: 0.5, max: 16 }),
    body('startupCommand').notEmpty(),
    body('configSchema').optional().isObject(),
    body('envTemplate').optional().isObject()
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const template = await prisma.gameTemplate.create({
        data: {
          ...req.body,
          configSchema: JSON.stringify(req.body.configSchema || {}),
          envTemplate: JSON.stringify(req.body.envTemplate || {})
        }
      });
      res.status(201).json(template);
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Template with this name already exists' });
        return;
      }
      console.error('Error creating game template:', error);
      res.status(500).json({ error: 'Failed to create game template' });
    }
  }
);

// Update game template (admin only)
router.patch(
  '/:id',
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const updateData = { ...req.body };
      if (updateData.configSchema) {
        updateData.configSchema = JSON.stringify(updateData.configSchema);
      }
      if (updateData.envTemplate) {
        updateData.envTemplate = JSON.stringify(updateData.envTemplate);
      }

      const template = await prisma.gameTemplate.update({
        where: { id: req.params.id },
        data: updateData
      });
      res.json(template);
    } catch (error: any) {
      console.error('Error updating game template:', error);
      res.status(500).json({ error: 'Failed to update game template' });
    }
  }
);

// Delete game template (admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.gameTemplate.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Game template deleted' });
  } catch (error) {
    console.error('Error deleting game template:', error);
    res.status(500).json({ error: 'Failed to delete game template' });
  }
});

// Seed default game templates
router.post('/seed', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const defaultTemplates = [
      // ==================== MINECRAFT ====================
      {
        name: 'minecraft-java',
        displayName: 'Minecraft Java Edition',
        category: 'minecraft',
        description: 'Serveur Minecraft Java avec support Paper, Spigot, Forge et Fabric',
        dockerImage: 'itzg/minecraft-server:latest',
        defaultPort: 25565,
        defaultQueryPort: 25565,
        defaultRconPort: 25575,
        defaultMemory: 2048,
        defaultCpu: 2.0,
        defaultDisk: 10240,
        startupCommand: '',
        configSchema: JSON.stringify({
          version: { type: 'string', default: 'LATEST', description: 'Version Minecraft' },
          serverType: { type: 'select', options: ['VANILLA', 'PAPER', 'SPIGOT', 'FORGE', 'FABRIC'], default: 'VANILLA' },
          difficulty: { type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
          gamemode: { type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], default: 'survival' },
          maxPlayers: { type: 'number', min: 1, max: 100, default: 20 },
          motd: { type: 'string', default: 'Un serveur Minecraft' },
          onlineMode: { type: 'boolean', default: true },
          pvp: { type: 'boolean', default: true },
          allowNether: { type: 'boolean', default: true }
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
      // ==================== SOURCE ENGINE (GMod, CS2) ====================
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
      // ==================== VALHEIM ====================
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
      // ==================== PALWORLD ====================
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
      // ==================== CORE KEEPER ====================
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
      // ==================== TERRARIA ====================
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
      // ==================== VINTAGE STORY ====================
      {
        name: 'vintage-story',
        displayName: 'Vintage Story',
        category: 'steamcmd',
        description: 'Serveur Vintage Story - Survie médiévale réaliste',
        dockerImage: 'devidian/vintagestory:latest',
        defaultPort: 42420,
        defaultQueryPort: 42420,
        defaultRconPort: null,
        defaultMemory: 4096,
        defaultCpu: 2.0,
        defaultDisk: 10240,
        startupCommand: '',
        configSchema: JSON.stringify({
          serverName: { type: 'string', default: 'Vintage Story Server' },
          maxPlayers: { type: 'number', min: 1, max: 100, default: 16 },
          password: { type: 'string', default: '' },
          worldSeed: { type: 'string', default: '' },
          mapSizeX: { type: 'number', min: 100000, max: 10000000, default: 1024000 },
          mapSizeZ: { type: 'number', min: 100000, max: 10000000, default: 1024000 }
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
      },
      // ==================== STARDEW VALLEY ====================
      {
        name: 'stardew-valley',
        displayName: 'Stardew Valley',
        category: 'other',
        description: 'Serveur Stardew Valley multijoueur',
        dockerImage: 'noenv/stardewvalley-server:latest',
        defaultPort: 24642,
        defaultQueryPort: 24642,
        defaultRconPort: null,
        defaultMemory: 1024,
        defaultCpu: 1.0,
        defaultDisk: 2048,
        startupCommand: '',
        configSchema: JSON.stringify({
          farmName: { type: 'string', default: 'Obsidian Farm' },
          maxPlayers: { type: 'number', min: 1, max: 8, default: 4 },
          profitMargin: { type: 'select', options: [
            { value: '1', label: '100% (Normal)' },
            { value: '0.75', label: '75%' },
            { value: '0.5', label: '50%' },
            { value: '0.25', label: '25%' }
          ], default: '1' }
        }),
        envTemplate: JSON.stringify({}),
        portConfig: JSON.stringify({
          portRanges: [
            { port: 24642 },
            { port: 24643 },
            { port: 24644 },
            { port: 24645 },
            { port: 24646 },
            { port: 24647 }
          ],
          protocol: 'udp'
        })
      },
      // ==================== HYTALE (PLACEHOLDER) ====================
      {
        name: 'hytale',
        displayName: 'Hytale',
        category: 'other',
        description: 'Serveur Hytale (À venir - Placeholder)',
        dockerImage: 'placeholder/hytale:latest',
        defaultPort: 25000,
        defaultQueryPort: 25000,
        defaultRconPort: null,
        defaultMemory: 4096,
        defaultCpu: 2.0,
        defaultDisk: 20480,
        startupCommand: '',
        configSchema: JSON.stringify({
          serverName: { type: 'string', default: 'Hytale Server' },
          maxPlayers: { type: 'number', min: 1, max: 100, default: 20 }
        }),
        envTemplate: JSON.stringify({}),
        portConfig: JSON.stringify({
          portRanges: [
            { port: 25000 },
            { port: 25001 },
            { port: 25002 },
            { port: 25003 },
            { port: 25004 },
            { port: 25005 }
          ],
          protocol: 'tcp+udp',
          note: 'Ports placeholder - le jeu n\'est pas encore sorti'
        })
      },
      // ==================== ABIOTIC FACTOR ====================
      {
        name: 'abiotic-factor',
        displayName: 'Abiotic Factor',
        category: 'steamcmd',
        description: 'Serveur Abiotic Factor - Survie coopérative dans une installation scientifique',
        dockerImage: 'ich777/steamcmd:abiotic-factor',
        defaultPort: 7777,
        defaultQueryPort: 27015,
        defaultRconPort: null,
        defaultMemory: 4096,
        defaultCpu: 2.0,
        defaultDisk: 10240,
        startupCommand: '',
        configSchema: JSON.stringify({
          serverName: { type: 'string', default: 'Abiotic Factor Server' },
          maxPlayers: { type: 'number', min: 1, max: 6, default: 6 },
          password: { type: 'string', default: '' },
          saveInterval: { type: 'number', min: 60, max: 3600, default: 300, description: 'Intervalle de sauvegarde en secondes' }
        }),
        envTemplate: JSON.stringify({}),
        portConfig: JSON.stringify({
          portRanges: [
            { port: 7777, query: 27015 },
            { port: 7778, query: 27016 },
            { port: 7779, query: 27017 },
            { port: 7780, query: 27018 },
            { port: 7781, query: 27019 },
            { port: 7782, query: 27020 }
          ],
          protocol: 'udp'
        })
      }
    ];

    for (const template of defaultTemplates) {
      await prisma.gameTemplate.upsert({
        where: { name: template.name },
        update: template,
        create: template
      });
    }

    res.json({ message: 'Default game templates seeded successfully', count: defaultTemplates.length });
  } catch (error) {
    console.error('Error seeding game templates:', error);
    res.status(500).json({ error: 'Failed to seed game templates' });
  }
});

export { router as gameTemplateRouter };
