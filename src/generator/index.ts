import { generatorHandler } from '@prisma/generator-helper';

// Optional: Use fs/promises if Bun is not available
import fs from 'fs/promises';
import path from 'path';

const toCamel = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

// Prisma Generator Entry Point
export default generatorHandler({
  onGenerate: async ({ dmmf, generator }) => {
    const output = generator.output?.value || './generated';
    const models = dmmf.datamodel.models;

    for (const model of models) {
      const lc = toCamel(model.name);
      const dir = path.join(output, lc);
      const file = path.join(dir, `${lc}.service.ts`);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        file,
        `// Prisma-generated service for ${model.name}\nexport const create${model.name} = () => {/* ... */}`
      );
      console.log(`✅ Generated ${file}`);
    }
  },
});
