import {
  assetToBlob,
  buildAsset,
  coerceAssetFields,
  hashAssetBytes,
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
    ...coerceAssetFields(row),
  };
}

async function ensureContentHash(asset: Asset): Promise<Asset> {
  if (asset.contentHash) {
    return asset;
  }
  const contentHash = await hashAssetBytes(asset.bytes);
  const next = { ...asset, contentHash };
  await getDb().assets.put(next);
  return next;
}

export async function putAsset(input: CreateAssetInput): Promise<Asset> {
  const contentHash =
    input.contentHash && input.contentHash.length > 0
      ? input.contentHash
      : await hashAssetBytes(input.bytes);

  const existing = await getDb()
    .assets.where("contentHash")
    .equals(contentHash)
    .first();
  if (existing) {
    return coerceAsset(existing);
  }

  const asset = buildAsset({ ...input, contentHash });
  await getDb().assets.put(asset);
  return asset;
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const row = await getDb().assets.get(id);
  if (!row) {
    return undefined;
  }
  return ensureContentHash(coerceAsset(row));
}

export async function findAssetByContentHash(
  contentHash: string,
): Promise<Asset | undefined> {
  if (!contentHash) {
    return undefined;
  }
  const row = await getDb()
    .assets.where("contentHash")
    .equals(contentHash)
    .first();
  return row ? coerceAsset(row) : undefined;
}

export async function deleteAsset(id: string): Promise<void> {
  await getDb().assets.delete(id);
}

export async function listAssets(): Promise<Asset[]> {
  const rows = await getDb().assets.toArray();
  const coerced = rows.map(coerceAsset);
  return Promise.all(coerced.map((asset) => ensureContentHash(asset)));
}

export { assetToBlob, ensureContentHash };
