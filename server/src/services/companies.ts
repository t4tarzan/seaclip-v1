/**
 * companies service — CRUD operations on the companies table.
 *
 * Uses Drizzle ORM against the `companies` table from @seaclip/db.
 *
 * Interface notes:
 *  - `slug` is derived from `name` at read time (no dedicated column in schema).
 *  - `logoUrl` is not stored in the schema; always returned as undefined.
 *  - `settings` is not stored in the schema; always returned as {}.
 *  - Slug uniqueness is enforced by checking for a matching name-derived slug
 *    across all companies at write time.
 */
import { getDb } from "../db.js";
import { eq, asc } from "drizzle-orm";
import { companies as companiesTable } from "@seaclip/db";
import { notFound, conflict } from "../errors.js";

export interface Company {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateCompanyInput {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Map a DB row to the public Company interface. */
function rowToCompany(row: typeof companiesTable.$inferSelect): Company {
  return {
    id: row.id,
    name: row.name,
    slug: generateSlug(row.name),
    description: row.description ?? undefined,
    logoUrl: undefined,
    settings: {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listCompanies(): Promise<Company[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(companiesTable)
    .orderBy(asc(companiesTable.createdAt));
  return rows.map(rowToCompany);
}

export async function createCompany(input: CreateCompanyInput): Promise<Company> {
  const db = getDb();
  const slug = input.slug ?? generateSlug(input.name);

  // Check slug uniqueness — slug is derived from name, so we check whether
  // any existing company would produce the same slug.
  const existing = await db
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable);

  for (const row of existing) {
    if (generateSlug(row.name) === slug) {
      throw conflict(`A company with slug "${slug}" already exists`);
    }
  }

  const [row] = await db
    .insert(companiesTable)
    .values({
      name: input.name,
      description: input.description ?? null,
    })
    .returning();

  return rowToCompany(row);
}

export async function getCompany(id: string): Promise<Company> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!row) {
    throw notFound(`Company "${id}" not found`);
  }

  return rowToCompany(row);
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
): Promise<Company> {
  const db = getDb();

  // Verify existence first
  const [existing] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!existing) {
    throw notFound(`Company "${id}" not found`);
  }

  // If a new slug is requested, derive the target name and check uniqueness
  if (input.slug) {
    const allRows = await db
      .select({ id: companiesTable.id, name: companiesTable.name })
      .from(companiesTable);

    for (const row of allRows) {
      if (row.id !== id && generateSlug(row.name) === input.slug) {
        throw conflict(`A company with slug "${input.slug}" already exists`);
      }
    }
  }

  const updateValues: Partial<typeof companiesTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.description !== undefined) updateValues.description = input.description;

  const [updated] = await db
    .update(companiesTable)
    .set(updateValues)
    .where(eq(companiesTable.id, id))
    .returning();

  return rowToCompany(updated);
}

export async function deleteCompany(id: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!existing) {
    throw notFound(`Company "${id}" not found`);
  }

  await db.delete(companiesTable).where(eq(companiesTable.id, id));
}
