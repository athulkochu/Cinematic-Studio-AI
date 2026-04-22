import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Clapperboard, Settings2, Users, Image as ImageIcon, Send, Calendar as CalendarIcon, RefreshCw, Trash2, ArrowLeft, MoreVertical, PlayCircle, Eye, Film, Layers } from "lucide-react";
import { 
  useGetProject, getGetProjectQueryKey,
  useUpdateProject, 
  useDeleteProject,
  useRenderProject,
  useUpdateCharacter,
  useRegenerateCharacterReference,
  useUpdateScene,
  useRegenerateScene,
  useCreateSchedule
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Workspace() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: project, isLoading, error } = useGetProject(projectId, {
    query: {
      refetchInterval: (query) => {
        const data: any = query.state.data;
        if (!data) return false;
        const stillWorking = data.status === "rendering" ||
          data.scenes?.some((s: any) => s.status === "rendering") ||
          data.characters?.some((c: any) => !c.referenceImageUrl);
        return stillWorking ? 3000 : false;
      },
    },
  });
  const deleteProject = useDeleteProject();
  const renderProject = useRenderProject();

  const [activeTab, setActiveTab] = useState("scenes");

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !project) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Project not found or error loading.</p>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
      deleteProject.mutate({ id: projectId }, {
        onSuccess: () => {
          toast.success("Project deleted");
          setLocation("/");
        },
        onError: (err) => {
          toast.error("Failed to delete project: " + (err as any).message);
        }
      });
    }
  };

  const handleRender = () => {
    renderProject.mutate({ id: projectId }, {
      onSuccess: () => {
        toast.success("Generating storyboard frames…");
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      },
      onError: (err) => {
        toast.error("Failed to start: " + (err as any).message);
      }
    });
  };

  const isRendering = project.status === 'rendering';
  const isPublished = project.status === 'published';

  return (
    <Layout>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Workspace Header */}
        <header className="flex-shrink-0 border-b border-border bg-card/30 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 relative">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight leading-none">{project.title}</h1>
                <Badge variant={
                  project.status === 'ready' ? 'secondary' : 
                  project.status === 'rendering' ? 'default' : 
                  project.status === 'published' ? 'outline' : 'outline'
                } className="capitalize text-[10px] tracking-wider py-0.5">
                  {project.status === 'rendering' ? (
                    <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Rendering</span>
                  ) : project.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl">{project.logline}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ScheduleDialog projectId={project.id} disabled={project.status !== 'rendered' && project.status !== 'published'} />
            
            <Button 
              onClick={handleRender} 
              disabled={isRendering || project.scenes.length === 0} 
              className={cn("gap-2 shadow-lg shadow-primary/20", isRendering ? "animate-pulse" : "")}
            >
              {isRendering ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              {isRendering ? "Generating…" : "Generate Storyboard Frames"}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={handleDelete}>
                  <Trash2 size={14} className="mr-2" /> Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-card/50 border border-border/50">
                  <TabsTrigger value="scenes" className="gap-2"><Clapperboard size={14} /> Storyboard ({project.scenes.length})</TabsTrigger>
                  <TabsTrigger value="characters" className="gap-2"><Users size={14} /> Cast ({project.characters.length})</TabsTrigger>
                </TabsList>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                This studio generates a story plan, character sheets, and one still frame per scene — not a finished video file. Connect a video model (Runway, Pika, etc.) to extend frames into motion.
              </p>

              <TabsContent value="scenes" className="flex-1 m-0 focus-visible:outline-none">
                {/* Horizontal Scene Strip */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Film size={14} /> Timeline Strip
                  </h3>
                  <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
                    {project.scenes.sort((a, b) => a.sequence - b.sequence).map((scene, idx) => (
                      <div key={scene.id} className="snap-start flex-shrink-0 w-64 bg-card rounded-lg border border-border overflow-hidden group">
                        <div className="aspect-video bg-muted relative">
                          {scene.previewImageUrl ? (
                            <img src={scene.previewImageUrl} alt={scene.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 bg-secondary/50">
                              <ImageIcon size={24} />
                            </div>
                          )}
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-white">
                            SC {scene.sequence}
                          </div>
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-white">
                            {scene.durationSeconds}s
                          </div>
                          {scene.status === 'rendering' && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                              <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-semibold text-sm truncate">{scene.title}</h4>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{scene.environment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vertical Scene List */}
                <div className="space-y-6 max-w-4xl">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} /> Detailed Breakdown
                  </h3>
                  {project.scenes.sort((a, b) => a.sequence - b.sequence).map(scene => (
                    <SceneEditor key={scene.id} scene={scene} characters={project.characters} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="characters" className="m-0 focus-visible:outline-none">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {project.characters.map(character => (
                    <CharacterCard key={character.id} character={character} />
                  ))}
                  {project.characters.length === 0 && (
                    <div className="col-span-full p-12 text-center text-muted-foreground bg-card/30 rounded-lg border border-dashed">
                      No characters found in this story.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar - Style & Continuity */}
          <aside className="w-full md:w-80 border-l border-border bg-card/20 flex-shrink-0 flex flex-col hidden md:flex">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings2 size={16} className="text-primary" /> Continuity Engine
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Global variables enforced across all scene prompts.</p>
            </div>
            
            <div className="p-5 space-y-6 overflow-y-auto">
              <ProjectSettingsEditor project={project} />
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

// --- Subcomponents ---

function ProjectSettingsEditor({ project }: { project: any }) {
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  
  const [styleName, setStyleName] = useState(project.styleName);
  const [stylePrompt, setStylePrompt] = useState(project.stylePrompt);
  const [colorGrading, setColorGrading] = useState(project.colorGrading || "");
  const [seed, setSeed] = useState(project.seed.toString());
  
  // Auto-save logic
  const lastSaved = useRef({ styleName, stylePrompt, colorGrading, seed });
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = { styleName, stylePrompt, colorGrading, seed };
      if (JSON.stringify(current) !== JSON.stringify(lastSaved.current)) {
        updateProject.mutate({
          id: project.id,
          data: { 
            styleName, 
            stylePrompt, 
            colorGrading, 
            seed: parseInt(seed, 10) || project.seed 
          }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
            lastSaved.current = current;
          }
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [styleName, stylePrompt, colorGrading, seed, project.id, updateProject, queryClient]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Aesthetic Core</Label>
        <Input 
          value={styleName} 
          onChange={(e) => setStyleName(e.target.value)} 
          className="font-medium bg-background"
        />
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Global Style Prompt</Label>
        <Textarea 
          value={stylePrompt} 
          onChange={(e) => setStylePrompt(e.target.value)} 
          className="text-xs font-mono bg-background min-h-[120px] resize-y"
        />
        <p className="text-[10px] text-muted-foreground">Appended to every scene.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Color Grading</Label>
        <Input 
          value={colorGrading} 
          onChange={(e) => setColorGrading(e.target.value)} 
          placeholder="e.g. Teal and orange, high contrast"
          className="bg-background text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Continuity Seed</Label>
        <Input 
          type="number"
          value={seed} 
          onChange={(e) => setSeed(e.target.value)} 
          className="bg-background font-mono text-sm"
        />
        <p className="text-[10px] text-muted-foreground">Locks latent space generation.</p>
      </div>
    </div>
  );
}

function CharacterCard({ character }: { character: any }) {
  const updateCharacter = useUpdateCharacter();
  const regenerateRef = useRegenerateCharacterReference();
  const queryClient = useQueryClient();
  
  const [face, setFace] = useState(character.faceDescription);
  const [clothing, setClothing] = useState(character.clothing);
  const lastSaved = useRef({ face, clothing });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (face !== lastSaved.current.face || clothing !== lastSaved.current.clothing) {
        updateCharacter.mutate({
          id: character.id,
          data: { faceDescription: face, clothing }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(character.projectId) });
            lastSaved.current = { face, clothing };
          }
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [face, clothing, character.id, character.projectId, updateCharacter, queryClient]);

  const handleRegenerate = () => {
    regenerateRef.mutate({ id: character.id }, {
      onSuccess: () => {
        toast.success(`Regenerating reference for ${character.name}`);
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(character.projectId) });
      }
    });
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full border-border/50 bg-card/30">
      <div className="aspect-square bg-muted relative group">
        {character.referenceImageUrl ? (
          <img src={character.referenceImageUrl} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 bg-secondary/30">
            <UserPlaceholder size={48} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
          <Button variant="secondary" size="sm" onClick={handleRegenerate} disabled={regenerateRef.isPending} className="gap-2">
            <RefreshCw size={14} className={regenerateRef.isPending ? "animate-spin" : ""} />
            Regen Reference
          </Button>
        </div>
      </div>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg">{character.name}</CardTitle>
        <CardDescription className="text-xs font-mono">{character.voiceStyle} Voice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground">Face & Build</Label>
          <Textarea 
            value={face} 
            onChange={(e) => setFace(e.target.value)} 
            className="text-xs min-h-[60px] resize-none bg-background/50 border-none focus-visible:ring-1 p-2"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground">Attire</Label>
          <Textarea 
            value={clothing} 
            onChange={(e) => setClothing(e.target.value)} 
            className="text-xs min-h-[60px] resize-none bg-background/50 border-none focus-visible:ring-1 p-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SceneEditor({ scene, characters }: { scene: any, characters: any[] }) {
  const updateScene = useUpdateScene();
  const regenScene = useRegenerateScene();
  const queryClient = useQueryClient();
  
  const [prompt, setPrompt] = useState(scene.prompt);
  const [action, setAction] = useState(scene.action);
  const lastSaved = useRef({ prompt, action });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (prompt !== lastSaved.current.prompt || action !== lastSaved.current.action) {
        updateScene.mutate({
          id: scene.id,
          data: { prompt, action }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(scene.projectId) });
            lastSaved.current = { prompt, action };
          }
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [prompt, action, scene.id, scene.projectId, updateScene, queryClient]);

  const handleRegen = () => {
    regenScene.mutate({ id: scene.id }, {
      onSuccess: () => {
        toast.success(`Regenerating Scene ${scene.sequence}`);
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(scene.projectId) });
      }
    });
  };

  const sceneCharacters = characters.filter(c => scene.characterIds?.includes(c.id));

  return (
    <Card className="border-border/60 bg-card shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Visual / Status side */}
      <div className="w-full md:w-64 bg-muted/30 flex-shrink-0 flex flex-col relative border-r border-border/50">
        <div className="aspect-video relative bg-black">
          {scene.previewImageUrl ? (
            <img src={scene.previewImageUrl} alt={`Scene ${scene.sequence}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <ImageIcon size={32} />
            </div>
          )}
          {scene.status === 'rendering' && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
               <Loader2 className="animate-spin text-primary mb-2" size={24} />
               <span className="text-[10px] text-white font-medium uppercase tracking-widest">Rendering</span>
             </div>
          )}
        </div>
        
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="font-mono text-[10px]">SCENE {scene.sequence}</Badge>
            <span className="text-xs font-mono text-muted-foreground">{scene.durationSeconds}s</span>
          </div>
          
          <div className="space-y-3 flex-1">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Environment</span>
              <span className="text-xs font-medium">{scene.environment}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block mb-1">Camera</span>
              <span className="text-xs">{scene.cameraAngle}</span>
            </div>
            {sceneCharacters.length > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">Cast</span>
                <div className="flex flex-wrap gap-1">
                  {sceneCharacters.map(c => (
                    <Badge key={c.id} variant="secondary" className="text-[9px] py-0">{c.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-4 text-xs gap-2" 
            onClick={handleRegen}
            disabled={regenScene.isPending || scene.status === 'rendering'}
          >
            <RefreshCw size={12} className={regenScene.isPending ? "animate-spin" : ""} />
            {scene.previewImageUrl ? "Regen Frame" : "Generate Frame"}
          </Button>
        </div>
      </div>

      {/* Editor side */}
      <div className="flex-1 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg">{scene.title}</h4>
          <Badge variant="secondary" className="bg-secondary/50 text-[10px] font-normal">{scene.mood}</Badge>
        </div>

        {scene.previousSummary && (
          <div className="mb-4 p-3 bg-secondary/20 rounded border border-border/50 text-xs text-muted-foreground italic border-l-2 border-l-primary/50">
            <span className="font-semibold block mb-1 not-italic text-[10px] uppercase text-primary">Context from previous:</span>
            {scene.previousSummary}
          </div>
        )}

        <div className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Action Description</Label>
            <Textarea 
              value={action}
              onChange={e => setAction(e.target.value)}
              className="resize-none min-h-[60px] text-sm bg-background border-border/60"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Direct Generation Prompt</Label>
            <Textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="resize-none min-h-[100px] text-xs font-mono bg-secondary/10 border-border/60 text-muted-foreground focus:text-foreground"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- Schedule Dialog ---

const scheduleSchema = z.object({
  platform: z.enum(['youtube', 'instagram']),
  date: z.date({
    required_error: "A date is required.",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be HH:MM format"),
  caption: z.string().min(1).max(500),
  hashtags: z.string().optional(),
});

function ScheduleDialog({ projectId, disabled }: { projectId: number, disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const createSchedule = useCreateSchedule();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      platform: 'youtube',
      caption: '',
      hashtags: '',
      time: '12:00',
    },
  });

  const onSubmit = (data: z.infer<typeof scheduleSchema>) => {
    // Combine date and time
    const [hours, minutes] = data.time.split(':').map(Number);
    const scheduledAt = new Date(data.date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    createSchedule.mutate({
      data: {
        projectId,
        platform: data.platform,
        scheduledAt: scheduledAt.toISOString(),
        caption: data.caption,
        hashtags: data.hashtags,
      }
    }, {
      onSuccess: () => {
        toast.success("Project scheduled for publishing!");
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      },
      onError: (err) => {
        toast.error("Failed to schedule: " + (err as any).message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={disabled}>
          <Send size={16} /> Schedule Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Publication</DialogTitle>
          <DialogDescription>
            Auto-publish the rendered video to your social channels.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube Shorts</SelectItem>
                      <SelectItem value="instagram">Instagram Reels</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time (24h)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caption</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Write an engaging caption..." className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hashtags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hashtags (Space separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="#cinematic #aivideo #shortfilm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full" disabled={createSchedule.isPending}>
                {createSchedule.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Queue for Publishing
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UserPlaceholder(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
