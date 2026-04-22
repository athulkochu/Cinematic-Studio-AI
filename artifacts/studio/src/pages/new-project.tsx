import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { useCreateProject } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  prompt: z.string().min(10, "Describe your story in more detail").max(2000),
  styleHint: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof createSchema>;

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const createProject = useCreateProject();

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: "",
      prompt: "",
      styleHint: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    setIsGenerating(true);
    
    createProject.mutate({ data }, {
      onSuccess: (project) => {
        toast.success("Project generated successfully");
        setLocation(`/projects/${project.id}`);
      },
      onError: (error) => {
        setIsGenerating(false);
        toast.error("Failed to generate project: " + (error as any).message);
      }
    });
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 pt-12">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-6 gap-2 text-muted-foreground">
            <ArrowLeft size={16} /> Back to Dashboard
          </Button>

          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-24 text-center space-y-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <Sparkles className="h-16 w-16 text-primary animate-pulse relative z-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Architecting your world...</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Our AI is breaking down your prompt into a full narrative sequence, designing characters, establishing visual continuity rules, and planning scenes. This usually takes 20-40 seconds.
                  </p>
                </div>
                <div className="w-64 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-1/3 animate-ping rounded-full" style={{ animationDuration: '2s' }} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold tracking-tight">New Cinematic Project</h1>
                  <p className="text-muted-foreground mt-1">Start a new story. The engine will handle casting, continuity, and scene breakdowns.</p>
                </div>

                <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Project Title</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Neon Shadows of Neo-Tokyo" className="bg-background" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="prompt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Story Prompt</FormLabel>
                              <FormDescription>Describe what happens in your video. Be as detailed as you like about characters, plot, and mood.</FormDescription>
                              <FormControl>
                                <Textarea 
                                  placeholder="A lone detective walks through the rain-slicked streets. They find a glowing artifact in an alleyway..." 
                                  className="min-h-[150px] bg-background resize-y" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="styleHint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Style Hint (Optional)</FormLabel>
                              <FormDescription>Guide the visual direction. Leave blank to let the AI decide based on your story.</FormDescription>
                              <FormControl>
                                <Input placeholder="e.g. 1970s anime style, Studio Ghibli, 35mm film, moody cyberpunk" className="bg-background" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="pt-4 flex justify-end">
                          <Button type="submit" size="lg" className="gap-2 px-8 font-semibold">
                            <Sparkles size={18} />
                            Generate Project Blueprint
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
