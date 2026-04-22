import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import { Plus, Clapperboard, Loader2 } from "lucide-react";
import { useGetDashboardSummary, useListProjects, useGetUpcomingSchedules } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: projects, isLoading: isLoadingProjects } = useListProjects();
  const { data: schedules, isLoading: isLoadingSchedules } = useGetUpcomingSchedules();

  const isLoading = isLoadingSummary || isLoadingProjects || isLoadingSchedules;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Your projects</h1>
              <p className="text-muted-foreground mt-1">{summary?.totalProjects || 0} project{summary?.totalProjects === 1 ? "" : "s"} · {summary?.totalScenes || 0} scenes · {summary?.scheduledCount || 0} scheduled</p>
            </div>
            <Button onClick={() => setLocation("/projects/new")} className="gap-2">
              <Plus size={16} />
              New project
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Recent</h2>
                
                {projects?.length === 0 ? (
                  <Card className="border-dashed border-2 bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Clapperboard className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-1">No projects yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Start your first cinematic production.</p>
                      <Button onClick={() => setLocation("/projects/new")} variant="outline">Create Project</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects?.slice(0, 4).map(project => (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group h-full flex flex-col">
                          <div className="aspect-video bg-muted relative">
                            {project.coverImageUrl ? (
                              <img src={project.coverImageUrl} alt={project.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                <Clapperboard size={32} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                              <span className="text-sm font-medium text-primary">Open Workspace</span>
                            </div>
                            <div className="absolute top-2 right-2">
                              <Badge variant={project.status === 'published' ? 'default' : 'secondary'} className="capitalize backdrop-blur-md bg-background/80">
                                {project.status}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4 flex-1">
                            <h3 className="font-semibold line-clamp-1 mb-1">{project.title}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2">{project.logline || project.prompt}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Upcoming Publishes</h2>
                <Card>
                  <CardContent className="p-0">
                    {schedules?.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        No upcoming publishes scheduled.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {schedules?.slice(0, 5).map(schedule => (
                          <div key={schedule.id} className="p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs capitalize">{schedule.platform}</Badge>
                              <span className="text-xs text-muted-foreground">{format(new Date(schedule.scheduledAt), "MMM d, h:mm a")}</span>
                            </div>
                            <p className="text-sm font-medium">{schedule.projectTitle}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
