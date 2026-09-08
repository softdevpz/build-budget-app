import { redirect } from "next/navigation";
import { callNestApi } from "@/lib/api-server";
import { getAccessToken } from "@/lib/cookies";

type Project = { id: string; name: string };

export default async function DashboardPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  // Called directly (not through /api/proxy) — Server Components render on
  // Vercel's server already, so there's no browser round-trip to save here.
  const { status, data } = await callNestApi("/projects", { token });
  const projects = status === 200 ? (data as Project[]) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-4 text-2xl font-semibold">Pulpit</h1>
      <p className="text-gray-600">
        Zalogowano poprawnie. Masz {projects.length} {projects.length === 1 ? "projekt" : "projektów"}.
      </p>
      {projects.length > 0 && (
        <ul className="mt-4 list-disc pl-5">
          {projects.map((project) => (
            <li key={project.id}>{project.name}</li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-gray-500">
        Prawdziwy interfejs do zarządzania projektami, etapami i wydatkami wchodzi w kolejnej fazie.
      </p>
    </main>
  );
}
