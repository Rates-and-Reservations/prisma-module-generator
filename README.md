# 🛠 Prisma API Generator

[![npm version](https://img.shields.io/npm/v/prisma-api-gen.svg)](https://www.npmjs.com/package/prisma-api-gen)

This is a CLI tool for scaffolding module folders (service, controller, routes, schema) based on models in your `schema.prisma`. It supports optional grouping of models using `@group` comments for better folder organization.

---

## 📦 Installation

Run this in your project root:

```bash
npm link
```

> ⚠️ If you see an `EEXIST` error, remove the existing file:
>
> ```bash
> sudo rm /usr/local/bin/npx prisma-api-gen
> npm link
> ```

---

## 🚀 Usage

```bash
npx prisma-api-gen [options]
```

### Options

| Option              | Type      | Default     | Description                                                        |
|---------------------|-----------|-------------|--------------------------------------------------------------------|
| `--model`           | string    |             | Generate module for a specific model name                         |
| `--all`             | boolean   | false       | Generate modules for **all** models in `schema.prisma`            |
| `--new`             | boolean   | false       | Generate modules only for models without existing folders         |
| `--output`          | string    | `src/modules` | Target folder for module generation                              |
| `--withController`  | boolean   | true        | Whether to generate controller file                               |
| `--withRoutes`      | boolean   | true        | Whether to generate routes file                                   |
| `--withSchema`      | boolean   | true        | Whether to generate Zod schema file                               |
| `--force`           | boolean   | false       | Overwrite existing files                                          |
| `--dryRun`          | boolean   | false       | Simulate generation without writing any files                     |

---

## 🧩 Grouping Modules

Add a comment above your Prisma model like this:

```prisma
/// @group billing
model Invoice {
  id        String   @id @default(uuid())
  total     Float
  createdAt DateTime @default(now())
}
```

This will generate a folder like:

```
src/modules/billing/invoice/
```

And update your `src/modules/routes.ts` automatically to include:

```ts
import invoiceRoutes from './billing/invoice/invoice.routes';
router.use('/invoice', invoiceRoutes);
```

---

## 💡 Examples

Generate all modules:

```bash
npx prisma-api-gen --all
```

Generate only missing ones:

```bash
npx prisma-api-gen --new
```

Generate a single model:

```bash
npx prisma-api-gen --model Booking
```

Dry run (preview changes):

```bash
npx prisma-api-gen --all --dryRun
```

Force overwrite:

```bash
npx prisma-api-gen --model Booking --force
```

---

## 📁 Output Structure

Each generated module includes:

```
model/
├── model.service.ts
├── model.controller.ts     (optional)
├── model.routes.ts         (optional)
└── model.schema.ts         (optional)
```

---

## ➕ Custom Routes

You can define additional routes per model by creating a `custom-routes.json` file in your project root.

Example:

```json
{
  "User": [
    { "name": "disable", "method": "post", "path": "/:id/disable", "description": "Disable a user" }
  ]
}
```

This will generate:

* A new controller.disable method

* A route in router.post('/:id/disable', controller.disable);

---

## 📜 License

MIT
