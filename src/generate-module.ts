#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('model', {
    type: 'string',
    describe: 'Generate module for a specific model',
  })
  .option('all', {
    type: 'boolean',
    describe: 'Generate modules for all models in schema.prisma',
  })
  .option('new', {
    type: 'boolean',
    describe: 'Generate modules only for models without an existing folder',
  })
  .option('output', {
    type: 'string',
    default: 'src/modules',
    describe: 'Output directory for generated module',
  })
  .option('withController', {
    type: 'boolean',
    default: true,
    describe: 'Generate controller file',
  })
  .option('withRoutes', {
    type: 'boolean',
    default: true,
    describe: 'Generate routes file',
  })
  .option('withSchema', {
    type: 'boolean',
    default: true,
    describe: 'Generate Zod schema file',
  })
  .option('force', {
    type: 'boolean',
    default: false,
    describe: 'Overwrite existing files if they exist',
  })
  .option('dryRun', {
    type: 'boolean',
    default: false,
    describe: 'Show what would be created without writing files',
  })
  .check((argv) => {
    if (!argv.model && !argv.all && !argv.new) {
      throw new Error('You must provide either --model, --all, or --new');
    }
    return true;
  })
  .help()
  .parseSync();

const { model, all, new: onlyNew, output, withController, withRoutes, withSchema, force, dryRun } = argv;

const SCHEMA_PATH = path.join(process.cwd(), 'prisma/schema.prisma');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
const modelRegex = /(?:\/\/\/\s*@group\s+(\w+)\s*\n)?model\s+(\w+)\s+{/g;

const modelInfos: { name: string; group?: string }[] = [];
let match;
while ((match = modelRegex.exec(schema)) !== null) {
  const [, group, name] = match;
  modelInfos.push({ name, group });
}

const modelsToGenerate = model
  ? modelInfos.filter((m) => m.name === model)
  : all
  ? modelInfos
  : onlyNew
  ? modelInfos.filter((m) => !fs.existsSync(path.join(process.cwd(), output, ...(m.group ? [m.group] : []), m.name.toLowerCase())))
  : [];

const rootRoutePath = path.join(process.cwd(), output, 'routes.ts');

const generateModule = ({ name: modelName, group }: { name: string; group?: string }) => {
  const lcModel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const ucModel = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const moduleDir = path.join(process.cwd(), output, ...(group ? [group] : []), lcModel);

  if (dryRun) {
    console.log(`📝 [Dry Run] Would create module directory: ${moduleDir}`);
  } else if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir, { recursive: true });
    console.log(`✅ Created module directory: ${moduleDir}`);
  }

  const writeFile = (filename: string, content: string) => {
    const filePath = path.join(moduleDir, filename);
    if (dryRun) {
      console.log(`📝 [Dry Run] Would write: ${filename}`);
      return;
    }
    if (fs.existsSync(filePath) && !force) {
      console.log(`⚠️ Skipped (already exists): ${filename}`);
      return;
    }
    fs.writeFileSync(filePath, content);
    console.log(`${fs.existsSync(filePath) ? '♻️ Overwrote' : '✅ Created'}: ${filename}`);
  };

  writeFile(
    `${lcModel}.service.ts`,
    `import prisma from '@/clients/prisma';
import { Prisma } from '@prisma/client';

type ${ucModel}CreateInput = Prisma.${ucModel}CreateInput;
type ${ucModel}UpdateInput = Prisma.${ucModel}UpdateInput;

export const create${ucModel} = async (data: ${ucModel}CreateInput) => {
  return prisma.${lcModel}.create({ data });
};

export const get${ucModel}ById = async (id: string) => {
  return prisma.${lcModel}.findUnique({ where: { id } });
};

export const list${ucModel}s = async (filter: any = {}) => {
  return prisma.${lcModel}.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
};

export const update${ucModel} = async (id: string, data: ${ucModel}UpdateInput) => {
  return prisma.${lcModel}.update({ where: { id }, data });
};

export const delete${ucModel} = async (id: string) => {
  return prisma.${lcModel}.update({ where: { id }, data: { deletedAt: new Date() } });
};
`
  );

  if (withController) {
    writeFile(
      `${lcModel}.controller.ts`,
      `import * as ${ucModel}Service from './${lcModel}.service';
import { Request, Response } from 'express';

export const create = async (req: Request, res: Response) => {
  const result = await ${ucModel}Service.create${ucModel}(req.body);
  res.json(result);
};

export const list = async (_req: Request, res: Response) => {
  const results = await ${ucModel}Service.list${ucModel}s();
  res.json(results);
};

export const getById = async (req: Request, res: Response) => {
  const result = await ${ucModel}Service.get${ucModel}ById(req.params.id);
  res.json(result);
};

export const update = async (req: Request, res: Response) => {
  const result = await ${ucModel}Service.update${ucModel}(req.params.id, req.body);
  res.json(result);
};

export const deleteOne = async (req: Request, res: Response) => {
  const result = await ${ucModel}Service.delete${ucModel}(req.params.id);
  res.json(result);
};
`
    );
  }

  if (withRoutes) {
    writeFile(
      `${lcModel}.routes.ts`,
      `import express from 'express';
import * as controller from './${lcModel}.controller';

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.deleteOne);

export default router;
`
    );
  }

  if (withSchema) {
    writeFile(
      `${lcModel}.schema.ts`,
      `import { z } from 'zod';

export const ${ucModel}CreateSchema = z.object({
  // Add fields based on your model
});

export const ${ucModel}UpdateSchema = z.object({
  // Add fields based on your model
});
`
    );
  }

  if (!dryRun && withRoutes) {
    const routeImport = `import ${lcModel}Routes from './${[group, lcModel].filter(Boolean).join('/')}/${lcModel}.routes';`;
    const routeUse = `router.use('/${lcModel}', ${lcModel}Routes);`;

    let rootContent = '';
    if (fs.existsSync(rootRoutePath)) {
      rootContent = fs.readFileSync(rootRoutePath, 'utf8');
    } else {
      rootContent = `import express from 'express';\nconst router = express.Router();\n\nexport default router;\n`;
    }

    if (!rootContent.includes(routeImport)) {
      rootContent = `${routeImport}\n${rootContent}`;
    }

    if (!rootContent.includes(routeUse)) {
      rootContent = rootContent.replace('export default router;', `${routeUse}\n\nexport default router;`);
    }

    fs.writeFileSync(rootRoutePath, rootContent);
    console.log(`✅ Updated root route file: ${rootRoutePath}`);
  }

  if (dryRun) {
    console.log(`\n🎉 [Dry Run] ${modelName} module would be scaffolded in ${output}/${group ? group + '/' : ''}${lcModel}`);
  } else {
    console.log(`\n🎉 ${modelName} module scaffolded successfully in ${output}/${group ? group + '/' : ''}${lcModel}`);
  }
};

modelsToGenerate.forEach(generateModule);
