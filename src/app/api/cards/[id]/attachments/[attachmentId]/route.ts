import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { canManageKanban } from "@/lib/access";
import { deleteAttachment, getAttachment } from "@/lib/cards";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const canManage = await canManageKanban();
  if (!canManage) {
    return NextResponse.json({ error: "Sem permissão para excluir anexos." }, { status: 403 });
  }
  const { attachmentId } = await ctx.params;

  const attachment = await getAttachment(attachmentId);
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  await deleteAttachment(attachmentId);
  try {
    await del(attachment.fileUrl);
  } catch {
    // Se o blob já não existir (ou o token não estiver configurado), o
    // registro no banco já foi removido — não bloqueia o usuário por isso.
  }
  return NextResponse.json({ ok: true });
}
