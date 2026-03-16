import { Router } from "express";
import { z } from "zod";

const router = Router();

const CONTACT_EMAIL = "ajay@dkube.io";

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  company: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.post("/", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Invalid input",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, email, company, message } = parsed.data;

  // Log submission to console for now (Resend integration coming later)
  console.log(`[contact] ─── New Demo Request ───`);
  console.log(`[contact] To: ${CONTACT_EMAIL}`);
  console.log(`[contact] Name: ${escapeHtml(name)}`);
  console.log(`[contact] Email: ${escapeHtml(email)}`);
  if (company) console.log(`[contact] Company: ${escapeHtml(company)}`);
  console.log(`[contact] Message: ${escapeHtml(message)}`);
  console.log(`[contact] ────────────────────────`);

  res.json({ data: { success: true } });
});

export { router as contactRouter };
