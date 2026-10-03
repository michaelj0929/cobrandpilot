import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LayoutGrid, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { SectionHead } from "@/components/app-shell";
import { BusyLine } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPTED_TYPES,
  BRAND_KIND_LABEL,
  MAX_FILES_PER_PASS,
  MAX_FILE_BYTES,
  createBrand,
  createSourceFromFile,
  getBrandFamilyOf,
  type Brand,
  type BrandKind,
} from "@/lib/cobrand-client";

/**
 * Sub-brands and product lines, shown on the master brand's Uploads page:
 * the existing ones, plus a form that creates one and uploads its documents
 * in a single step. Documents land as queued; the sub-brand's own Uploads
 * page then builds them.
 */
export function SubBrandsPanel({ master }: { master: Brand }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const family = useQuery({ queryKey: ["brand-family", "of", master.id], queryFn: () => getBrandFamilyOf(master.id) });
  const subBrands = family.data?.subBrands ?? [];

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BrandKind>("product_line");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const addFiles = (list: FileList) => {
    setFiles((current) => {
      const merged = [...current];
      for (const file of Array.from(list)) {
        if (!merged.some((f) => f.name === file.name && f.size === file.size)) merged.push(file);
      }
      return merged.slice(0, MAX_FILES_PER_PASS);
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
      if (tooBig) throw new Error(`${tooBig.name} is larger than 25 MB.`);
      setBusy(`Creating ${name.trim()}…`);
      const id = await createBrand({ name, description, parentBrandId: master.id, kind });
      for (const file of files) {
        setBusy(`Uploading ${file.name}…`);
        await createSourceFromFile(id, file);
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["brand-family"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      navigate({ to: "/brands/$brandId", params: { brandId: id } });
    },
    onSettled: () => setBusy(null),
  });

  return (
    <section id="sub-brands" className="scroll-mt-8">
      <SectionHead
        title="Sub-brands and product lines"
        description={`Guidelines that only apply to part of ${master.name}. They add to the master brand system, and you pick which ones apply when you check content.`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "New sub-brand or product line"}
          </Button>
        }
      />

      {open ? (
        <div className="reveal-enter surface mb-5 px-6 py-[22px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                placeholder="e.g. Air Max"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as BrandKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_line">Product line</SelectItem>
                  <SelectItem value="sub_brand">Sub-brand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="sub-description">What makes it different (optional)</Label>
              <Textarea
                id="sub-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Guideline documents</Label>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!!busy}
                onClick={() => fileInput.current?.click()}
                className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-brand-soft bg-card px-6 py-6 text-center transition-colors hover:bg-brand-tint/40 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <Upload aria-hidden className="size-5" strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold">Choose files</span>
                <span className="text-xs text-ink-muted">
                  PDF, PowerPoint, Word, images or SVG · up to {MAX_FILES_PER_PASS} files, 25 MB
                  each
                </span>
              </button>
              {files.length > 0 ? (
                <ul className="mt-1 flex flex-col">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-3 border-t border-line-soft py-2 text-sm first:border-t-0"
                    >
                      <FileText aria-hidden className="size-4 shrink-0 text-ink-muted" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        disabled={!!busy}
                        onClick={() => setFiles((fs) => fs.filter((f) => f !== file))}
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-page hover:text-ink"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">
                  You can also add documents later from its Uploads page.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button disabled={!name.trim() || !!busy} onClick={() => create.mutate()}>
              <Upload aria-hidden />
              {files.length > 0
                ? `Create and upload ${files.length} ${files.length === 1 ? "document" : "documents"}`
                : `Create ${kind === "product_line" ? "product line" : "sub-brand"}`}
            </Button>
            {busy ? <BusyLine text={busy} /> : null}
          </div>
          {create.isError ? (
            <p className="mt-4 text-sm text-destructive">{(create.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}

      {subBrands.length === 0 ? (
        !open ? (
          <div className="rounded-lg border-[1.5px] border-dashed border-line-mid bg-card px-6 py-8 text-center">
            <h2>No sub-brands yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Add a sub-brand or product line, then upload the guidelines that only apply to it.
            </p>
          </div>
        ) : null
      ) : (
        <ul className="surface px-6 py-2">
          {subBrands.map((sub) => (
            <li
              key={sub.id}
              className="flex flex-wrap items-center gap-3 border-t border-line-soft py-3.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{sub.name}</p>
                <p className="text-xs text-ink-muted">
                  {BRAND_KIND_LABEL[sub.kind]} · v{sub.current_version}
                </p>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link to="/brands/$brandId" params={{ brandId: sub.id }}>
                  <Upload aria-hidden />
                  Upload documents
                </Link>
              </Button>
              <Button asChild size="sm" variant="quiet">
                <Link to="/brands/$brandId/brain" params={{ brandId: sub.id }}>
                  <LayoutGrid aria-hidden />
                  Guidelines
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
