// Upload de arquivos (foto de perfil, documentos) pro MinIO compartilhado
// (s3.wxdigitalbussines.com, projeto impulso no EasyPanel), bucket próprio
// "plataforma-impulso" com policy public-read — mesmo padrão do GuiaBusca.
// Ver D:\AUTOMAÇÕES\.credentials\minio-plataforma-impulso.txt.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const ENDPOINT = process.env.S3_ENDPOINT ?? "";
const BUCKET   = process.env.S3_BUCKET ?? "";

const client = new S3Client({
  endpoint: ENDPOINT,
  region: "us-east-1", // MinIO ignora, mas o SDK exige um valor
  forcePathStyle: true, // obrigatório pra MinIO (vs. virtual-hosted style da AWS)
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

/** Sobe um arquivo e retorna a URL pública direta (bucket é public-read). */
export async function uploadArquivo(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: path,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${ENDPOINT}/${BUCKET}/${path}`;
}

export async function deletarArquivo(path: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: path }));
}

/** Extrai o path (Key) a partir de uma URL pública gerada por uploadArquivo. */
export function pathFromUrl(url: string): string | null {
  const prefixo = `${ENDPOINT}/${BUCKET}/`;
  return url.startsWith(prefixo) ? url.slice(prefixo.length) : null;
}
