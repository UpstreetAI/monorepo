import { type Metadata } from 'next';
import { makeAnonymousClient } from '@/utils/supabase/supabase-client';
import { env } from '@/lib/env';
import { Account } from '@/components/account';
import { AccountProfile } from '@/components/accounts/profile';

type Params = {
  params: {
    id: string;
  };
};

export async function generateMetadata({
  params
}: Params): Promise<Metadata> {

  const supabase = makeAnonymousClient(env);
  const agentId = decodeURIComponent(params.id)

  const { data: accountData } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', agentId)
    .single();

  const meta = {
    title: accountData?.name ?? 'Agent not found!',
    description: accountData?.description ?? '',
    cardImage: accountData?.preview_image ?? '',
    robots: 'follow, index',
    favicon: '/favicon.ico',
    url: `https://chat.upstreet.ai/`
  };

  return {
    title: meta.title,
    description: meta.description,
    referrer: 'origin-when-cross-origin',
    keywords: ['AI', 'SDK', 'Upstreet', 'Agents'],
    authors: [{ name: 'Upstreet', url: 'https://upstreet.ai/' }],
    creator: 'upstreetai',
    publisher: 'upstreetai',
    robots: meta.robots,
    icons: { icon: meta.favicon },
    metadataBase: new URL(meta.url),
    openGraph: {
      url: meta.url,
      title: meta.title,
      description: meta.description,
      images: [meta.cardImage],
      type: 'website',
      siteName: meta.title
    },
    twitter: {
      card: 'summary_large_image',
      site: '@upstreetai',
      creator: '@upstreetai',
      title: meta.title,
      description: meta.description,
      images: [meta.cardImage]
    }
  }
}

export default async function AccountProfilePage({ params }: Params) {
  const supabase = makeAnonymousClient(env);
  const accountId = decodeURIComponent(params.id);

  console.log('agentId', accountId);

  const { data: accountData } = await supabase
    .from('accounts')
    .select(`*, agents: assets ( * )`)
    .eq('id', accountId)
    .single();

  if (!accountData?.id) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 text-center">
        Account Not Found
      </div>
    );
  }
  return (<AccountProfile account={accountData} />);
}
