import type { Project, Character, Scene, Schedule } from "@workspace/db";

export const serializeProject = (p: Project) => ({
  id: p.id,
  title: p.title,
  prompt: p.prompt,
  logline: p.logline,
  styleName: p.styleName,
  stylePrompt: p.stylePrompt,
  colorGrading: p.colorGrading,
  seed: p.seed,
  status: p.status,
  coverImageUrl: p.coverImageUrl,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export const serializeCharacter = (c: Character) => ({
  id: c.id,
  projectId: c.projectId,
  name: c.name,
  faceDescription: c.faceDescription,
  clothing: c.clothing,
  voiceStyle: c.voiceStyle,
  basePrompt: c.basePrompt,
  referenceImageUrl: c.referenceImageUrl,
  createdAt: c.createdAt.toISOString(),
});

export const serializeScene = (s: Scene) => ({
  id: s.id,
  projectId: s.projectId,
  sequence: s.sequence,
  title: s.title,
  environment: s.environment,
  action: s.action,
  cameraAngle: s.cameraAngle,
  mood: s.mood,
  prompt: s.prompt,
  previousSummary: s.previousSummary,
  characterIds: s.characterIds ?? [],
  durationSeconds: s.durationSeconds,
  status: s.status,
  previewImageUrl: s.previewImageUrl,
  videoUrl: s.videoUrl,
  createdAt: s.createdAt.toISOString(),
});

export const serializeSchedule = (s: Schedule) => ({
  id: s.id,
  projectId: s.projectId,
  platform: s.platform,
  scheduledAt: s.scheduledAt.toISOString(),
  status: s.status,
  caption: s.caption,
  hashtags: s.hashtags,
  externalUrl: s.externalUrl,
  createdAt: s.createdAt.toISOString(),
});
