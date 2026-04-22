import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Calendar, Trash2, Youtube, Instagram, AlertCircle } from "lucide-react";
import { useListSchedules, useDeleteSchedule, getListSchedulesQueryKey, useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { data: schedules, isLoading } = useListSchedules();
  const deleteSchedule = useDeleteSchedule();

  const handleDelete = (id: number) => {
    deleteSchedule.mutate({ id }, {
      onSuccess: () => {
        toast.success("Schedule removed");
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to remove schedule: " + (err as any).message);
      }
    });
  };

  const upcoming = schedules?.filter(s => s.status === 'queued' || s.status === 'publishing') || [];
  const past = schedules?.filter(s => s.status === 'published' || s.status === 'failed' || s.status === 'canceled') || [];

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Publish Queue</h1>
            <p className="text-muted-foreground mt-1">Manage your automated content distribution.</p>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold border-b border-border pb-2">Upcoming</h2>
            
            {isLoading ? (
              <div className="h-32 flex items-center justify-center">
                <span className="text-muted-foreground animate-pulse">Loading queue...</span>
              </div>
            ) : upcoming.length === 0 ? (
              <Card className="border-dashed bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">No upcoming scheduled posts.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcoming.map(schedule => (
                  <ScheduleCard key={schedule.id} schedule={schedule} onDelete={() => handleDelete(schedule.id)} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 pt-8">
            <h2 className="text-xl font-semibold border-b border-border pb-2">History</h2>
            
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No publishing history.</p>
            ) : (
              <div className="grid gap-4 opacity-75">
                {past.map(schedule => (
                  <ScheduleCard key={schedule.id} schedule={schedule} onDelete={() => handleDelete(schedule.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ScheduleCard({ schedule, onDelete }: { schedule: any, onDelete: () => void }) {
  const isYoutube = schedule.platform === 'youtube';
  const Icon = isYoutube ? Youtube : Instagram;
  
  return (
    <Card>
      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-secondary flex-shrink-0">
          <Icon className={isYoutube ? "text-red-500" : "text-pink-500"} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{schedule.projectTitle}</h3>
            <Badge variant="outline" className="capitalize text-[10px] py-0">{schedule.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{schedule.caption}</p>
          {schedule.hashtags && (
            <p className="text-xs text-primary mt-1">{schedule.hashtags}</p>
          )}
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="text-right flex-1 md:flex-none">
            <p className="text-sm font-medium">{format(new Date(schedule.scheduledAt), "MMM d, yyyy")}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(schedule.scheduledAt), "h:mm a")}</p>
          </div>

          {(schedule.status === 'queued' || schedule.status === 'failed') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 size={16} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel scheduled post?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the post from the queue. You can schedule it again later from the project workspace.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Cancel Post
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
