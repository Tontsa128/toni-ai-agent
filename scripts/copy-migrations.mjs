import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("storage", "migrations");
const destination = resolve("dist", "storage", "migrations");
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`Copied SQL migrations to ${destination}`);
