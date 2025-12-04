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
      {
        name: 'minecraft-java',
        displayName: 'Minecraft Java Edition',
        category: 'minecraft',
        description: 'Vanilla Minecraft Java server with support for Paper, Spigot, Forge, and Fabric',
        dockerImage: 'itzg/minecraft-server:latest',
        defaultPort: 25565,
        defaultQueryPort: 25565,
        defaultRconPort: 25575,
        defaultMemory: 2048,
        defaultCpu: 2.0,
        defaultDisk: 10240,
        startupCommand: '',
        configSchema: JSON.stringify({
          version: { type: 'string', default: 'LATEST', description: 'Minecraft version' },
          serverType: { type: 'select', options: ['VANILLA', 'PAPER', 'SPIGOT', 'FORGE', 'FABRIC'], default: 'VANILLA' },
          difficulty: { type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
          gamemode: { type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], default: 'survival' },
          maxPlayers: { type: 'number', min: 1, max: 100, default: 20 },
          motd: { type: 'string', default: 'A Minecraft Server' },
          onlineMode: { type: 'boolean', default: true },
          pvp: { type: 'boolean', default: true },
          allowNether: { type: 'boolean', default: true }
        }),
        envTemplate: JSON.stringify({
          EULA: 'TRUE'
        })
      },
      {
        name: 'minecraft-bedrock',
        displayName: 'Minecraft Bedrock Edition',
        category: 'minecraft',
        description: 'Official Minecraft Bedrock Dedicated Server',
        dockerImage: 'itzg/minecraft-bedrock-server:latest',
        defaultPort: 19132,
        defaultQueryPort: 19132,
        defaultRconPort: null,
        defaultMemory: 1024,
        defaultCpu: 1.0,
        defaultDisk: 5120,
        startupCommand: '',
        configSchema: JSON.stringify({
          version: { type: 'string', default: 'LATEST', description: 'Bedrock version' },
          difficulty: { type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
          gamemode: { type: 'select', options: ['survival', 'creative', 'adventure'], default: 'survival' },
          maxPlayers: { type: 'number', min: 1, max: 30, default: 10 }
        }),
        envTemplate: JSON.stringify({
          EULA: 'TRUE'
        })
      },
      {
        name: 'csgo',
        displayName: 'Counter-Strike: Global Offensive',
        category: 'steamcmd',
        description: 'CS:GO Dedicated Server via SteamCMD',
        dockerImage: 'cm2network/csgo:latest',
        defaultPort: 27015,
        defaultQueryPort: 27015,
        defaultRconPort: 27015,
        defaultMemory: 2048,
        defaultCpu: 2.0,
        defaultDisk: 30720,
        startupCommand: './srcds_run -game csgo',
        configSchema: JSON.stringify({
          maxPlayers: { type: 'number', min: 2, max: 64, default: 16 },
          tickrate: { type: 'select', options: ['64', '128'], default: '64' },
          gameType: { type: 'select', options: ['0', '1', '2', '3', '4', '5'], default: '0' },
          gameMode: { type: 'select', options: ['0', '1', '2'], default: '0' }
        }),
        envTemplate: JSON.stringify({
          SRCDS_TOKEN: ''
        })
      },
      {
        name: 'cs2',
        displayName: 'Counter-Strike 2',
        category: 'steamcmd',
        description: 'CS2 Dedicated Server via SteamCMD',
        dockerImage: 'joedwards32/cs2:latest',
        defaultPort: 27015,
        defaultQueryPort: 27015,
        defaultRconPort: 27015,
        defaultMemory: 4096,
        defaultCpu: 2.0,
        defaultDisk: 40960,
        startupCommand: '',
        configSchema: JSON.stringify({
          maxPlayers: { type: 'number', min: 2, max: 64, default: 16 },
          tickrate: { type: 'select', options: ['64', '128'], default: '128' },
          gameType: { type: 'select', options: ['0', '1', '2', '3'], default: '0' },
          gameMode: { type: 'select', options: ['0', '1', '2'], default: '0' }
        }),
        envTemplate: JSON.stringify({
          CS2_SERVERNAME: 'CS2 Server'
        })
      },
      {
        name: 'valheim',
        displayName: 'Valheim',
        category: 'steamcmd',
        description: 'Valheim Dedicated Server',
        dockerImage: 'lloesche/valheim-server:latest',
        defaultPort: 2456,
        defaultQueryPort: 2457,
        defaultRconPort: null,
        defaultMemory: 4096,
        defaultCpu: 2.0,
        defaultDisk: 5120,
        startupCommand: '',
        configSchema: JSON.stringify({
          serverName: { type: 'string', default: 'Valheim Server' },
          worldName: { type: 'string', default: 'Dedicated' },
          password: { type: 'string', default: '' },
          public: { type: 'boolean', default: true }
        }),
        envTemplate: JSON.stringify({
          SERVER_NAME: 'Valheim Server',
          WORLD_NAME: 'Dedicated',
          SERVER_PASS: '',
          SERVER_PUBLIC: 'true'
        })
      },
      {
        name: 'rust',
        displayName: 'Rust',
        category: 'steamcmd',
        description: 'Rust Dedicated Server',
        dockerImage: 'didstopia/rust-server:latest',
        defaultPort: 28015,
        defaultQueryPort: 28016,
        defaultRconPort: 28016,
        defaultMemory: 8192,
        defaultCpu: 4.0,
        defaultDisk: 20480,
        startupCommand: '',
        configSchema: JSON.stringify({
          serverName: { type: 'string', default: 'Rust Server' },
          maxPlayers: { type: 'number', min: 10, max: 500, default: 100 },
          worldSize: { type: 'number', min: 1000, max: 6000, default: 3500 },
          seed: { type: 'number', default: 12345 }
        }),
        envTemplate: JSON.stringify({
          RUST_SERVER_NAME: 'Rust Server',
          RUST_SERVER_MAXPLAYERS: '100',
          RUST_SERVER_WORLDSIZE: '3500'
        })
      },
      {
        name: 'terraria',
        displayName: 'Terraria',
        category: 'steamcmd',
        description: 'Terraria Dedicated Server',
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
          difficulty: { type: 'select', options: ['0', '1', '2', '3'], default: '0' }
        }),
        envTemplate: JSON.stringify({
          WORLD_FILENAME: 'world.wld'
        })
      },
      {
        name: 'ark',
        displayName: 'ARK: Survival Evolved',
        category: 'steamcmd',
        description: 'ARK Dedicated Server',
        dockerImage: 'hermsi/ark-server:latest',
        defaultPort: 7777,
        defaultQueryPort: 27015,
        defaultRconPort: 27020,
        defaultMemory: 8192,
        defaultCpu: 4.0,
        defaultDisk: 51200,
        startupCommand: '',
        configSchema: JSON.stringify({
          sessionName: { type: 'string', default: 'ARK Server' },
          maxPlayers: { type: 'number', min: 1, max: 127, default: 70 },
          map: { type: 'select', options: ['TheIsland', 'TheCenter', 'Ragnarok', 'Aberration', 'Extinction', 'Valguero', 'Genesis', 'CrystalIsles', 'LostIsland', 'Fjordur'], default: 'TheIsland' }
        }),
        envTemplate: JSON.stringify({
          SESSIONNAME: 'ARK Server',
          am_ark_MaxPlayers: '70'
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
