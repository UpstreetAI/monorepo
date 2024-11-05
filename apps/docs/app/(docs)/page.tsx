import {
    DocsDescription,
    DocsTitle,
    DocsBody,
  } from 'fumadocs-ui/page';
  import Image from 'next/image';
import { Cards, Card } from 'fumadocs-ui/components/card';

import LargeCard from '../../components/card';
import Link from 'next/link';

  const DocsIndexPage = () => {
    return (
        <div className='w-full h-full pt-12 flex flex-col justify-center items-center min-w-0 max-w-[var(--fd-page-width)] md:transition-[max-width]'>
            <DocsTitle className='mb-6'>
                <span className='flex justify-center items-center gap-2'>
                    Build AI Agents with <pre className="font-mono px-1 bg-fd-primary-foreground rounded-md">{"<React />"}</pre>.
                </span>
            </DocsTitle>

            <DocsDescription className='max-w-2xl text-center'>
                With Upstreet's Agents SDK, you can declaratively build and deploy AI Agents with a breeze, while leveraging millions of NPM packages.
            </DocsDescription>

            <div className='flex flex-col md:flex-row justify-center items-center gap-3 mb-6'>
                <Link href={'/install'}><LargeCard src={'/images/general/894c2410-6478-434e-b3a0-12cd3ecb4792.webp'} title={"Genesis"} description='Create your first AI Agent. Complete with its own backstory, and motives.'/></Link>
                <Link href={'/examples/hello-world'}><LargeCard src={'/images/general/eb708406-76c3-464c-93f3-eb87db218354.webp'} title={"Examples"} description='Learn from our examples. See real agents in action.'/></Link>
                <Link href={'/concepts/what-are-agents'}><LargeCard src={'/images/general/13fcd802-3d0c-4482-bb30-9708722c6f39.webp'} title={"Learn"} description='What are agents? Learn from our research-backend knowledge base.'/></Link>
            </div>

            <DocsBody className="items-center w-full max-w-xl">
                <div className="opacity-60 tracking-wide text-center mb-2">
                Coming from any of the following?
                </div>

                <Cards className="sm:grid-cols-3 w-full px-6">
                    {/* Ask fumadocs to make title optional. */}
                    <Card title={""} className="flex flex-col items-start gap-2" href="/migration-guides/langchain">
                        <Image alt="Upstreet Competitor 0" src="/images/upstreetai-competitors/langchain.png" width={100} height={30} className='h-8 mb-4 w-auto object-contain' />
                        <span className="mt-2">LangChain</span>
                    </Card>
                    <Card title={""} className="flex flex-col items-start gap-2" href="/migration-guides/crew-ai">
                        <Image alt="Upstreet Competitor 1" src="/images/upstreetai-competitors/crew_ai.png" width={100} height={30} className='h-8 mb-4 w-auto object-contain' />
                        <span className="mt-2">Crew.ai</span>
                    </Card>
                    <Card title={""} className="flex flex-col items-start gap-2" href="/migration-guides/fetch-ai">
                        <Image alt="Upstreet Competitor 2" src="/images/upstreetai-competitors/fetch_ai.png" width={100} height={30} className='h-8 mb-4 w-auto object-contain' />
                        <span className="mt-2">Fetch.ai</span>
                    </Card>
                </Cards>
            </DocsBody>
        </div>
    )
  }


  export default DocsIndexPage;