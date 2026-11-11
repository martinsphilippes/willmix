/**
 * Gera supabase/schema.sql a partir de src/lib/db/schema.ts.
 * Uso: npm run supabase:sql
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { schemaSql } from "../src/lib/db/supabase-sql.ts";

const out = resolve(import.meta.dirname, "..", "supabase", "schema.sql");
writeFileSync(out, schemaSql());
console.log(`✓ ${out}`);
