import { CsvImportUploader } from '@/components/manager/csv-import-uploader';

export default function BulkUploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk import vehicles</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV matching the template. Dry-run validates each row before any data is
          written; only valid rows are inserted on commit.
        </p>
      </div>
      <CsvImportUploader />
    </div>
  );
}
