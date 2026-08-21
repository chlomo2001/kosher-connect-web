import { COMPANY, companyNumberLine, registeredOfficeLine } from '../lib/company.mjs'
import Head from 'next/head'
import { LEGAL_CSS, LegalShell } from '../components/LegalShell'

// Public terms of service — reachable without signing in. Plain, honest terms
// for the shop's services. Owner should review; editing the text never affects
// Google sign-in (only the URL must stay the same).

export default function Terms() {
  return (
    <>
      <Head><title>Terms of Service · Kosher Connect</title>
        <meta name="robots" content="index" /></Head>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />
      <LegalShell title="Terms of Service" updated="28 July 2026">
        <p>These terms cover your use of Kosher Connect’s services and website. Kosher Connect is a trading name of
          <strong> {COMPANY.legalName}</strong> ({companyNumberLine()}), 421 Bury New Road, Salford M7 4ED.
          By using our services you agree to them.</p>

        <h2>1. What we do</h2>
        <p>We provide kosher mobile SIMs and phone plans, international and virtual numbers, phone rentals, repairs, accessories, Kol Torah audio, and travel bookings — in the shop and, for account holders, online.</p>

        <h2>2. Your account</h2>
        <p>If you use the online portal, keep your sign-in link private — it’s personal to you. Please keep your contact details accurate so we can reach you about your services. Tell us straight away if you think someone else has access to your account.</p>

        <h2>3. Prices and payment</h2>
        <p>Prices are as quoted in the shop or on your account. Your balance is tracked in your account wallet; you can pay by cash, card or bank transfer (please quote the payment reference we give you so it reaches your account), or top up in advance. Rentals may require a deposit. Payments already made for a service are non-refundable except where the law requires or as we agree.</p>

        <h2>4. Rentals</h2>
        <p>Rented phones remain our property. Please look after the handset and return it on time and in good condition. Late returns and damage may be charged in line with the rates shown when you collect the phone. A deposit, where taken, is returned once the phone is back and checked.</p>

        <h2>5. Travel bookings and entry requirements</h2>
        <p>Where we book flights or provide travel guidance, <strong>you remain responsible for meeting the entry requirements of your destination</strong> — a valid passport, and any visa, ESTA, eTA or similar authorisation. Any guidance we give is for help only and is not a guarantee; always confirm the current requirements on the official government site before you travel.</p>

        <h2>6. Repairs</h2>
        <p>Please back up anything important before handing in a device for repair. We take care with your device, but we cannot be responsible for loss of data during a repair.</p>

        <h2>7. Acceptable use</h2>
        <p>Please use our services and website lawfully and don’t try to disrupt them or misuse another person’s account.</p>

        <h2>8. Our responsibility</h2>
        <p>Nothing in these terms limits our liability for death or personal injury caused by our negligence, or for fraud. Otherwise, our liability to you for any service is limited to what you paid us for that service. We are not liable for indirect or unforeseeable losses.</p>

        <h2>9. Changes</h2>
        <p>We may update these terms from time to time; the date above shows the latest version.</p>

        <h2>10. Governing law</h2>
        <p>These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction.</p>

        <h2>11. Contact us</h2>
        <p>Kosher Connect ({COMPANY.legalName})<br />
          {companyNumberLine()}<br />
          {registeredOfficeLine()}<br />
          Shop: 421 Bury New Road, Salford M7 4ED<br />
          Phone: <a href="tel:+441615311386">0161 531 1386</a><br />
          Email: <a href="mailto:support@kosher-connect.com">support@kosher-connect.com</a></p>
      </LegalShell>
    </>
  )
}
