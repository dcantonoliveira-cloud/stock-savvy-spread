import type { BubbleListResponse, BubbleRecord } from "./types.js";

const BASE_URL = process.env.BUBBLE_BASE_URL!;
const TOKEN = process.env.BUBBLE_API_TOKEN!;
const PAGE_SIZE = 100;

async function fetchPage<T extends BubbleRecord>(
  dataType: string,
  cursor: number
): Promise<BubbleListResponse<T>> {
  const url = `${BASE_URL}/${dataType}?limit=${PAGE_SIZE}&cursor=${cursor}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(
      `Bubble API error [${dataType}] cursor=${cursor}: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<BubbleListResponse<T>>;
}

export async function fetchAll<T extends BubbleRecord>(
  dataType: string
): Promise<T[]> {
  const all: T[] = [];
  let cursor = 0;

  console.log(`  → Buscando "${dataType}" na Bubble API...`);

  while (true) {
    const data = await fetchPage<T>(dataType, cursor);
    const { results, remaining } = data.response;

    all.push(...results);
    console.log(
      `    [${dataType}] cursor=${cursor} — ${results.length} registros, ${remaining} restantes`
    );

    if (remaining === 0) break;
    cursor += PAGE_SIZE;
  }

  console.log(`  ✓ "${dataType}": ${all.length} registros no total\n`);
  return all;
}
