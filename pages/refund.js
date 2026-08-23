import { COMPANY, companyNumberLine, registeredOfficeLine } from '../lib/company.mjs'
import Head from 'next/head'
import { LEGAL_CSS, LegalShell } from '../components/LegalShell'

// Public refund / cancellation policy — reachable without signing in. Required
// for card processing (Stripe) and good practice generally. Plain, honest terms
// aligned with UK consumer law. Owner should review the specifics (the 14-day
// window, deposit handling) and tell us of any change — editing the text never
// affects sign-in, only the URL must stay /refund.

export default function Refund() {
  return (
    <>
      <Head><title>Refunds &amp; Cancellations · Kosher Connect</title>
        <meta name="robots" content="index" />
        <link rel="canonical" href="https://www.kosher-connect.com/refund" /></Head>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />
      <LegalShell title="Refunds & Cancellations" updated="22 July 2026">
        <p>This policy explains when and how you can get a refund or cancel. Kosher Connect is a trading name of
          <strong> {COMPANY.legalName}</strong> ({companyNumberLine()}; {registeredOfficeLine()}), 421 Bury New Road, Salford M7 4ED. It sits alongside our{' '}
          <a href="/terms">Terms of Service</a> and does not affect your statutory rights under UK consumer law.</p>

        <h2>1. Phones &amp; accessories (physical goods)</h2>
        <p>If you change your mind about an unused item, you can return it within <strong>14 days</strong> of purchase,
          in its original condition and packaging, for a refund or exchange. Items that have been set up, activated or
          used may not be returnable unless they are faulty. Faulty goods are repaired, replaced or refunded in line
          with the Consumer Rights Act 2015.</p>

        <h2>2. SIMs, airtime, virtual numbers &amp; subscriptions</h2>
        <p>Once a SIM, top-up, bundle, international/virtual number or subscription has been <strong>activated or
          used</strong>, it cannot be refunded — the service has been provided. Where something has been paid for but
          not yet activated, contact us and we’ll help put it right. Recurring subscriptions can be cancelled for
          future periods; charges already taken for a period in progress are not refunded pro-rata unless we agree.</p>

        <h2>3. Repairs</h2>
        <p>Repairs are covered by a workmanship warranty for the same fault. A diagnostic or assessment fee, where one
          applies, is told to you before we start and is not refundable once the work of diagnosing is done. If we
          can’t fix a fault, you only pay any agreed diagnostic fee.</p>

        <h2>4. Phone rentals</h2>
        <p>Cancel a rental before you collect the phone for a full refund. Deposits are returned once the phone is
          brought back on time and checked. Late returns or damage may be charged in line with the rates shown when you
          collect — those charges reflect a cost incurred and are not a refundable purchase.</p>

        <h2>5. Travel bookings</h2>
        <p>Travel bookings follow the airline’s or provider’s own cancellation and refund rules, which we’ll tell you at
          the time. Any Kosher Connect booking or service fee is separate and is refundable only where we haven’t yet
          done the work.</p>

        <h2>6. How refunds are made</h2>
        <p>Approved refunds go back to your original payment method — a card refund returns to the same card, and a
          wallet or account credit is returned to your balance. Card refunds normally reach you within
          <strong> 5–10 business days</strong> once processed, depending on your bank.</p>

        <h2>7. How to ask for a refund or cancel</h2>
        <p>Just get in touch — call <a href="tel:+441615311386">0161&nbsp;531&nbsp;1386</a>, pop into the shop at
          421&nbsp;Bury&nbsp;New&nbsp;Road, Salford&nbsp;M7&nbsp;4ED, or message us through your account. Tell us what
          you bought and what’s wrong, and we’ll sort it out fairly and quickly.</p>
      </LegalShell>
    </>
  )
}
