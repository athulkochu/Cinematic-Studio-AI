import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const scenesTable = pgTable("scenes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  title: text("title").notNull(),
  environment: text("environment").notNull(),
  action: text("action").notNull(),
  cameraAngle: text("camera_angle").notNull(),
  mood: text("mood").notNull(),
  prompt: text("prompt").notNull(),
  previousSummary: text("previous_summary"),
  characterIds: jsonb("character_ids").$type<number[]>().notNull().default([]),
  durationSeconds: integer("duration_seconds").notNull().default(6),
  status: text("status").notNull().default("draft"),
  previewImageUrl: text("preview_image_url"),
  videoUrl: text("video_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Scene = typeof scenesTable.$inferSelect;
export type InsertScene = typeof scenesTable.$inferInsert;
