import PDFDocument = require('pdfkit');
import { Expense, Project, Stage } from '@prisma/client';

export type ReportData = {
  project: Project;
  stages: Stage[];
  expenses: Expense[];
};

// pdfkit's built-in fonts (Helvetica, Times, …) are the 14 standard PDF
// fonts, which only cover WinAnsi/Latin-1 — Polish diacritics (ą ć ę ł ń ó
// ś ź ż) silently come out as other characters. DejaVu Sans is a free,
// embeddable TTF with full Latin Extended-A coverage, so it's registered
// as the document's font instead.
const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

const STATUS_LABELS: Record<string, string> = {
  pending: 'Zaplanowany',
  in_progress: 'W trakcie',
  done: 'Zakończony',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL');
}

export function buildReportPdf(data: ReportData): Promise<Buffer> {
  const { project, stages, expenses } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, font: FONT_REGULAR });
    doc.registerFont('body', FONT_REGULAR);
    doc.registerFont('bold', FONT_BOLD);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const targetBudget = project.targetBudget ? Number(project.targetBudget) : null;
    const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    doc.font('bold').fontSize(20).text('Raport budżetu budowy', { align: 'center' });
    doc.moveDown();

    doc.font('body').fontSize(12);
    doc.text(`Projekt: ${project.name}`);
    if (project.address) doc.text(`Adres: ${project.address}`);
    if (project.startDate) doc.text(`Data rozpoczęcia: ${formatDate(project.startDate)}`);
    doc.text(`Status: ${statusLabel(project.status)}`);
    doc.text(`Wygenerowano: ${formatDate(new Date())}`);
    doc.moveDown();

    doc.font('bold').fontSize(14).text('Podsumowanie budżetu');
    doc.font('body').fontSize(12);
    doc.text(`Budżet docelowy: ${targetBudget !== null ? formatCurrency(targetBudget, 'PLN') : 'nie ustawiono'}`);
    doc.text(`Wydano łącznie: ${formatCurrency(totalSpent, 'PLN')}`);
    if (targetBudget !== null) {
      doc.text(`Pozostało: ${formatCurrency(targetBudget - totalSpent, 'PLN')}`);
    }
    doc.moveDown();

    doc.font('bold').fontSize(14).text('Etapy');
    doc.font('body').fontSize(12);
    if (stages.length === 0) {
      doc.text('Brak etapów.');
    }
    for (const stage of stages) {
      const stageSpent = expenses
        .filter((expense) => expense.stageId === stage.id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0);
      const planned = stage.plannedBudget ? formatCurrency(Number(stage.plannedBudget), 'PLN') : 'nie ustawiono';
      doc.text(
        `- ${stage.name} (${statusLabel(stage.status)}) — planowane: ${planned}, wydano: ${formatCurrency(stageSpent, 'PLN')}`,
      );
    }
    doc.moveDown();

    doc.font('bold').fontSize(14).text('Wydatki');
    doc.font('body').fontSize(10);
    if (expenses.length === 0) {
      doc.text('Brak wydatków.');
    }
    for (const expense of expenses) {
      const vendor = expense.vendor ? ` — ${expense.vendor}` : '';
      doc.text(
        `${formatDate(expense.date)}  ${expense.category}${vendor}  ${formatCurrency(Number(expense.amount), expense.currency)}`,
      );
    }

    doc.end();
  });
}
