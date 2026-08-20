import Head from 'next/head'
import { LEGAL_CSS, LegalShell } from '../../components/LegalShell'
import { SERVICE_GUIDES, guideById, guideIds } from '../../lib/serviceGuides.mjs'

// Public "how to use what you just took home" pages (#18). One per service,
// generated from lib/serviceGuides.mjs — never written here by hand, so the
// receipt link, the page and the tests all read the same source.
//
// PUBLIC ON PURPOSE. A customer in an airport is not going to sign in, and the
// content is instructions rather than anything of theirs. Listed in the PUBLIC
// set of test/robots.test.mjs, so it indexes rather than noindexing.
//
// Statically generated: nothing here depends on a request, and a page a
// customer opens on airport wifi should not wait for a server render.

export default function ServiceGuide({ guide }) {
  if (!guide) return null
  return (
    <>
      <Head>
        <title>{guide.title} · Kosher Connect</title>
        <meta name="robots" content="index" />
        <meta name="description" content={guide.intro} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />
      <LegalShell title={guide.title} updated={guide.updated}>
        <p>{guide.intro}</p>
        {guide.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
        ))}
        <h2>Still stuck?</h2>
        <p>
          Ring the shop on <a href="tel:+441615311386">0161 531 1386</a> — from abroad{' '}
          <a href="tel:+441615311386">+44 161 531 1386</a> — or come in: 421 Bury New Road,
          Salford M7 4ED, the door to the left of Toy Zone, first floor up.
        </p>
      </LegalShell>
    </>
  )
}

export async function getStaticPaths() {
  return { paths: guideIds().map((service) => ({ params: { service } })), fallback: false }
}

export async function getStaticProps({ params }) {
  const guide = guideById(params.service)
  if (!guide) return { notFound: true }
  return { props: { guide } }
}

// Exported for the test, so "every guide renders" is checked against the same
// list the router builds from rather than a second copy of it.
export const ALL_GUIDES = SERVICE_GUIDES
