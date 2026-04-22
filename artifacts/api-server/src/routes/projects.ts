import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, projectsTable, charactersTable, scenesTable, schedulesTable } from "@workspace/db";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import {
  serializeProject,
  serializeCharacter,
  serializeScene,
  serializeSchedule,
} from "../lib/serializers";
import {
  generateStoryPlan,
  generateScenePreviewImage,
} from "../lib/continuity-engine";
import { inArray } from "drizzle-orm";

const router: IRouter = Router();

async function loadProjectWithPlan(id: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) return null;
  const [characters, scenes, schedules] = await Promise.all([
    db.select().from(charactersTable).where(eq(charactersTable.projectId, id)),
    db
      .select()
      .from(scenesTable)
      .where(eq(scenesTable.projectId, id))
      .orderBy(scenesTable.sequence),
    db.select().from(schedulesTable).where(eq(schedulesTable.projectId, id)),
  ]);
  return {
    ...serializeProject(project),
    characters: characters.map(serializeCharacter),
    scenes: scenes.map(serializeScene),
    schedules: schedules.map(serializeSchedule),
  };
}

router.get("/projects", async (_req, res) => {
  const rows = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt));
  res.json(rows.map(serializeProject));
});

router.post("/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { prompt, title, styleHint } = parsed.data;
  const seed = Math.floor(Math.random() * 1_000_000);

  let plan;
  try {
    plan = await generateStoryPlan({ prompt, styleHint, fallbackTitle: title });
  } catch (err) {
    logger.error({ err }, "Story plan generation failed");
    res.status(500).json({ error: "Failed to generate story plan" });
    return;
  }

  const [insertedProject] = await db
    .insert(projectsTable)
    .values({
      title: plan.title,
      prompt,
      logline: plan.logline,
      styleName: plan.styleName,
      stylePrompt: plan.stylePrompt,
      colorGrading: plan.colorGrading,
      seed,
      status: "ready",
    })
    .returning();

  // Insert characters without reference images (generated lazily on demand)
  const characterRows = await Promise.all(
    plan.characters.map(async (c) => {
      const [row] = await db
        .insert(charactersTable)
        .values({
          projectId: insertedProject.id,
          name: c.name,
          faceDescription: c.faceDescription,
          clothing: c.clothing,
          voiceStyle: c.voiceStyle,
          basePrompt: c.basePrompt,
          referenceImageUrl: null,
        })
        .returning();
      return row;
    }),
  );

  const nameToId = new Map(characterRows.map((c) => [c.name, c.id]));

  // Insert scenes with character ID mapping
  const sceneRows = await Promise.all(
    plan.scenes.map(async (s) => {
      const characterIds = s.characterNames
        .map((n) => nameToId.get(n))
        .filter((id): id is number => typeof id === "number");
      const [row] = await db
        .insert(scenesTable)
        .values({
          projectId: insertedProject.id,
          sequence: s.sequence,
          title: s.title,
          environment: s.environment,
          action: s.action,
          cameraAngle: s.cameraAngle,
          mood: s.mood,
          prompt: s.prompt,
          previousSummary: s.previousSummary || null,
          characterIds,
          durationSeconds: s.durationSeconds,
          status: "draft",
        })
        .returning();
      return row;
    }),
  );

  const full = await loadProjectWithPlan(insertedProject.id);
  res.status(201).json(full);
});

router.get("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const full = await loadProjectWithPlan(id);
  if (!full) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(full);
});

router.patch("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [updated] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(eq(projectsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(serializeProject(updated));
});

router.delete("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

async function renderProjectInBackground(id: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) return;

  const [scenes, allCharacters] = await Promise.all([
    db.select().from(scenesTable).where(eq(scenesTable.projectId, id)).orderBy(scenesTable.sequence),
    db.select().from(charactersTable).where(eq(charactersTable.projectId, id)),
  ]);
  const charById = new Map(allCharacters.map((c) => [c.id, c]));

  await Promise.all(
    scenes.map((s) =>
      db
        .update(scenesTable)
        .set({ status: "rendering" })
        .where(eq(scenesTable.id, s.id)),
    ),
  );

  let firstUrl: string | null = null;
  let succeeded = 0;

  await Promise.allSettled(
    scenes.map(async (scene) => {
      const ids = scene.characterIds ?? [];
      const chars = ids.map((cid) => charById.get(cid)).filter((c): c is NonNullable<typeof c> => !!c);
      try {
        const url = await generateScenePreviewImage({
          scene,
          stylePrompt: project.stylePrompt,
          colorGrading: project.colorGrading,
          seed: project.seed,
          characters: chars,
          previousSummary: scene.previousSummary,
        });
        await db
          .update(scenesTable)
          .set({ previewImageUrl: url, status: "rendered" })
          .where(eq(scenesTable.id, scene.id));
        succeeded++;
        if (scene.sequence === 1 || !firstUrl) firstUrl = url;
      } catch (err) {
        logger.warn({ err, sceneId: scene.id }, "Scene render failed");
        await db
          .update(scenesTable)
          .set({ status: "draft" })
          .where(eq(scenesTable.id, scene.id));
      }
    }),
  );

  await db
    .update(projectsTable)
    .set({
      status: succeeded === scenes.length ? "rendered" : "ready",
      ...(firstUrl ? { coverImageUrl: firstUrl } : {}),
    })
    .where(eq(projectsTable.id, id));
}

router.post("/projects/:id/render", async (req, res) => {
  const id = Number(req.params.id);
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ status: "rendering" })
    .where(eq(projectsTable.id, id));

  // Fire and forget — frontend polls for updates
  renderProjectInBackground(id).catch((err) =>
    logger.error({ err, projectId: id }, "Background render failed"),
  );

  const full = await loadProjectWithPlan(id);
  res.status(202).json(full);
});

export default router;
export { loadProjectWithPlan };
