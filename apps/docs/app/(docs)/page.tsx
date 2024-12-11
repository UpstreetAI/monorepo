import { DocsDescription, DocsTitle, DocsBody } from 'fumadocs-ui/page'
import Image from 'next/image'
import { Cards, Card } from 'fumadocs-ui/components/card'

import LargeCard from '../../components/card'
import Link from 'next/link'

export async function generateMetadata() {
  const title = `Upstreet Documentation`
  const description =
    'Get started on building AI Agents with the Upstreet Agents SDK.'

  return {
    title,
    description
  }
}

const DocsIndexPage = () => {
  return (
    <div className="w-full h-full pt-12 flex flex-col justify-center items-center min-w-0 max-w-[var(--fd-page-width)] md:transition-[max-width]">
      <DocsTitle className="mb-6">
        <span className="text-2xl md:text-4xl flex justify-center items-center gap-2 whitespace-nowrap">
          Build AI Agents with{' '}
          <pre className="font-mono px-1 bg-fd-primary-foreground rounded-md">
            {'<React />'}
          </pre>
          .
        </span>
      </DocsTitle>

      <DocsDescription className="max-w-2xl text-center">
        With Upstreet's Agents SDK, you can declaratively build and deploy AI
        Agents with a breeze, while leveraging millions of NPM packages.
      </DocsDescription>

      <div className="flex flex-col md:flex-row justify-center items-center gap-3 mb-6">
        <Link href={'/install'}>
          <LargeCard
            bottomGradientOverlay={true}
            backgroundOverlay={false}
            src={'/images/general/first-steps.webp'}
            title={'First steps'}
            description="Create your first AI Agent. Complete with its own backstory and motives."
          />
        </Link>
        <Link href={'/examples'}>
          <LargeCard
            bottomGradientOverlay={true}
            backgroundOverlay={false}
            src={'/images/general/examples.webp'}
            title={'Examples'}
            description="Learn from our examples. See real agents in action."
          />
        </Link>
        <Link href={'/concepts/what-are-agents'}>
          <LargeCard
            bottomGradientOverlay={true}
            backgroundOverlay={false}
            src={'/images/general/learn.webp'}
            title={'Learn'}
            description="What are agents? Learn from our research-backend knowledge base."
          />
        </Link>
      </div>

      <DocsBody className="items-center w-full max-w-xl">
        <div className="opacity-60 tracking-wide text-center mb-2">
          Coming from any of the following?
        </div>

        <Cards className="sm:grid-cols-3 w-full px-6">
          {/* Ask fumadocs to make title optional. */}
          <Card
            title={''}
            className="flex flex-col items-start gap-2"
            href="/migration-guides/langchain"
          >
            <Image
              alt="Upstreet Competitor 0"
              src="/images/upstreetai-competitors/langchain.png"
              width={100}
              height={30}
              className="h-8 mb-4 w-auto object-contain"
            />
            <span className="mt-2">LangChain</span>
          </Card>
          <Card
            title={''}
            className="flex flex-col items-start gap-2"
            href="/migration-guides/crew-ai"
          >
            <Image
              alt="Upstreet Competitor 1"
              src="/images/upstreetai-competitors/crew_ai.png"
              width={100}
              height={30}
              className="h-8 mb-4 w-auto object-contain"
            />
            <span className="mt-2">Crew.ai</span>
          </Card>
          <Card
            title={''}
            className="flex flex-col items-start gap-2"
            href="/migration-guides/fetch-ai"
          >
            <Image
              alt="Upstreet Competitor 2"
              src="/images/upstreetai-competitors/fetch_ai.png"
              width={100}
              height={30}
              className="h-8 mb-4 w-auto object-contain"
            />
            <span className="mt-2">Fetch.ai</span>
          </Card>
        </Cards>

        {/* <iframe className='my-8' width="560" height="315" src="https://www.youtube.com/embed/Fr78GhpaYB4?si=lD7x1HKFQevl0Pxe" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> */}
      </DocsBody>
    </div>
  )
}

export default DocsIndexPage
