import { notFound, redirect } from "next/navigation";
import { arrayOrEmpty, callNestApi, summaryOrDefault } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { DiaryEntry, Expense, Project, ProjectDocument, ProjectMember, Report, Stage } from "@/lib/types";
import { ProjectWorkspace } from "./project-workspace";

type PageParams = { params: Promise<{ projectId: string }> };

export default async function ProjectPage({ params }: PageParams) {
  const { projectId } = await params;
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  const [projectRes, summaryRes, stagesRes, expensesRes, documentsRes, reportsRes, diaryRes, membersRes] =
    await Promise.all([
      callNestApi(`/projects/${projectId}`, { token }),
      callNestApi(`/projects/${projectId}/summary`, { token }),
      callNestApi(`/projects/${projectId}/stages`, { token }),
      callNestApi(`/projects/${projectId}/expenses`, { token }),
      callNestApi(`/projects/${projectId}/documents`, { token }),
      callNestApi(`/projects/${projectId}/reports`, { token }),
      callNestApi(`/projects/${projectId}/diary`, { token }),
      callNestApi(`/projects/${projectId}/members`, { token }),
    ]);

  if (projectRes.status === 404) {
    notFound();
  }
  if (projectRes.status !== 200) {
    redirect("/dashboard");
  }

  return (
    <ProjectWorkspace
      projectId={projectId}
      initialProject={projectRes.data as Project}
      initialSummary={summaryOrDefault(summaryRes)}
      initialStages={arrayOrEmpty<Stage>(stagesRes)}
      initialExpenses={arrayOrEmpty<Expense>(expensesRes)}
      initialDocuments={arrayOrEmpty<ProjectDocument>(documentsRes)}
      initialReports={arrayOrEmpty<Report>(reportsRes)}
      initialDiaryEntries={arrayOrEmpty<DiaryEntry>(diaryRes)}
      initialMembers={arrayOrEmpty<ProjectMember>(membersRes)}
    />
  );
}
