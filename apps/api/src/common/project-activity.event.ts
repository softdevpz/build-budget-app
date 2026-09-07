export const PROJECT_ACTIVITY_EVENT = 'project.activity';

export type ProjectActivityEvent = {
  projectId: string;
  type: string; // e.g. "stage.created", "expense.updated", "expense.deleted"
  payload: unknown;
};
