import {
  assetToBlob,
  buildAsset,
  type Asset,
  type CreateAssetInput,
} from "@/domain/asset";
import { getDb } from "./db";

function coerceAsset(row: Asset): Asset {
  const raw = row.bytes;
  const bytes =
    raw instanceof Uint8Array
      ? raw
      : new Uint8Array(raw as ArrayBufferLike);

  return {
    ...row,
    bytes,
    byteLength: row.byteLength ?? bytes.byteLength,
  };
}

export async function putAsset(input: CreateAssetInput): Promise<Asset> {
  const asset = buildAsset(input);
  await getDb().assets.put(asset);
  return asset;
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const row = await getDb().assets.get(id);
  return row ? coerceAsset(row) : undefined;
}

export async function deleteAsset(id: string): Promise<void> {
  await getDb().assets.delete(id);
}

export async function listAssets(): Promise<Asset[]> {
  const rows = await getDb().assets.toArray();
  return rows.map(coerceAsset);
}

export { assetToBlob };
