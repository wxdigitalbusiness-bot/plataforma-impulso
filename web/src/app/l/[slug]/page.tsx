import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { LinkItem } from "@/app/(app)/qrcodes/_actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = await db.linkPage.findUnique({ where: { slug }, select: { titulo: true, nome: true } });
  return { title: page?.titulo ?? page?.nome ?? "Links" };
}

export default async function LinkPublicoPage({ params }: Props) {
  const { slug } = await params;

  const page = await db.linkPage.findUnique({
    where: { slug },
    include: { cliente: { select: { nome: true, fotoUrl: true, bio: true } } },
  });

  if (!page || !page.ativo) notFound();

  const titulo = page.titulo || page.cliente?.nome || page.nome;
  const bio = page.bio || page.cliente?.bio;
  const foto = page.fotoUrl || page.cliente?.fotoUrl;
  const links = ((page.links as unknown as LinkItem[]) ?? []).filter((l) => l.ativo);

  return (
    <div className="flex min-h-screen justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={titulo} className="mx-auto h-24 w-24 rounded-full border border-neutral-200 object-cover" />
        ) : (
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-neutral-200 bg-white text-2xl font-semibold text-neutral-400">
            {titulo.charAt(0).toUpperCase()}
          </div>
        )}

        <h1 className="mt-4 text-xl font-bold text-neutral-900">{titulo}</h1>
        {bio && <p className="mt-1 text-sm text-neutral-500">{bio}</p>}

        <div className="mt-8 space-y-3">
          {links.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum link disponível no momento.</p>
          ) : (
            links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-violet-300 hover:shadow"
              >
                {link.label}
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
