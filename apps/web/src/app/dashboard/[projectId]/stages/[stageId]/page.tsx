import { notFound, redirect } from "next/navigation";
import { arrayOrEmpty, callNestApi, summaryOrDefault } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { DiaryEntry, Expense, Project, ProjectDocument, Stage, Task } from "@/lib/types";
import { StageWorkspace } from "./stage-workspace";

type PageParams = { params: Promise<{ projectId: string; stageId: string }> };

export default async function StagePage({ params }: PageParams) {
  const { projectId, stageId } = await params;
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  const [projectRes, stageRes, summaryRes, stagesRes, expensesRes, documentsRes, diaryRes, tasksRes] =
    await Promise.all([
      callNestApi(`/projects/${projectId}`, { token }),
      callNestApi(`/projects/${projectId}/stages/${stageId}`, { token }),
      callNestApi(`/projects/${projectId}/summary`, { token }),
      callNestApi(`/projects/${projectId}/stages`, { token }),
      callNestApi(`/projects/${projectId}/expenses`, { token }),
      callNestApi(`/projects/${projectId}/documents`, { token }),
      callNestApi(`/projects/${projectId}/diary`, { token }),
      callNestApi(`/projects/${projectId}/tasks`, { token }),
    ]);

  if (projectRes.status === 404 || stageRes.status === 404) {
    notFound();
  }
  if (projectRes.status !== 200 || stageRes.status !== 200) {
    redirect(`/dashboard/${projectId}`);
  }

  return (
    <StageWorkspace
      projectId={projectId}
      project={projectRes.data as Project}
      initialStage={stageRes.data as Stage}
      summary={summaryOrDefault(summaryRes)}
      stages={arrayOrEmpty<Stage>(stagesRes)}
      initialExpenses={arrayOrEmpty<Expense>(expensesRes)}
      initialDocuments={arrayOrEmpty<ProjectDocument>(documentsRes)}
      initialDiaryEntries={arrayOrEmpty<DiaryEntry>(diaryRes)}
      initialTasks={arrayOrEmpty<Task>(tasksRes)}
    />
  );
}
