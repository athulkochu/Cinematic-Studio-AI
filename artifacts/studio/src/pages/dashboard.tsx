import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import { Plus, Clapperboard, Calendar, Activity, Loader2, ArrowRight } from "lucide-react";
import { useGetDashboardSummary, useGetRecentActivity, useListProjects, useGetUpcomingSchedules } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: projects, isLoading: isLoadingProjects } = useListProjects();
  const { data: schedules, isLoading: isLoadingSchedules } = useGetUpcomingSchedules();

  const isLoading = isLoadingSummary || isLoadingActivity || isLoadingProjects || isLoadingSchedules;

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
              <h1 className="text-3xl font-bold tracking-tight">Studio Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of your cinematic productions.</p>
            </div>
            <Button onClick={() => setLocation("/projects/new")} className="gap-2">
              <Plus size={16} />
              New Project
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                <Clapperboard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalProjects || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Scenes Generated</CardTitle>
                <FilmStripIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalScenes || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.scheduledCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.publishedCount || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Projects</h2>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    View all <ArrowRight size={14} />
                  </Button>
                </div>
                
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

              <div>
                <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                <Card>
                  <CardContent className="p-0">
                    {activity?.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        No recent activity.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {activity?.slice(0, 5).map(item => (
                          <div key={item.id} className="p-4 flex gap-3">
                            <div className="mt-0.5">
                              {item.kind === 'project_created' && <Plus className="h-4 w-4 text-primary" />}
                              {item.kind === 'scene_rendered' && <Clapperboard className="h-4 w-4 text-emerald-500" />}
                              {item.kind === 'schedule_created' && <Calendar className="h-4 w-4 text-blue-500" />}
                              {item.kind === 'schedule_published' && <Activity className="h-4 w-4 text-indigo-500" />}
                              {item.kind === 'character_updated' && <FilmStripIcon className="h-4 w-4 text-amber-500" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(item.createdAt), "MMM d, h:mm a")}</p>
                            </div>
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

function FilmStripIcon(props: any) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h4" />
      <path d="M3 16.5h4" />
      <path d="M17 7.5h4" />
      <path d="M17 12h4" />
      <path d="M17 16.5h4" />
    </svg>
  );
}
