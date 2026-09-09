import { notFound, redirect } from "next/navigation";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { Expense, Project, ProjectSummary, Stage } from "@/lib/types";
import { ProjectWorkspace } from "./project-workspace";

type PageParams = { params: Promise<{ projectId: string }> };

export default async function ProjectPage({ params }: PageParams) {
  const { projectId } = await params;
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  const [projectRes, summaryRes, stagesRes, expensesRes] = await Promise.all([
    callNestApi(`/projects/${projectId}`, { token }),
    callNestApi(`/projects/${projectId}/summary`, { token }),
    callNestApi(`/projects/${projectId}/stages`, { token }),
    callNestApi(`/projects/${projectId}/expenses`, { token }),
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
      initialSummary={summaryRes.data as ProjectSummary}
      initialStages={stagesRes.data as Stage[]}
      initialExpenses={expensesRes.data as Expense[]}
    />
  );
}
