import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }
  const t = await getTranslations("dashboard");

  const { status, data } = await callNestApi("/projects", { token });
  const projects = status === 200 ? (data as Project[]) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        <Link
          href="/dashboard/new"
          className="rounded-lg bg-accent-fill px-4 py-2 text-base text-on-accent transition-colors hover:bg-accent"
        >
          {t("newProject")}
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/${project.id}`}
                className="block rounded-lg border border-line px-4 py-3 transition-colors hover:border-accent"
              >
                <p className="font-medium">{project.name}</p>
                {project.address && <p className="text-base text-muted">{project.address}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
