import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const storage = new ObjectStorageService();

const TEXT_MODEL = "gpt-5.4";

export type StoryPlanCharacter = {
  name: string;
  faceDescription: string;
  clothing: string;
  voiceStyle: string;
  basePrompt: string;
};

export type StoryPlanScene = {
  sequence: number;
  title: string;
  environment: string;
  action: string;
  cameraAngle: string;
  mood: string;
  prompt: string;
  previousSummary: string;
  characterNames: string[];
  durationSeconds: number;
};

export type StoryPlan = {
  title: string;
  logline: string;
  styleName: string;
  stylePrompt: string;
  colorGrading: string;
  characters: StoryPlanCharacter[];
  scenes: StoryPlanScene[];
};

const PLAN_SYSTEM_PROMPT = `You are the lead director of a boutique film studio that produces cinematic short-form videos. You break a creator's prompt into a tight production plan.

Hard constraints, in order of priority:
1. Visual continuity. The same characters appear across scenes with the same face, hair, body, clothing, and palette. Lock these in the character sheet.
2. World continuity. The environment, lighting, lens, and color grading stay consistent across scenes unless the story explicitly changes location.
3. Narrative momentum. Every scene advances the story. No filler.
4. Each scene's prompt must include a "previousSummary" describing what just happened, so the next scene can pick up where the last one left off.

Return strict JSON matching the provided schema. 4-6 scenes total. Each scene 4-8 seconds. Use vivid, specific, image-model-friendly language in prompts (camera, subject, environment, lighting, color, action).`;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "styleName", "stylePrompt", "colorGrading", "characters", "scenes"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    styleName: { type: "string" },
    stylePrompt: { type: "string" },
    colorGrading: { type: "string" },
    characters: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "faceDescription", "clothing", "voiceStyle", "basePrompt"],
        properties: {
          name: { type: "string" },
          faceDescription: { type: "string" },
          clothing: { type: "string" },
          voiceStyle: { type: "string" },
          basePrompt: { type: "string" },
        },
      },
    },
    scenes: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sequence",
          "title",
          "environment",
          "action",
          "cameraAngle",
          "mood",
          "prompt",
          "previousSummary",
          "characterNames",
          "durationSeconds",
        ],
        properties: {
          sequence: { type: "integer" },
          title: { type: "string" },
          environment: { type: "string" },
          action: { type: "string" },
          cameraAngle: { type: "string" },
          mood: { type: "string" },
          prompt: { type: "string" },
          previousSummary: { type: "string" },
          characterNames: { type: "array", items: { type: "string" } },
          durationSeconds: { type: "integer", minimum: 3, maximum: 10 },
        },
      },
    },
  },
} as const;

export async function generateStoryPlan(input: {
  prompt: string;
  styleHint?: string | null;
  fallbackTitle?: string | null;
}): Promise<StoryPlan> {
  const userPrompt = [
    `Creator prompt: ${input.prompt}`,
    input.styleHint ? `Preferred visual style: ${input.styleHint}` : null,
    input.fallbackTitle ? `Working title (you may improve it): ${input.fallbackTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: PLAN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "story_plan",
        strict: true,
        schema: PLAN_SCHEMA,
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Story plan generation returned no content");
  }
  const parsed = JSON.parse(raw) as StoryPlan;
  parsed.scenes = parsed.scenes
    .sort((a, b) => a.sequence - b.sequence)
    .map((s, i) => ({ ...s, sequence: i + 1 }));
  return parsed;
}

export async function generateCharacterReferenceImage(input: {
  character: { name: string; faceDescription: string; clothing: string; basePrompt: string };
  stylePrompt: string;
  colorGrading: string | null;
  seed: number;
}): Promise<string> {
  const prompt = [
    `Character reference sheet for "${input.character.name}".`,
    `Full body, neutral A-pose, plain studio background, even lighting, sharp focus.`,
    `Face: ${input.character.faceDescription}.`,
    `Clothing: ${input.character.clothing}.`,
    `Identity: ${input.character.basePrompt}.`,
    `Visual style: ${input.stylePrompt}.`,
    input.colorGrading ? `Color grading: ${input.colorGrading}.` : "",
    `This is a locked reference. Every future scene with this character must match this face and outfit exactly. Seed ${input.seed}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const buffer = await generateImageBuffer(prompt, "1024x1024");
  return await storage.uploadBuffer(buffer, "image/png", ".png");
}

export async function generateScenePreviewImage(input: {
  scene: { title: string; environment: string; action: string; cameraAngle: string; mood: string; prompt: string };
  stylePrompt: string;
  colorGrading: string | null;
  seed: number;
  characters: Array<{ name: string; faceDescription: string; clothing: string }>;
  previousSummary: string | null;
}): Promise<string> {
  const cast = input.characters
    .map(
      (c) =>
        `${c.name} (face: ${c.faceDescription}; outfit: ${c.clothing}) — must match the locked character reference exactly`,
    )
    .join("; ");

  const prompt = [
    `Cinematic storyboard frame, 16:9.`,
    `Scene "${input.scene.title}".`,
    `Environment: ${input.scene.environment}.`,
    `Action: ${input.scene.action}.`,
    `Camera: ${input.scene.cameraAngle}.`,
    `Mood: ${input.scene.mood}.`,
    cast ? `Characters in frame: ${cast}.` : "",
    input.previousSummary ? `Continues from previous scene: ${input.previousSummary}.` : "",
    `Visual style (do not deviate): ${input.stylePrompt}.`,
    input.colorGrading ? `Color grading: ${input.colorGrading}.` : "",
    `Scene direction: ${input.scene.prompt}.`,
    `Use seed ${input.seed} for continuity.`,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const buffer = await generateImageBuffer(prompt, "1024x1024");
    return await storage.uploadBuffer(buffer, "image/png", ".png");
  } catch (err) {
    logger.error({ err }, "Scene preview generation failed");
    throw err;
  }
}
