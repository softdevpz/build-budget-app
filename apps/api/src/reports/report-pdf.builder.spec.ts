import { buildReportPdf } from './report-pdf.builder';

describe('buildReportPdf', () => {
  it('produces a real PDF buffer for a project with stages and expenses', async () => {
    const buffer = await buildReportPdf({
      project: {
        name: 'Dom testowy',
        address: 'ul. Testowa 1',
        startDate: new Date('2026-01-01'),
        status: 'in_progress',
        targetBudget: 500000 as any,
      } as any,
      stages: [{ id: 's1', name: 'Fundamenty', status: 'done', plannedBudget: 80000 as any } as any],
      expenses: [
        {
          id: 'e1',
          stageId: 's1',
          category: 'beton',
          amount: 25000 as any,
          currency: 'PLN',
          date: new Date('2026-02-01'),
          vendor: 'Betoniarnia',
        } as any,
      ],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    // "%PDF-" magic bytes: the same check `file(1)` uses to identify a PDF.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('does not throw when there are no stages or expenses yet', async () => {
    const buffer = await buildReportPdf({
      project: { name: 'Pusty projekt', status: 'in_progress' } as any,
      stages: [],
      expenses: [],
    });

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
