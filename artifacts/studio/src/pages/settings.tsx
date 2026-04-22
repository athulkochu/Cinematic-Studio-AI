import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, User, RefreshCw, Layers } from "lucide-react";

export default function SettingsPage() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings & Engine Info</h1>
            <p className="text-muted-foreground mt-1">Understanding the Cinematic AI Studio continuity engine.</p>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  How Continuity Works
                </CardTitle>
                <CardDescription>The core philosophy behind maintaining visual consistency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Most AI video generators create beautiful but isolated clips. Cinematic AI Studio is built differently. It uses a cascading generation pipeline designed specifically to maintain visual continuity across multiple scenes.
                </p>
                <div className="grid md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><Film className="h-4 w-4"/> Global Style Locking</h3>
                    <p>When a project is created, the system generates a global style prompt and a fixed random seed. Every scene in the project automatically inherits this base style block and seed, ensuring the rendering model interprets the world the same way every time.</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><User className="h-4 w-4"/> Character Sheets</h3>
                    <p>Characters aren't just text descriptions. They are generated as reference sheets first. When a scene calls for a character, their fixed reference image and precise visual description are injected into the prompt, keeping faces and clothing consistent.</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4"/> Scene-to-Scene Context</h3>
                    <p>The story engine breaks your narrative into a logical sequence of shots. It generates a summary of the previous scene and uses it to inform the next scene's generation, ensuring lighting, mood, and spatial relationships make sense logically as time passes.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm font-medium">Video Rendering Engine</span>
                    <span className="text-sm text-emerald-500 font-medium">Online</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm font-medium">Story LLM Pipeline</span>
                    <span className="text-sm text-emerald-500 font-medium">Online</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm font-medium">Image Generation</span>
                    <span className="text-sm text-emerald-500 font-medium">Online</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium">Auto-Scheduling Agent</span>
                    <span className="text-sm text-emerald-500 font-medium">Online</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
