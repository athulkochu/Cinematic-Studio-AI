import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  logline: text("logline"),
  styleName: text("style_name").notNull().default("Cinematic 3D Animation"),
  stylePrompt: text("style_prompt").notNull(),
  colorGrading: text("color_grading"),
  seed: integer("seed").notNull(),
  status: text("status").notNull().default("planning"),
  coverImageUrl: text("cover_image_url"),
  videoUrl: text("video_url"),
  exportStatus: text("export_status").notNull().default("idle"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
