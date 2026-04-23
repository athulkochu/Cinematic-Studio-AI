import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  projectsTable,
  charactersTable,
  scenesTable,
  schedulesTable,
} from "@workspace/db";
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

import { ObjectStorageService } from "../lib/objectStorage";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import ffmpeg from "fluent-ffmpeg";

const requireFromHere = createRequire(import.meta.url);
function resolveFfmpegPath(): string {
  const platformPkg = `@ffmpeg-installer/${process.platform}-${process.arch}`;
  try {
    const pkgJsonPath = requireFromHere.resolve(`${platformPkg}/package.json`);
    const binName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    return path.join(path.dirname(pkgJsonPath), binName);
  } catch {
    // Fallback to the wrapper package (works in npm/yarn layouts).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return requireFromHere("@ffmpeg-installer/ffmpeg").path;
  }
}
ffmpeg.setFfmpegPath(resolveFfmpegPath());

const storage = new ObjectStorageService();

async function deleteAssetIfStored(url: string | null | undefined) {
  if (!url) return;
  if (url.startsWith("/api/storage/objects/")) {
    await storage.deleteByPublicPath(url);
  }
}

async function loadAssetBuffer(url: string): Promise<Buffer | null> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:[^;]+;base64,(.+)$/);
    return m ? Buffer.from(m[1], "base64") : null;
  }
  if (url.startsWith("/api/storage/objects/")) {
    return await storage.downloadToBuffer(url);
  }
  return null;
}

async function runExportJob(projectId: number) {
  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `export-${projectId}-`),
  );
  try {
    const scenes = await db
      .select()
      .from(scenesTable)
      .where(eq(scenesTable.projectId, projectId))
      .orderBy(scenesTable.sequence);

    const usable = scenes.filter((s) => s.previewImageUrl);
    if (usable.length === 0) {
      await db
        .update(projectsTable)
        .set({ exportStatus: "failed" })
        .where(eq(projectsTable.id, projectId));
      return;
    }

    const concatLines: string[] = [];
    for (let i = 0; i < usable.length; i++) {
      const s = usable[i];
      const buf = await loadAssetBuffer(s.previewImageUrl!);
      if (!buf) continue;
      const framePath = path.join(
        tmpDir,
        `frame_${String(i).padStart(4, "0")}.png`,
      );
      await fs.writeFile(framePath, buf);
      const duration = Math.max(1, s.durationSeconds || 4);
      concatLines.push(`file '${framePath.replace(/'/g, "'\\''")}'`);
      concatLines.push(`duration ${duration}`);
    }
    // ffmpeg concat demuxer requires the last file to be repeated without duration
    const lastFrame = path.join(
      tmpDir,
      `frame_${String(usable.length - 1).padStart(4, "0")}.png`,
    );
    concatLines.push(`file '${lastFrame.replace(/'/g, "'\\''")}'`);

    const listPath = path.join(tmpDir, "concat.txt");
    await fs.writeFile(listPath, concatLines.join("\n"));
    const outPath = path.join(tmpDir, `video_${randomUUID()}.mp4`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-vsync",
          "vfr",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-movflags",
          "+faststart",
        ])
        .save(outPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    const videoBuf = await fs.readFile(outPath);
    const videoUrl = await storage.uploadBuffer(videoBuf, "video/mp4", ".mp4");

    const existing = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (existing?.videoUrl) {
      await deleteAssetIfStored(existing.videoUrl).catch(() => {});
    }

    await db
      .update(projectsTable)
      .set({ videoUrl, exportStatus: "ready" })
      .where(eq(projectsTable.id, projectId));
    logger.info({ projectId, videoUrl }, "Video export complete");
  } catch (err) {
    logger.error({ err, projectId }, "Video export failed");
    await db
      .update(projectsTable)
      .set({ exportStatus: "failed" })
      .where(eq(projectsTable.id, projectId));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

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
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (project) {
    const characters = await db
      .select()
      .from(charactersTable)
      .where(eq(charactersTable.projectId, id));
    const scenes = await db
      .select()
      .from(scenesTable)
      .where(eq(scenesTable.projectId, id));
    const urls: (string | null)[] = [
      project.coverImageUrl,
      project.videoUrl,
      ...characters.map((c) => c.referenceImageUrl),
      ...scenes.map((s) => s.previewImageUrl),
    ];
    await Promise.allSettled(urls.map((u) => deleteAssetIfStored(u)));
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

router.post("/projects/:id/export", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const scenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.projectId, id));
  const renderable = scenes.filter((s) => s.previewImageUrl);
  if (renderable.length === 0) {
    res
      .status(400)
      .json({
        error:
          "No rendered scenes available. Generate storyboard frames first.",
      });
    return;
  }
  await db
    .update(projectsTable)
    .set({ exportStatus: "exporting" })
    .where(eq(projectsTable.id, id));
  // Kick off background job
  void runExportJob(id);
  const full = await loadProjectWithPlan(id);
  res.status(202).json(full);
});

async function renderProjectInBackground(id: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, id),
  });
  if (!project) return;

  const [scenes, allCharacters] = await Promise.all([
    db
      .select()
      .from(scenesTable)
      .where(eq(scenesTable.projectId, id))
      .orderBy(scenesTable.sequence),
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
      const chars = ids
        .map((cid) => charById.get(cid))
        .filter((c): c is NonNullable<typeof c> => !!c);
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
