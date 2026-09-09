import Link from "next/link";
import { redirect } from "next/navigation";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  const { status, data } = await callNestApi("/projects", { token });
  const projects = status === 200 ? (data as Project[]) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Twoje projekty</h1>
        <Link href="/dashboard/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Nowy projekt
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-600">
          Nie masz jeszcze żadnego projektu. Załóż pierwszy, żeby zacząć śledzić budżet budowy.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/${project.id}`}
                className="block rounded border border-gray-200 px-4 py-3 hover:border-gray-400"
              >
                <p className="font-medium">{project.name}</p>
                {project.address && <p className="text-sm text-gray-500">{project.address}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
