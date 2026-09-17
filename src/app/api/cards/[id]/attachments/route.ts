import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { canManageKanban } from "@/lib/access";
import { addAttachment } from "@/lib/cards";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para anexar arquivos." }, { status: 403 });
  }
  const { id } = await ctx.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 20 MB." }, { status: 400 });
  }

  try {
    const blob = await put(`kanban/${id}/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    const attachment = await addAttachment({
      cardId: id,
      userId: session.user.id,
      fileName: file.name,
      fileUrl: blob.url,
      contentType: file.type || null,
      sizeBytes: file.size,
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (err) {
    // Cenário mais comum: BLOB_READ_WRITE_TOKEN não configurado no ambiente
    // (necessário criar um Blob Store no projeto da Vercel e linkar a env var).
    const message =
      err instanceof Error && /token/i.test(err.message)
        ? "Upload de anexos não configurado: falta BLOB_READ_WRITE_TOKEN nas variáveis de ambiente (Vercel > Storage > Blob)."
        : "Falha ao enviar o arquivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
