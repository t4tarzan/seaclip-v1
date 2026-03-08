import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as companiesService from "../services/companies.js";

const router = Router();

const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().optional(),
  settings: z.record(z.unknown()).optional(),
});

const UpdateCompanySchema = CreateCompanySchema.partial();

// GET /api/companies
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const companies = await companiesService.listCompanies();
    res.json({ data: companies, count: companies.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies
router.post("/", requireAuth, validate(CreateCompanySchema), async (req, res, next) => {
  try {
    const company = await companiesService.createCompany(req.body);
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const company = await companiesService.getCompany(String(req.params.id));
    res.json(company);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:id
router.patch("/:id", requireAuth, validate(UpdateCompanySchema), async (req, res, next) => {
  try {
    const company = await companiesService.updateCompany(String(req.params.id), req.body);
    res.json(company);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await companiesService.deleteCompany(String(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export { router as companiesRouter };
