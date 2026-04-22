import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export default function SettingsPage() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">About this studio</h1>
            <p className="text-muted-foreground mt-1">A short, honest summary of what's wired up.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What it does</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row ok>Breaks your prompt into a logline, characters, and ordered scenes</Row>
              <Row ok>Generates a reference image for each character</Row>
              <Row ok>Generates one still frame per scene with a locked style and seed</Row>
              <Row ok>Carries previous-scene context forward for visual continuity</Row>
              <Row ok>Lets you schedule placeholder publishes to YouTube and Instagram</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What it doesn't do (yet)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row>Render an actual MP4 video — connect a video model (Runway, Pika, Luma) to extend frames into motion</Row>
              <Row>Auto-publish to YouTube or Instagram — the schedule is local-only until those accounts are connected</Row>
              <Row>Generate audio, music, or voiceover</Row>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function Row({ children, ok = false }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={ok ? "text-emerald-500 mt-0.5" : "text-muted-foreground mt-0.5"}>
        {ok ? <Check size={16} /> : <X size={16} />}
      </div>
      <p className={ok ? "text-foreground" : "text-muted-foreground"}>{children}</p>
    </div>
  );
}
