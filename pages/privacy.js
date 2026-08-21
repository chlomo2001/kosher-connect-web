import { COMPANY, companyNumberLine } from '../lib/company.mjs'
import Head from 'next/head'
import { LEGAL_CSS, LegalShell } from '../components/LegalShell'

// Public privacy policy — reachable without signing in (Google's review and
// customers must be able to open it). Plain, honest description of what the
// shop actually collects and does. Owner should review wording; edits to the
// text here never affect Google sign-in (only the URL must stay the same).

export default function Privacy() {
  return (
    <>
      <Head><title>Privacy Policy · Kosher Connect</title>
        <meta name="robots" content="index" /></Head>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />
      <LegalShell title="Privacy Policy" updated="28 July 2026">
        <p>This policy explains what personal information Kosher Connect collects, why, and your rights over it.
          Kosher Connect is a trading name of <strong>{COMPANY.legalName}</strong> ({companyNumberLine()}) (“we”, “us”), 421 Bury New Road,
          Salford M7 4ED, United Kingdom.</p>

        <h2>1. Information we collect</h2>
        <ul>
          <li><strong>Contact details</strong> — your name, phone number, email and address.</li>
          <li><strong>Service details</strong> — your SIM and phone-plan information, virtual numbers, rentals, repairs and Kol Torah orders.</li>
          <li><strong>Travel-booking details</strong> — where you book flights through us: passenger names, dates of birth, and passport number, expiry, issuing country and nationality. These are needed to make the airline booking and, where you ask, to check entry requirements.</li>
          <li><strong>Payment records</strong> — what you’ve paid and what you owe (your wallet ledger). Card payments are handled by our payment processor; we do not store full card numbers.</li>
          <li><strong>Documents you send us</strong> — anything you upload through your account or hand in at the counter.</li>
          <li><strong>Carrier account credentials</strong> — where we manage a network account on your behalf, any password is stored encrypted with a key only we hold.</li>
          <li><strong>Sign-in information</strong> — if you sign in with Google, we receive your name and email address from Google to identify your account. We do not receive your Google password.</li>
        </ul>

        <h2>2. How we use it</h2>
        <p>To provide and manage the services you ask for — SIMs and numbers, rentals, repairs, travel bookings and audio — to take payment and keep your account, to remind you about things due (a balance, a flight, a document), and to answer your questions. We do not use your information for advertising and we never sell it.</p>

        <h2>3. Our legal basis</h2>
        <p>We process your information to perform our contract with you, for our legitimate interests in running the shop, and — where relevant, such as Google sign-in — with your consent, which you can withdraw at any time.</p>

        <h2>4. Google sign-in</h2>
        <p>Signing in with Google is optional. If you use it, Kosher Connect’s use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google API Services User Data Policy</a>, including its Limited Use requirements. We only use your Google name and email to identify your account — nothing else.</p>

        <h2>5. How we store and protect it</h2>
        <p>Your information is encrypted in transit (HTTPS) and at rest by our hosting providers. Access is limited to authorised staff. Carrier account passwords are additionally encrypted with a key we control. We keep information only as long as you are a customer and as long as the law requires afterwards (for example, financial records for accounting purposes).</p>

        <h2>6. Who we share it with</h2>
        <p>Only as needed to provide your service: airlines and travel providers to make a booking, telecom carriers to set up a SIM or number, and our payment processor to take a card payment. We may also share information where the law requires it. That’s all — no advertisers, no data brokers.</p>

        <h2>7. Your rights</h2>
        <p>Under UK data-protection law you can ask us to give you a copy of your information, correct it, delete it, or restrict how we use it, and you can object to certain uses. Contact us using the details below. You also have the right to complain to the Information Commissioner’s Office (ico.org.uk).</p>

        <h2>8. Cookies</h2>
        <p>We use only the essential cookies needed to keep you signed in and the site working. We do not use advertising or tracking cookies.</p>

        <h2>9. Changes</h2>
        <p>If we change this policy we’ll update the date above. Please check back from time to time.</p>

        <h2>10. Contact us</h2>
        <p>Kosher Connect (Hatsluche Ltd)<br />
          421 Bury New Road, Salford M7 4ED<br />
          Phone: <a href="tel:+441615311386">0161 531 1386</a><br />
          Email: <a href="mailto:support@kosher-connect.com">support@kosher-connect.com</a></p>
      </LegalShell>
    </>
  )
}
