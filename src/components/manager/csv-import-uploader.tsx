'use client';

import { useState, useTransition } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import type { CsvRow, ParsedRow, ValidationReport } from '@/lib/csv-import/validate';
import { commitCsvImport, validateCsvServer } from '@/lib/actions/csv-import';

export function CsvImportUploader() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        start(async () => {
          const r = await validateCsvServer(results.data);
          setReport(r);
          setMsg(null);
        });
      },
    });
  }

  function onCommit() {
    if (!report) return;
    const validRows: ParsedRow[] = report.rows
      .filter((r) => r.error === null && r.parsed !== null)
      .map((r) => r.parsed!);
    start(async () => {
      const res = await commitCsvImport(validRows);
      setMsg(res.ok ? `Inserted ${res.inserted} vehicles.` : `Error: ${res.error}`);
      if (res.ok) setReport(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          disabled={pending}
        />
        <a
          href="/api/manager/vehicles/csv-template"
          className="text-sm text-primary underline"
          download
        >
          Download template
        </a>
      </div>

      {report && (
        <div className="space-y-3">
          <div className="rounded-md border bg-card p-4 text-sm">
            <div>Total rows: {report.totalRows}</div>
            <div>Errors: {report.errors}</div>
            <div>Valid: {report.totalRows - report.errors}</div>
          </div>

          <div className="rounded-md border bg-card">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Plate</th>
                  <th className="px-3 py-2">Make</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.index} className="border-b last:border-b-0">
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2 font-mono">{r.raw.plate}</td>
                    <td className="px-3 py-2">{r.raw.make}</td>
                    <td className="px-3 py-2">{r.raw.model}</td>
                    <td className="px-3 py-2">
                      {r.error ? (
                        <span className="text-destructive">{r.error}</span>
                      ) : (
                        <span className="text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={onCommit}
            disabled={pending || report.errors === report.totalRows}
          >
            {pending ? '…' : `Insert ${report.totalRows - report.errors} valid rows`}
          </Button>
        </div>
      )}

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
