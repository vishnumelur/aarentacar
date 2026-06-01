'use client';

import { useTransition, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createType } from '@/lib/actions/categories';

export function TypeForm({ categoryId }: { categoryId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createType(fd);
      if (!res.ok) {
        setErr(res.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <Input
        name="slug"
        placeholder="slug-with-dashes"
        pattern="[a-z0-9-]+"
        required
        className="w-48"
      />
      <Input name="nameEn" placeholder="English name" required className="w-48" />
      <Input name="nameAr" placeholder="الاسم العربي" required className="w-48" />
      <Button type="submit" disabled={pending} size="sm">
        {pending ? 'Adding…' : 'Add type'}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
      {success && <span className="text-xs text-green-600">Added.</span>}
    </form>
  );
}
