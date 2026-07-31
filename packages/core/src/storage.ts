import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/* Здесь НЕТ `import "server-only"`, и это осознанно.

   Пакет `server-only` бросает при импорте вне react-server — то есть из
   обычного Node-скрипта тоже. А этот модуль нужен и серверному экшену админки,
   и `scripts/mirror-media.ts`; с прежним импортом скрипт падал бы на загрузке.

   Защита от утечки в браузер никуда не делась: модуль тянет `node:fs/promises`
   и читает `SUPABASE_SERVICE_ROLE_KEY` из окружения — Next оборвёт сборку,
   если такой импорт окажется в клиентском компоненте. */

/* Object storage for product photos.

   Two backends behind one interface:

     local     — writes into public/uploads. Zero setup, works offline. The
                 filesystem on Vercel is read-only, so this is dev only.
     supabase  — Supabase Storage over its REST API, via fetch. No SDK needed.

   Chosen by STORAGE_DRIVER; defaults to `local` so `pnpm dev` works with no
   cloud account at all. */

export interface StoredObject {
  path: string;
  url: string;
}

export interface Storage {
  put(path: string, body: Buffer, contentType: string): Promise<StoredObject>;
  remove(path: string): Promise<void>;
}

const localStorage: Storage = {
  async put(path, body) {
    const abs = join(process.cwd(), "public", "uploads", path);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, body);
    return { path, url: `/uploads/${path}` };
  },
  async remove(path) {
    try {
      await unlink(join(process.cwd(), "public", "uploads", path));
    } catch {
      // already gone
    }
  },
};

function supabaseStorage(): Storage {
  const url = required("SUPABASE_URL").replace(/\/$/, "");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.SUPABASE_BUCKET ?? "product-media";
  const base = `${url}/storage/v1/object`;

  return {
    async put(path, body, contentType) {
      const res = await fetch(`${base}/${bucket}/${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(body),
      });
      if (!res.ok) {
        throw new Error(`storage upload failed (${res.status}): ${await res.text()}`);
      }
      return { path, url: `${url}/storage/v1/object/public/${bucket}/${path}` };
    },

    async remove(path) {
      await fetch(`${base}/${bucket}/${path}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${key}` },
      }).catch(() => {
        // deletion is best-effort; an orphaned object is not worth failing on
      });
    },
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (required by STORAGE_DRIVER=supabase)`);
  return v;
}

export function storage(): Storage {
  return process.env.STORAGE_DRIVER === "supabase" ? supabaseStorage() : localStorage;
}
