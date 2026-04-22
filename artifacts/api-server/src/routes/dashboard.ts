import { Router, type IRouter } from "express";
import { sql, desc } from "drizzle-orm";
import { db, projectsTable, charactersTable, scenesTable, schedulesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const [projectsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectsTable);
  const [scenesCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scenesTable);
  const [charactersCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(charactersTable);

  const byStatus = await db
    .select({
      status: projectsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(projectsTable)
    .groupBy(projectsTable.status);

  const byPlatform = await db
    .select({
      platform: schedulesTable.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(schedulesTable)
    .groupBy(schedulesTable.platform);

  const [scheduledCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schedulesTable)
    .where(sql`${schedulesTable.status} in ('queued','publishing')`);
  const [publishedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schedulesTable)
    .where(sql`${schedulesTable.status} = 'published'`);
  const [renderingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(sql`${projectsTable.status} = 'rendering'`);

  res.json({
    totalProjects: projectsCount.count,
    totalScenes: scenesCount.count,
    totalCharacters: charactersCount.count,
    scheduledCount: scheduledCount.count,
    publishedCount: publishedCount.count,
    renderingCount: renderingCount.count,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r.count })),
    byPlatform: byPlatform.map((r) => ({ platform: r.platform, count: r.count })),
  });
});

router.get("/dashboard/recent-activity", async (_req, res) => {
  const recentProjects = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt))
    .limit(8);
  const recentSchedules = await db
    .select()
    .from(schedulesTable)
    .orderBy(desc(schedulesTable.createdAt))
    .limit(8);

  const items = [
    ...recentProjects.map((p) => ({
      id: `project_${p.id}`,
      kind: "project_created" as const,
      title: p.title,
      subtitle: p.logline ?? p.styleName,
      projectId: p.id,
      createdAt: p.createdAt.toISOString(),
    })),
    ...recentSchedules.map((s) => ({
      id: `schedule_${s.id}`,
      kind: s.status === "published" ? ("schedule_published" as const) : ("schedule_created" as const),
      title: `Scheduled to ${s.platform}`,
      subtitle: s.caption.slice(0, 80),
      projectId: s.projectId,
      createdAt: s.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 12);

  res.json(items);
});

export default router;
