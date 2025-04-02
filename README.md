# @ratesspot/prisma-api-gen

Generate grouped modules, routes, tests, and OpenAPI docs from your Prisma schema.

## 🚀 Usage (CLI)

```bash
npx prisma-api-gen --all --output src/modules
```

### Options

| Flag            | Description                                               |
|-----------------|-----------------------------------------------------------|
| `--model`       | Comma-separated model names to generate (`User,Booking`)  |
| `--all`         | Generate all models in schema                             |
| `--new`         | Generate only models that don’t have folders              |
| `--force`       | Overwrite existing files                                  |
| `--purgeRoutes` | Regenerate all `routes.ts` files                          |
| `--withTests`   | Generate Vitest service & controller test files           |
| `--withDocs`    | Generate OpenAPI doc stubs                                |
| `--dryRun`      | Preview files without writing                             |

---

## 🔌 Prisma Generator

To run as a Prisma plugin:

```prisma
generator modules {
  provider = "prisma-api-gen"
  output   = "./src/modules"
}
```

Then run:

```bash
npx prisma generate
```

Each model will generate a folder in the specified output directory.

---

## 🧪 Testing Support

- Generates service + controller test stubs
- Compatible with [Vitest](https://vitest.dev/)

---

## 📚 Docs (WIP)

- Swagger-compatible OpenAPI generation coming soon
- Postman collection export planned

---

## 🛠 Dev

```bash
npm install
npm run build
```

---

MIT © 2025 Ratesspot
