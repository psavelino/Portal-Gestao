import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteComment, getCommentAuthor } from "@/lib/cards";

// Só o autor do comentário ou um admin pode apagá-lo.
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { commentId } = await ctx.params;

  const authorId = await getCommentAuthor(commentId);
  if (authorId === null) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }
  if (session.user.role !== "admin" && authorId !== session.user.id) {
    return NextResponse.json({ error: "Você só pode apagar seus próprios comentários." }, { status: 403 });
  }

  const ok = await deleteComment(commentId);
  if (!ok) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
