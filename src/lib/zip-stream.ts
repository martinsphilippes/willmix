import "server-only";

import { crc32 } from "node:zlib";

/*
 * Zip em fluxo, sem compressão ("store"): cada arquivo é lido em fluxo e
 * escrito direto na resposta, com o CRC e os tamanhos num "data descriptor"
 * depois dos dados (bit 3). Assim "baixar todas as artes" não carrega tudo na
 * memória. Artes (PDF, PSD, AI, PNG, JPG) já vêm comprimidas; comprimir de
 * novo gastaria CPU para quase nada. Sem ZIP64: até 4 GB e 65 mil arquivos.
 */

export interface ZipEntry {
  name: string;
  open: () => Promise<ReadableStream<Uint8Array> | null>;
}

const enc = new TextEncoder();

function dosDateTime(d: Date) {
  const time =
    (d.getHours() << 11) |
    (d.getMinutes() << 5) |
    Math.floor(d.getSeconds() / 2);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** Nome seguro dentro do zip: sem pastas, sem "..", único. */
export function safeZipNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const base =
      raw
        .replace(/[\\/]+/g, "_")
        .replace(/\.\.+/g, ".")
        .replace(/[\u0000-\u001f]/g, "")
        .trim()
        .slice(0, 180) || "arquivo";
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) {
      const dot = base.lastIndexOf(".");
      name =
        dot > 0
          ? `${base.slice(0, dot)} (${i})${base.slice(dot)}`
          : `${base} (${i})`;
      i++;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const { time, date } = dosDateTime(new Date());
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const push = (chunk: Uint8Array) => {
        controller.enqueue(chunk);
        offset += chunk.length;
      };
      if (index >= entries.length) {
        // Diretório central e fim.
        const cdStart = offset;
        for (const c of central) push(c);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, count, true);
        end.setUint16(10, count, true);
        end.setUint32(12, offset - cdStart, true);
        end.setUint32(16, cdStart, true);
        push(new Uint8Array(end.buffer));
        controller.close();
        return;
      }
      const entry = entries[index++];
      const body = await entry.open();
      if (!body) return; // arquivo sumiu do armazenamento: pula
      const name = enc.encode(entry.name);
      const headerOffset = offset;
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0808, true); // descriptor + nomes UTF-8
      local.setUint16(8, 0, true); // store
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint16(26, name.length, true);
      push(new Uint8Array(local.buffer));
      push(name);
      let crc = 0;
      let size = 0;
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        crc = crc32(value, crc);
        size += value.length;
        push(value);
      }
      const desc = new DataView(new ArrayBuffer(16));
      desc.setUint32(0, 0x08074b50, true);
      desc.setUint32(4, crc >>> 0, true);
      desc.setUint32(8, size, true);
      desc.setUint32(12, size, true);
      push(new Uint8Array(desc.buffer));
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0808, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc >>> 0, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, headerOffset, true);
      const row = new Uint8Array(46 + name.length);
      row.set(new Uint8Array(cd.buffer), 0);
      row.set(name, 46);
      central.push(row);
      count++;
    },
  });
}
