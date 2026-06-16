export async function uploadDataUrl({
  name,
  type,
  size,
  data,
  boardId,
}: {
  name: string;
  type: string;
  size?: number;
  data: string;
  boardId?: string;
}) {
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, type, size, data, boardId }),
  });
  if (!response.ok) throw new Error("Upload failed");
  return (await response.json()) as { url: string; id: string };
}

export async function dataUrlFromBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
