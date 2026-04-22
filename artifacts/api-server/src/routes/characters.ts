import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, charactersTable, projectsTable } from "@workspace/db";
import { UpdateCharacterBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { serializeCharacter } from "../lib/serializers";
import { generateCharacterReferenceImage } from "../lib/continuity-engine";

const router: IRouter = Router();

router.patch("/characters/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [updated] = await db
    .update(charactersTable)
    .set(parsed.data)
    .where(eq(charactersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(serializeCharacter(updated));
});

router.post("/characters/:id/regenerate-reference", async (req, res) => {
  const id = Number(req.params.id);
  const character = await db.query.charactersTable.findFirst({
    where: eq(charactersTable.id, id),
  });
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, character.projectId),
  });
  if (!project) {
    res.status(404).json({ error: "Parent project not found" });
    return;
  }
  try {
    const url = await generateCharacterReferenceImage({
      character,
      stylePrompt: project.stylePrompt,
      colorGrading: project.colorGrading,
      seed: project.seed,
    });
    const [updated] = await db
      .update(charactersTable)
      .set({ referenceImageUrl: url })
      .where(eq(charactersTable.id, id))
      .returning();
    res.json(serializeCharacter(updated));
  } catch (err) {
    logger.error({ err }, "Regenerate character reference failed");
    res.status(500).json({ error: "Failed to regenerate reference image" });
  }
});

export default router;
