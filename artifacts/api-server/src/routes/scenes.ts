import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, scenesTable, projectsTable, charactersTable } from "@workspace/db";
import { UpdateSceneBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { serializeScene } from "../lib/serializers";
import { generateScenePreviewImage } from "../lib/continuity-engine";

const router: IRouter = Router();

router.patch("/scenes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSceneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [updated] = await db
    .update(scenesTable)
    .set(parsed.data)
    .where(eq(scenesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }
  res.json(serializeScene(updated));
});

router.post("/scenes/:id/regenerate", async (req, res) => {
  const id = Number(req.params.id);
  const scene = await db.query.scenesTable.findFirst({
    where: eq(scenesTable.id, id),
  });
  if (!scene) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, scene.projectId),
  });
  if (!project) {
    res.status(404).json({ error: "Parent project not found" });
    return;
  }
  const ids = scene.characterIds ?? [];
  const characters = ids.length
    ? await db.select().from(charactersTable).where(inArray(charactersTable.id, ids))
    : [];

  try {
    const url = await generateScenePreviewImage({
      scene,
      stylePrompt: project.stylePrompt,
      colorGrading: project.colorGrading,
      seed: project.seed,
      characters,
      previousSummary: scene.previousSummary,
    });
    const [updated] = await db
      .update(scenesTable)
      .set({ previewImageUrl: url, status: "rendered" })
      .where(eq(scenesTable.id, id))
      .returning();
    res.json(serializeScene(updated));
  } catch (err) {
    logger.error({ err }, "Regenerate scene failed");
    res.status(500).json({ error: "Failed to regenerate scene preview" });
  }
});

export default router;
