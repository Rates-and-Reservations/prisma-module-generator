#!/usr/bin/env ts-node
// @ts-check

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

const modelRegex = /(?:\/\/\/\s*@group\s*(\w+)\s*\n)?model\s+(\w+)\s+{/g;
const modelNames: string[] = [];
const groupings: Record<string, string> = {};

let match;
while ((match = modelRegex.exec(schema)) !== null) {
  const [, group, modelName] = match;
  modelNames.push(modelName);
  if (group) {
    groupings[modelName] = group;
  }
}

const argv = yargs(hideBin(process.argv))
  .option('model', { type: 'string', describe: 'Generate module for one or more models (comma-separated)' })
  .option('all', { type: 'boolean', describe: 'Generate modules for all models in schema.prisma' })
  .option('new', { type: 'boolean', describe: 'Generate modules only for models without an existing folder' })
  .option('output', { type: 'string', default: 'src/modules', describe: 'Output directory for generated module' })
  .option('withController', { type: 'boolean', default: true, describe: 'Generate controller file' })
  .option('withRoutes', { type: 'boolean', default: true, describe: 'Generate routes file' })
  .option('withSchema', { type: 'boolean', default: true, describe: 'Generate Zod schema file' })
  .option('withCustom', { type: 'boolean', default: true, describe: 'Generate custom controller and route files' })
  .option('withTests', { type: 'boolean', default: true, describe: 'Generate test files for services and controllers' })
  .option('withDocs', { type: 'boolean', default: true, describe: 'Generate Swagger-compatible OpenAPI docs' })
  .option('force', { type: 'boolean', default: false, describe: 'Overwrite existing files if they exist' })
  .option('dryRun', { type: 'boolean', default: false, describe: 'Show what would be created without writing files' })
  .option('list', { type: 'boolean', default: false, describe: 'List groups and models only without generating files' })
  .option('purgeRoutes', { type: 'boolean', default: false, describe: 'Remove existing routes.ts files before regenerating' })
  .check((argv) => {
    if (!argv.model && !argv.all && !argv.new && !argv.list) {
      throw new Error('You must provide either --model, --all, --new, or --list');
    }
    if (argv.model) {
      const requested = argv.model.split(',').map((m) => m.trim());
      const invalid = requested.filter((m) => !modelNames.includes(m));
      if (invalid.length > 0) {
        throw new Error(`Invalid model name(s): ${invalid.join(', ')}`);
      }
    }
    return true;
  })
  .help()
  .parseSync();

const { model, all, new: onlyNew, output, withController, withRoutes, withSchema, withCustom, withTests, withDocs, force, dryRun, list, purgeRoutes } = argv;

const modelsToGenerate = model
  ? model.split(',').map((m) => m.trim())
  : all
  ? modelNames
  : onlyNew
  ? modelNames.filter((m) => {
      const group = groupings[m] || '';
      return !fs.existsSync(path.join(__dirname, '..', output, group, m.toLowerCase()));
    })
  : [];

const groupedModels: Record<string, string[]> = {};
modelsToGenerate.forEach((modelName) => {
  const group = groupings[modelName] || 'ungrouped';
  groupedModels[group] = groupedModels[group] || [];
  groupedModels[group].push(modelName);
});

console.log('\n📦 Modules to generate by group:');
Object.entries(groupedModels).forEach(([group, models]) => {
  console.log(`\n🔹 ${group}`);
  models.forEach((m) => console.log(`   - ${m}`));
});

if (list) process.exit(0);

const rootRoutePath = path.join(__dirname, '..', output, 'routes.ts');
if (purgeRoutes && fs.existsSync(rootRoutePath)) {
  fs.rmSync(rootRoutePath);
  console.log('🧹 Removed root routes.ts');
}

const rootImports: string[] = [];
const rootUses: string[] = [];

Object.entries(groupedModels).forEach(([group, modelList]) => {
  const groupRouteFile = path.join(__dirname, '..', output, group, 'routes.ts');
  if (purgeRoutes && fs.existsSync(groupRouteFile)) {
    fs.rmSync(groupRouteFile);
    console.log(`🧹 Removed ${group}/routes.ts`);
  }

  const importStatements: string[] = [];
  const useStatements: string[] = [];

  modelList.forEach((modelName) => {
    const lcModel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    importStatements.push(`import ${lcModel}Routes from './${lcModel}/${lcModel}.routes';`);
    useStatements.push(`router.use('/${lcModel}', ${lcModel}Routes);`);

    if (withTests) {
      const testFolder = path.join(__dirname, '..', output, group, lcModel);
      const serviceTest = path.join(testFolder, `${lcModel}.service.test.ts`);
      const controllerTest = path.join(testFolder, `${lcModel}.controller.test.ts`);

      if (!dryRun && (!fs.existsSync(serviceTest) || force)) {
        fs.writeFileSync(
          serviceTest,
          `import { describe, it, expect } from 'vitest';
import * as service from './${lcModel}.service';

describe('${lcModel} service', () => {
  it('should have create function', () => {
    expect(typeof service.create${modelName}).toBe('function');
  });
});`
        );
        console.log(`✅ Created test: ${serviceTest}`);
      }

      if (!dryRun && (!fs.existsSync(controllerTest) || force)) {
        fs.writeFileSync(
          controllerTest,
          `import { describe, it, expect } from 'vitest';
import * as controller from './${lcModel}.controller';

describe('${lcModel} controller', () => {
  it('should have create method', () => {
    expect(typeof controller.create).toBe('function');
  });
});`
        );
        console.log(`✅ Created test: ${controllerTest}`);
      }
    }
  });

  const groupMiddlewarePath = `./${group}/middleware`;
  const middlewareImport = `import { apply${group.charAt(0).toUpperCase() + group.slice(1)}Middleware } from '${groupMiddlewarePath}';`;
  const middlewareUse = `apply${group.charAt(0).toUpperCase() + group.slice(1)}Middleware(router);`;

  const groupRouteContent = `import express from 'express';
${middlewareImport}
${importStatements.join('\n')}

const router = express.Router();

${middlewareUse}
${useStatements.join('\n')}

export default router;`;

  const groupMiddlewareFile = path.join(__dirname, '..', output, group, 'middleware.ts');
  if (!fs.existsSync(groupMiddlewareFile)) {
    fs.writeFileSync(
      groupMiddlewareFile,
      `import { Router } from 'express';

export const apply${group.charAt(0).toUpperCase() + group.slice(1)}Middleware = (router: Router) => {
  // router.use(authMiddleware); // example
};`
    );
    console.log(`✅ Created middleware stub: ${groupMiddlewareFile}`);
  }

  if (!dryRun) {
    fs.writeFileSync(groupRouteFile, groupRouteContent);
    console.log(`✅ Group-level route file created: ${groupRouteFile}`);
  } else {
    console.log(`📝 [Dry Run] Would create group-level route file: ${groupRouteFile}`);
  }

  rootImports.push(`import ${group}Routes from './${group}/routes';`);
  rootUses.push(`router.use('/${group}', ${group}Routes);`);
});

const rootRouteContent = `import express from 'express';
${rootImports.join('\n')}

const router = express.Router();

${rootUses.join('\n')}

export default router;`;

if (!dryRun) {
  fs.writeFileSync(rootRoutePath, rootRouteContent);
  console.log(`✅ Root route file created: ${rootRoutePath}`);
} else {
  console.log(`📝 [Dry Run] Would create root route file: ${rootRoutePath}`);
}
