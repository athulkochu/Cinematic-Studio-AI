import { Router, type IRouter } from "express";
import { desc, eq, gte, asc } from "drizzle-orm";
import { db, schedulesTable, projectsTable } from "@workspace/db";
import { CreateScheduleBody } from "@workspace/api-zod";
import { serializeSchedule } from "../lib/serializers";

const router: IRouter = Router();

async function listJoined(opts?: { upcomingOnly?: boolean }) {
  const base = db
    .select({
      schedule: schedulesTable,
      projectTitle: projectsTable.title,
      coverImageUrl: projectsTable.coverImageUrl,
    })
    .from(schedulesTable)
    .leftJoin(projectsTable, eq(schedulesTable.projectId, projectsTable.id));

  const rows = opts?.upcomingOnly
    ? await base
        .where(gte(schedulesTable.scheduledAt, new Date()))
        .orderBy(asc(schedulesTable.scheduledAt))
        .limit(10)
    : await base.orderBy(desc(schedulesTable.scheduledAt));

  return rows.map((r) => ({
    ...serializeSchedule(r.schedule),
    projectTitle: r.projectTitle ?? "Untitled",
    coverImageUrl: r.coverImageUrl ?? null,
  }));
}

router.get("/schedules", async (_req, res) => {
  res.json(await listJoined());
});

router.get("/schedules/upcoming", async (_req, res) => {
  res.json(await listJoined({ upcomingOnly: true }));
});

router.post("/schedules", async (req, res) => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(schedulesTable)
    .values({
      projectId: parsed.data.projectId,
      platform: parsed.data.platform,
      scheduledAt: parsed.data.scheduledAt,
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags ?? null,
    })
    .returning();
  res.status(201).json(serializeSchedule(row));
});

router.delete("/schedules/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).send();
});

export default router;
