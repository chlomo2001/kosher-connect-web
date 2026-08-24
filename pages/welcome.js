import { legalIdentifier } from '../lib/company.mjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import ThemeToggle from '../components/ThemeToggle'
import { WHATSAPP_ENABLED } from '../lib/flags'
import {
  PlaneIcon, FlipPhoneIcon, MusicIcon, WrenchIcon, BagIcon, ChatIcon,
  PhoneCallIcon, MailIcon, PinIcon,
} from '../components/kcIcons'

// The public face of Kosher Connect — the approved Sky redesign, rev5:
// dark starfield hero, centred text-only feature bands (three-tier heading:
// dark title → blue accent → gold subtitle), grouped "More" grid, a dark
// "why people send their friends" line, and a working "Send us a message"
// form. Bilingual (English + lashon hakodesh, RTL flips with it), with the
// dynamic opening hours, JSON-LD SEO and portal / login / join links kept.

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = '0161 531 1386' // shop's local form; tel: link stays +44
// support@, not admin@: this is the address a customer writes to. "admin"
// names an internal role and reads as the wrong door. Delivery is identical —
// the domain catches every address — so the choice is purely what it signals.
const EMAIL = 'support@kosher-connect.com'
// The business name leads the query so Google's pin card is titled "Kosher
// Connect" rather than "421 Bury New Rd". The address stays in the query as
// the fallback: with no matching place Google resolves the address part and
// centres there anyway, so the worst case is the card we already had.
//
// This only puts our name on the card if there is a Google Business Profile
// for it at this address. That is the owner's to create, not code's, and it
// is worth far more than the label — it is also what makes the shop show up
// when someone searches Maps for a phone shop in Salford.
const MAPS_QUERY = 'Kosher Connect, 421 Bury New Road, Salford M7 4ED'
const MAPS_URL = `https://maps.google.com/?q=${encodeURIComponent(MAPS_QUERY)}`
// The verified Business Profile's permanent Maps id — one place, no search.
const MAPS_CID = '15030193352652289139'
// Keyless Google Maps embed — the iframe endpoint needs no API key.
// Three takes on what the iframe asks for (08-04): the name+address SEARCH
// sometimes resolved to an area view with the pin off-screen; the bare
// address pinned reliably but the card read "421 Bury New Rd", not the shop
// (owner: "now it won't say our business name"). Embedding by cid asks for
// the Business Profile itself — name on the card AND a deterministic pin.
// If Google ever stops honouring cid on the keyless endpoint, fall back to
// the official Maps Embed API place mode (needs Maps Embed API enabled on
// the NEXT_PUBLIC key in the Google console).
const MAPS_EMBED = `https://maps.google.com/maps?cid=${MAPS_CID}&z=17&output=embed`

const BAND_IDS = ['mobile', 'travel', 'intl']

// Client-side mirror of the server's message-form validation (server is the
// real guard). A name needs a real letter (Latin or Hebrew); a contact is a
// valid email or has ≥7 digits — so "/" or junk can't be sent.
const nameOk = (s) => s.trim().length >= 2 && /[a-zA-Z֐-׿]/.test(s)
const contactOk = (s) => {
  const v = s.trim()
  if (/@/.test(v)) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
  return (v.match(/\d/g) || []).length >= 7
}

const T = {
  en: {
    dir: 'ltr', langLabel: 'EN',
    brandName: 'Kosher Connect',
    nav: { mobile: 'Mobile & SIM', travel: 'Travel phones', intl: 'International numbers', repairs: 'Repairs & more', repair: 'Book a repair', faq: 'Questions', visit: 'Visit us', message: 'Message us', account: 'My account' },
    heroEyebrow: 'Kosher Connect · Salford, Manchester',
    heroTitle: 'Your phone bill, halved.',
    heroBody: 'Kosher Connect is a phone and SIM shop in Salford, Manchester. Most people are quietly on the wrong SIM — bring us your last bill and we’ll match a plan to how you actually use your phone, same coverage, same number, far less money.',
    heroPill: 'Keep your number · pay less every month',
    ctaMessage: 'Message us', ctaCall: 'Call',
    heroSub: 'Kosher Connect is a phone and SIM shop in Salford, Manchester — travel phones, international numbers, repairs and more, all under one roof.',
    bands: [
      {
        eyebrow: 'Mobile & SIM',
        title: 'Kosher SIM plans, matched to how you really use your phone',
        accent: 'Pay less', sub: 'the right plan for how you really use your phone',
        body: 'Bring in your latest bill and we’ll go through it with you, line by line — what you use, what you don’t, and which plan actually fits, international minutes and all. Then we handle the switch from start to finish. No long contract you can’t follow, no company in the middle, no small print.',
        chips: ['Keep your number', 'Keep your phone', 'We do the switch for you'],
        price: '£20 setup · then £20 a year · £5 a service (free for USA & Canada SIMs)', cta: 'Bring us your bill',
        prefill: 'I’d like you to look at my phone bill and see if I could pay less.',
      },
      {
        eyebrow: 'Travel phones',
        title: 'A kosher phone, sorted before you travel',
        accent: 'Shabbos & Yom Tov never\u00A0charged', sub: 'priced by the day, not the trip',
        body: 'Off to the USA, Canada, Europe or Eretz Yisroel? Rent a kosher phone, set up with you in the shop before you go — so there’s nothing to arrange at a foreign airport. You pay by the day{minClause}, Shabbos and Yom Tov are never charged, and every rental includes local calls and calls back to the UK.',
        note: 'We can book your flights as well — one trip, one place.',
        chips: ['Set up before you travel', 'Priced by the day', 'Shabbos never charged'],
        price: '{dayClause}{minSpec}{capSpec}Shabbos & Yom Tov never charged', cta: 'Plan your trip',
        prefill: 'I’m planning a trip and would like a travel phone. Where I’m going and when: ',
      },
      {
        eyebrow: 'International numbers',
        title: 'An Israeli or USA number that rings on your UK phone',
        accent: 'Same day', sub: 'an Israeli or USA number, ringing on your own phone',
        body: 'Family in Israel? Business in the States? Get a local number that rings straight through to the phone already in your pocket — no second handset, and no roaming charges for the people calling you.',
        chips: ['Rings on your own phone', 'Israeli or USA number', 'No roaming for callers'],
        price: 'from £10 a month', cta: 'Get your number',
        prefill: 'I’d like an Israeli or USA number that rings on my own phone.',
      },
    ],
    moreTitle: 'More at Kosher Connect',
    moreLead: 'One shop for the phone and everything around it — so you’re not sent from place to place.',
    moreGroups: [
      {
        label: 'For your phone',
        items: [
          { icon: 'wrench', title: 'Repairs', body: 'Screens, batteries, charging trouble — most fixed quickly, and we’ll tell you honestly if it isn’t worth it.', href: '/repair', linkLabel: 'Book a repair →' },
          { icon: 'bag', title: 'Accessories', body: 'Chargers, cables, cases, power banks, SD cards, adapters and USA SIMs — on the shelf.', href: '#contact', linkLabel: 'Ask if it’s in stock →', prefill: 'I’m after an accessory — what I need: ' },
          { icon: 'phone', title: 'Kosher phones', body: 'The right kosher handset for you — we stock a range and talk you through what suits.', href: '/phone-guide', linkLabel: 'See the phone guide →' },
        ],
      },
      {
        label: 'Everyday help',
        items: [
          { icon: 'music', title: 'Kol Torah audio', body: 'Shiurim, music and children’s stories — on CD or loaded onto your phone or player while you visit.', href: '#contact', linkLabel: 'Ask about Kol Torah →', prefill: 'I’d like to ask about Kol Torah audio — shiurim, music or children’s stories.' },
          { icon: 'plane', title: 'Flights & tickets', body: 'We book the trip and keep an eye on times and changes, so it’s sorted before you pack.', href: '#contact', linkLabel: 'Start a booking →', prefill: 'I’d like help booking a flight. Where I’m going and when: ' },
          { icon: 'chat', title: 'Online help', body: 'Forms, printing and the little online jobs that are easier done properly than fought with.', href: '#contact', linkLabel: 'Tell us what you need →', prefill: 'I could use a hand with an online job — here’s what: ' },
        ],
      },
    ],
    phoneGuideCta: 'Choosing a handset? See the phone guide →',
    repairCta: 'Something broken? Book a repair →',
    friendsEyebrow: 'Why people send their friends',
    friendsText: 'No contracts, no middleman, no jargon — just the deal that actually fits you. And if you’re already on a good one, we’ll tell you.',
    contactEyebrow: 'Message us',
    contactTitle: 'Send us a message',
    contactLead: 'Ask a question, tell us your plan, or leave your bill details — we’ll get back to you.',
    fName: 'Your name', fContact: 'Phone or email', fMsg: 'How can we help?', fSend: 'Send message', fSending: 'Sending…',
    fEmail: 'Email (optional)', fAddress: 'Address (optional)',
    fReach: 'Best way to reach you (optional)',
    fReachOpts: { call: 'Call', text: 'Text message', whatsapp: 'WhatsApp', email: 'Email' },
    fOk: 'Thanks — we’ve got it. We reply during opening hours, usually the same day.',
    fErrLead: 'Couldn’t send — please call us on',
    fErrCodes: {
      rate: 'That’s a few messages in a row — give it a minute, or call us on',
      name: 'Please enter your name, then try again — or call us on',
      contact: 'Please check the phone number or email, then try again — or call us on',
      offline: 'We can’t take messages this minute — please call us on',
      server: 'Couldn’t send — please call us on',
    },
    fPrivacy: 'We only use these details to reply to you.', fPrivacyLink: 'Privacy notice',
    legalPrivacy: 'Privacy', legalTerms: 'Terms', legalRefunds: 'Refunds',
    faqEyebrow: 'Common questions',
    faqTitle: 'The things people ring up and ask',
    faq: [
      { q: 'Which kosher phone should I get?',
        a: 'Come in and we will go through it with you — the handsets differ in what they can do and in what they cost to run, and the right one depends on what you actually need it for. Our phone guide sets out the range, and there is no pressure to decide on the spot.' },
      { q: 'Can I keep my own number if I move my plan to you?',
        a: 'Yes, in almost every case. You ask your current provider for a PAC code — it is free, and they must give it to you — and we do the rest. Your number stays yours, and we will tell you before anything switches over so you are never without a phone unexpectedly.' },
      { q: 'Can I have an American or Israeli number that rings here in England?',
        a: 'Yes — that is what our international numbers do. Family or business abroad dial a local number in their country, and it reaches you here. Ring us and we will explain which countries we cover and what suits how you will use it.' },
      { q: 'I am travelling — what should I sort out before I go?',
        a: 'Come in before you fly and we will set a rental phone up with you in the shop, so there is nothing to arrange at a foreign airport. Shabbos and Yom Tov are never charged. If you are flying with us as well, we can book the flight and the phone in one visit.' },
      { q: 'My new SIM is not working — is it broken?',
        a: 'Nearly always not. It is usually the phone needing a restart after the SIM goes in, or the plan not being switched on yet. Give us a ring and we will check it from our side before you make a journey.' },
      { q: 'My phone stopped working while I was abroad — what do I do?',
        a: 'Ring us on 0161 531 1386. If it is a rental we can usually sort it over the phone, and if it cannot be fixed remotely we will arrange a replacement. Do not buy a local SIM before speaking to us — it often makes the number harder to recover.' },
      { q: 'How do I pay, and what happens if I forget?',
        a: 'Most plans are handled by us and billed to your account, so there is nothing to remember. Your balance and renewal dates are always on your account page, and you can pay there or in the shop.' },
      { q: 'You are closed — can I still get help?',
        a: 'Leave us a message with the form on this page, or ring and leave a voicemail. We pick both up when we open. For an urgent problem abroad, say so in the message and we will come back to you first.' },
    ],
    appEyebrow: 'The Kosher Connect app',
    appTitle: 'Your account online — what the app does',
    appBody1: 'Kosher Connect is this shop’s online account app. Customers sign in to see their SIM plans, phone rentals, flight bookings, repairs and balance, and to pay online — and our team runs the shop on the same system: rentals, SIM plan management, repairs, bookings and the till.',
    appBody2: 'Signing in with Google is optional and only confirms your name and email address, so we know which account is yours. We never see or access your Gmail, your Drive files, your contacts or anything else in your Google account. The full detail is in our privacy policy.',
    appPolicy: 'Read the privacy policy', appAccount: 'Go to my account',
    fBadName: 'Please enter your name.', fBadContact: 'Please enter a valid phone number or email address.',
    preferCall: 'Prefer to call?',
    waLabel: 'WhatsApp us', waText: 'Hello Kosher Connect — I’d like to ask about…',
    visitTitle: 'Come and see us',
    openMaps: 'Open in Google Maps',
    addressLabel: 'Address',
    addressLine: '421 Bury New Road, Salford M7 4ED',
    findUs: 'The door left of Toy Zone (MMR Group sign) — ring bell 5, we’re on level 2.',
    phoneLabel: 'Phone', emailLabel: 'Email',
    footServices: 'Services', footAccount: 'Your account', footLegal: 'Information',
    hoursLabel: 'Open',
    rights: 'All rights reserved.',
    tradingName: 'Kosher Connect is a trading name of',
    paidTitle: 'Payment received — thank you!',
    paidBody: 'Your payment went through and will show on your account shortly.',
    paidClose: 'Dismiss',
    backTop: 'Back to top',
  },
  he: {
    dir: 'rtl', langLabel: 'HE',
    brandName: 'כשר קונקט',
    nav: { mobile: 'חבילות וסים', travel: 'טלפון לחו״ל', intl: 'מספרים בינלאומיים', repairs: 'תיקונים ועוד', repair: 'לקבוע תיקון', faq: 'שאלות', visit: 'בואו לבקר', message: 'דברו איתנו', account: 'האזור האישי' },
    heroEyebrow: 'כשר קונקט · סלפורד, מנצ׳סטר',
    heroTitle: 'למה לשלם כפול על הסלולר?',
    heroBody: 'כשר קונקט היא חנות סלולר וסים בסלפורד, מנצ׳סטר. רוב האנשים משלמים כל חודש על חבילה שפשוט לא מתאימה להם — תביאו לנו את החשבונית האחרונה ונתאים לכם חבילה לפי השימוש האמיתי שלכם. אותה רשת, אותו מספר, והרבה פחות בסוף החודש.',
    heroPill: 'המספר נשאר · החשבון קטן',
    ctaMessage: 'דברו איתנו', ctaCall: 'חייגו',
    heroSub: 'כשר קונקט היא חנות סלולר וסים בסלפורד, מנצ׳סטר — טלפונים לחו״ל, מספרים בינלאומיים, תיקונים ועוד, הכול במקום אחד.',
    bands: [
      {
        eyebrow: 'חבילות וסים',
        title: 'חבילה כשרה שנתפרת בדיוק לפי השימוש שלכם',
        accent: 'משלמים פחות', sub: 'החבילה הנכונה, לפי מה שאתם באמת צריכים',
        body: 'תביאו את החשבונית האחרונה ונעבור עליה ביחד, שורה אחרי שורה — מה אתם באמת מנצלים, מה מיותר, ואיזו חבילה באמת מתאימה, כולל דקות לחו״ל. ומשם? את כל המעבר אנחנו עושים בשבילכם, מההתחלה ועד הסוף. בלי התחייבות, בלי חברה באמצע, בלי אותיות קטנות.',
        chips: ['שומרים על המספר', 'נשארים עם אותו מכשיר', 'המעבר — עלינו'],
        price: '‎£20‎ הקמה · ‎£20‎ לשנה · ‎£5‎ לשירות (חינם לסים של ארה״ב וקנדה)', cta: 'תביאו לנו את החשבונית',
        prefill: 'אשמח שתעברו על חשבונית הסלולר שלי ותבדקו אם אפשר לשלם פחות.',
      },
      {
        eyebrow: 'טלפון לחו״ל',
        title: 'טסים? הטלפון הכשר כבר מחכה לכם מוכן',
        accent: 'שבת ויום טוב בחינם', sub: 'התשלום לפי יום, לא לפי נסיעה',
        body: 'טסים לארה״ב, קנדה, אירופה או לארץ? שוכרים אצלנו טלפון כשר, ומגדירים אותו איתכם בחנות עוד לפני הטיסה — בלי להסתבך בשדה תעופה. משלמים לפי יום{minClause}, שבת ויום טוב — בחינם תמיד, וכל השכרה כוללת שיחות מקומיות ושיחות חזרה לאנגליה.',
        note: 'ואפשר להזמין אצלנו גם את הטיסות — נסיעה אחת, הכול במקום אחד.',
        chips: ['מוכן לפני הטיסה', 'תמחור לפי יום', 'שבת ויו״ט בחינם'],
        price: '{dayClause}{minSpec}{capSpec}שבת ויום טוב בחינם, תמיד', cta: 'דברו איתנו לפני הטיסה',
        prefill: 'אני מתכנן/ת נסיעה ואשמח לשכור טלפון לחו״ל. לאן ומתי: ',
      },
      {
        eyebrow: 'מספרים בינלאומיים',
        title: 'מספר ישראלי או אמריקאי — מצלצל אצלכם בנייד',
        accent: 'באותו היום', sub: 'המספר מקומי, הטלפון — שלכם',
        body: 'המשפחה בארץ? עסקים באמריקה? מקבלים מספר מקומי שמצלצל ישר לנייד שכבר יש לכם — בלי מכשיר נוסף, ומי שמתקשר אליכם משלם שיחה מקומית רגילה, בלי רומינג.',
        chips: ['מצלצל בנייד שלכם', 'מספר ישראלי או אמריקאי', 'שיחה מקומית למתקשרים'],
        price: 'החל מ־‎£10‎ לחודש', cta: 'להזמנת מספר',
        prefill: 'אשמח למספר ישראלי או אמריקאי שמצלצל אצלי בנייד.',
      },
    ],
    moreTitle: 'עוד אצלנו בכשר קונקט',
    moreLead: 'חנות אחת לטלפון ולכל מה שמסביב — במקום להתרוצץ בין מקומות.',
    moreGroups: [
      {
        label: 'לטלפון שלכם',
        items: [
          { icon: 'wrench', title: 'תיקונים', body: 'מסך, סוללה, בעיות טעינה — את רוב התיקונים מסיימים מהר. ואם לא שווה לתקן? נגיד לכם ביושר.', href: '/repair', linkLabel: 'לקבוע תיקון ←' },
          { icon: 'bag', title: 'אביזרים', body: 'מטענים, כבלים, כיסויים, מטענים ניידים, כרטיסי זיכרון, מתאמים וסים לארה״ב — הכול על המדף.', href: '#contact', linkLabel: 'לבדוק אם יש במלאי ←', prefill: 'אני מחפש/ת אביזר — מה שאני צריך/ה: ' },
          { icon: 'phone', title: 'טלפונים כשרים', body: 'מגוון מכשירים כשרים במלאי — ונעזור לכם לבחור את מה שבאמת מתאים.', href: '/phone-guide', linkLabel: 'למדריך הטלפונים ←' },
        ],
      },
      {
        label: 'עזרה יומיומית',
        items: [
          { icon: 'music', title: 'קול תורה', body: 'שיעורים, ניגונים וסיפורים לילדים — על דיסק, או שנעביר לכם ישר לטלפון או לנגן בזמן שאתם כאן.', href: '#contact', linkLabel: 'לשאול על קול תורה ←', prefill: 'אשמח לשמוע על קול תורה — שיעורים, ניגונים או סיפורים לילדים.' },
          { icon: 'plane', title: 'טיסות וכרטיסים', body: 'מזמינים לכם את הטיסה ועוקבים אחרי הזמנים והשינויים — הכול סגור עוד לפני שאתם אורזים.', href: '#contact', linkLabel: 'להתחיל הזמנה ←', prefill: 'אשמח לעזרה בהזמנת טיסה. לאן ומתי: ' },
          { icon: 'chat', title: 'עזרה אונליין', body: 'טפסים, הדפסות וכל הסידורים הקטנים באינטרנט — אנחנו נעשה את זה בשבילכם, בלי כאב ראש.', href: '#contact', linkLabel: 'ספרו לנו מה צריך ←', prefill: 'אשמח לעזרה בסידור באינטרנט — במה מדובר: ' },
        ],
      },
    ],
    phoneGuideCta: 'מתלבטים איזה מכשיר? למדריך הטלפונים ←',
    repairCta: 'משהו התקלקל? לקבוע תיקון ←',
    friendsEyebrow: 'למה ממליצים עלינו',
    friendsText: 'בלי חוזים, בלי מתווכים, בלי אותיות קטנות — פשוט מה שמתאים לכם באמת. וכשאתם כבר על חבילה טובה? נגיד לכם לא לגעת.',
    contactEyebrow: 'דברו איתנו',
    contactTitle: 'שלחו לנו הודעה',
    contactLead: 'שאלה, בקשה, או פרטים מהחשבונית — כתבו לנו ונחזור אליכם.',
    fName: 'שם מלא', fContact: 'טלפון או מייל', fMsg: 'איך אפשר לעזור?', fSend: 'שליחה', fSending: 'שולחים…',
    fEmail: 'מייל (לא חובה)', fAddress: 'כתובת (לא חובה)',
    fReach: 'איך הכי נוח לחזור אליכם? (לא חובה)',
    fReachOpts: { call: 'שיחת טלפון', text: 'הודעת טקסט', whatsapp: 'וואטסאפ', email: 'אימייל' },
    fOk: 'תודה! ההודעה אצלנו — נחזור אליכם בשעות הפתיחה, לרוב עוד באותו יום.',
    fErrLead: 'ההודעה לא נשלחה — התקשרו אלינו:',
    fErrCodes: {
      rate: 'נשלחו כמה הודעות ברצף — נסו שוב בעוד דקה, או התקשרו אלינו:',
      name: 'נא למלא את השם ולנסות שוב — או להתקשר אלינו:',
      contact: 'נא לבדוק את מספר הטלפון או המייל ולנסות שוב — או להתקשר אלינו:',
      offline: 'לא נוכל לקבל הודעות ברגע זה — נא להתקשר אלינו:',
      server: 'ההודעה לא נשלחה — התקשרו אלינו:',
    },
    fPrivacy: 'הפרטים משמשים אותנו רק כדי לחזור אליכם.', fPrivacyLink: 'מדיניות הפרטיות',
    legalPrivacy: 'פרטיות', legalTerms: 'תנאים', legalRefunds: 'החזרים',
    faqEyebrow: 'שאלות נפוצות',
    faqTitle: 'מה שהכי שואלים אותנו בטלפון',
    faq: [
      { q: 'איזה טלפון כשר מתאים לי?',
        a: 'בואו לחנות ונעבור על זה יחד — המכשירים שונים במה שהם עושים ובעלות התפעול, והבחירה תלויה במה שאתם באמת צריכים. במדריך המכשירים תמצאו את כל הדגמים, ואין שום לחץ להחליט במקום.' },
      { q: 'אפשר לשמור על המספר הקיים אם עוברים אליכם?',
        a: 'כן, כמעט תמיד. מבקשים מהחברה הנוכחית קוד PAC — זה בחינם והם חייבים לתת לכם אותו — ואת השאר אנחנו עושים. המספר נשאר שלכם, ונעדכן אתכם לפני שמשהו עובר, כך שלא תישארו בלי טלפון בהפתעה.' },
      { q: 'אפשר מספר אמריקאי או ישראלי שמצלצל כאן באנגליה?',
        a: 'כן — בדיוק בשביל זה המספרים הבינלאומיים. המשפחה או העסק בחו״ל מחייגים מספר מקומי אצלם, וזה מגיע אליכם לכאן. התקשרו ונסביר אילו מדינות יש לנו ומה מתאים לאופן שבו תשתמשו בזה.' },
      { q: 'אני נוסע — מה כדאי לסדר לפני?',
        a: 'בואו לפני הטיסה ונכין איתכם את הטלפון בחנות, כך שלא צריך לארגן כלום בשדה תעופה זר. שבת ויום טוב אף פעם לא מחויבים. אם גם את הטיסה מזמינים דרכנו, אפשר לסגור את שניהם בביקור אחד.' },
      { q: 'הסים החדש לא עובד — הוא תקול?',
        a: 'כמעט תמיד לא. בדרך כלל צריך לכבות ולהדליק את הטלפון אחרי הכנסת הסים, או שהחבילה עוד לא הופעלה. התקשרו ונבדוק מהצד שלנו לפני שתגיעו במיוחד.' },
      { q: 'הטלפון הפסיק לעבוד בחו״ל — מה עושים?',
        a: 'התקשרו אלינו: 0161 531 1386. אם זו השכרה, לרוב נוכל לפתור את זה בטלפון, ואם לא — נדאג למכשיר חלופי. אל תקנו סים מקומי לפני שדיברתם איתנו; זה בדרך כלל מקשה על שחזור המספר.' },
      { q: 'איך משלמים, ומה קורה אם שוכחים?',
        a: 'רוב החבילות מנוהלות אצלנו ומחויבות לחשבון שלכם, כך שאין מה לזכור. היתרה ותאריכי החידוש תמיד מופיעים באזור האישי, ואפשר לשלם שם או בחנות.' },
      { q: 'אתם סגורים — אפשר בכל זאת לקבל עזרה?',
        a: 'השאירו לנו הודעה בטופס שבעמוד, או התקשרו והשאירו הודעה קולית. אנחנו אוספים את שתיהן עם הפתיחה. אם זה דחוף ואתם בחו״ל — כתבו זאת, ונחזור אליכם ראשונים.' },
    ],
    appEyebrow: 'האפליקציה של כשר קונקט',
    appTitle: 'החשבון שלכם אונליין — מה האפליקציה עושה',
    appBody1: 'כשר קונקט היא אפליקציית החשבון המקוון של החנות. לקוחות נכנסים כדי לראות את חבילות הסים, השכרות הטלפונים, הזמנות הטיסות, התיקונים והיתרה — ולשלם אונליין. הצוות שלנו מנהל באותה מערכת את החנות עצמה: השכרות, חבילות, תיקונים, הזמנות והקופה.',
    appBody2: 'התחברות עם Google היא אופציונלית ומאשרת רק את השם וכתובת המייל שלכם, כדי שנדע איזה חשבון שייך לכם. אין לנו גישה ל‑Gmail, לקבצי Drive, לאנשי הקשר או לכל דבר אחר בחשבון Google שלכם. הפירוט המלא במדיניות הפרטיות.',
    appPolicy: 'למדיניות הפרטיות', appAccount: 'לאזור האישי',
    fBadName: 'נא להזין שם.', fBadContact: 'נא להזין מספר טלפון או כתובת מייל תקינים.',
    preferCall: 'מעדיפים להתקשר?',
    waLabel: 'כתבו לנו בוואטסאפ', waText: 'שלום כשר קונקט — רציתי לשאול לגבי…',
    visitTitle: 'מחכים לכם בחנות',
    openMaps: 'לניווט בגוגל מפות',
    addressLabel: 'כתובת',
    addressLine: '421 Bury New Road, Salford M7 4ED',
    findUs: 'הדלת משמאל ל־Toy Zone (שלט MMR Group) — מצלצלים בפעמון 5, קומה 2.',
    phoneLabel: 'טלפון', emailLabel: 'מייל',
    footServices: 'שירותים', footAccount: 'האזור האישי', footLegal: 'מידע',
    hoursLabel: 'שעות פתיחה',
    rights: 'כל הזכויות שמורות.',
    tradingName: 'כשר קונקט הוא שם מסחרי של',
    paidTitle: 'התשלום התקבל — תודה רבה!',
    paidBody: 'התשלום עבר בהצלחה ויופיע בחשבון שלכם בקרוב.',
    paidClose: 'סגירה',
    backTop: 'חזרה למעלה',
  },
}

const MORE_ICONS = { wrench: WrenchIcon, bag: BagIcon, phone: FlipPhoneIcon, music: MusicIcon, plane: PlaneIcon, chat: ChatIcon }

// kcIcons has no clock — small local one for the opening-hours row.
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
)

const LD_JSON = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Kosher Connect',
  legalName: 'Hatsluche Ltd',
  description: 'Kosher phones, SIM plans, travel phone rentals, international numbers, Kol Torah audio and repairs. Serving the Heimishe community.',
  telephone: '+441615311386',
  email: EMAIL,
  url: 'https://www.kosher-connect.com/',
  // The square icon, not logo.png: Google's logo guidance wants a square
  // image at a stable URL, same rule as the favicon it was refusing.
  logo: 'https://www.kosher-connect.com/icon-512.png',
  image: 'https://www.kosher-connect.com/logo-full.png',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '421 Bury New Road, Level 2',
    addressLocality: 'Salford',
    addressRegion: 'Greater Manchester',
    postalCode: 'M7 4ED',
    addressCountry: 'GB',
  },
  // Must be kept in step with the settings key `opening_hours` (the visible
  // page text is settings-driven; this schema copy is static and only a
  // deploy updates it).
  openingHours: ['Su 14:00-18:30', 'Mo-Th 14:00-18:30'],
  // The verified Google Business Profile (2026-08-03). The cid is the card's
  // permanent Maps identifier (hex 0xd095f9388a46f473 from the owner's place
  // URL, in decimal). Ties the site to the Search/Maps card — several
  // unrelated "Kosher Connect"s exist (a dating service, a US restaurant
  // directory), so the explicit link matters more here than usual.
  hasMap: `https://maps.google.com/?cid=${MAPS_CID}`,
  sameAs: [`https://maps.google.com/?cid=${MAPS_CID}`, 'https://share.google/f9Ccv6oC7kaRvod0w'],
})

// Fill the price placeholders in a band from the LIVE rental rates. With no
// rates loaded every placeholder becomes '', so the sentence still reads: "You
// pay by the day, Shabbos and Yom Tov are never charged." No price beats a
// stale one — all three numbers typed into this page had drifted by 19 Aug.
const money = (n) => `£${Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2)}`
const range = (r) => (r.from === r.to ? money(r.from) : `${money(r.from)}–${money(r.to)}`)

export function withPrices(band, rental, lang) {
  const he = lang === 'he'
  const fill = {
    minClause: rental ? (he ? ` (מינימום ‎${range(rental.min)}‎ לפי היעד)` : ` (minimum ${range(rental.min)} by destination)`) : '',
    dayClause: rental ? (he ? `‎${range(rental.day)}‎ ליום · ` : `${range(rental.day)} a day · `) : '',
    minSpec: rental ? (he ? `מינימום ‎${range(rental.min)}‎ · ` : `minimum ${range(rental.min)} · `) : '',
    capSpec: rental ? (he ? `תקרה חודשית ‎${range(rental.cap)}‎ · ` : `capped ${range(rental.cap)} a month · `) : '',
  }
  const swap = (text) => String(text || '').replace(/\{(minClause|dayClause|minSpec|capSpec)\}/g, (_, k) => fill[k])
  return { ...band, body: swap(band.body), price: swap(band.price) }
}

export default function Welcome() {
  const [lang, setLang] = useState('en')
  const [hours, setHours] = useState('Sunday–Thursday, 2:00–6:30pm')
  // name + contact are required; the rest are the fields /join used to collect
  // on a page of its own. They ride along optionally rather than sending
  // someone to a second form that filed the identical staff task.
  const EMPTY_FORM = { name: '', contact: '', email: '', preferredContact: '', address: '', message: '' }
  const [form, setForm] = useState(EMPTY_FORM)
  // Google Places is ~200KB and this is the highest-traffic page in the
  // product, so the helper is not loaded until someone actually puts a cursor
  // in the address box. Until then the field is an ordinary text input.
  const [wantAddr, setWantAddr] = useState(false)
  const addrRef = useRef(null)
  const attachAddr = () => {
    if (window.kcAddressAutocomplete && addrRef.current) {
      window.kcAddressAutocomplete(addrRef.current, {
        onSelect: (r) => setForm((f) => ({ ...f, address: r.formatted })),
      })
    }
  }
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState('') // '', 'ok', 'err'
  const [errCode, setErrCode] = useState('')
  const [paid, setPaid] = useState(false) // Stripe Checkout success lands on /welcome?paid=1
  const [showTop, setShowTop] = useState(false)
  // Rental prices come from the rental_rates rows the till bills from
  // (/api/public/info). Null until they arrive, and null is rendered as NO
  // price clause at all — a page that has not loaded its prices yet must show
  // nothing rather than a number somebody typed in once.
  const [rental, setRental] = useState(null)
  useEffect(() => {
    try { const saved = localStorage.getItem('kcLang'); if (saved && T[saved]) setLang(saved) } catch {}
    try { if (new URLSearchParams(window.location.search).get('paid') === '1') setPaid(true) } catch {}
    fetch('/api/public/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.openingHours) setHours(d.openingHours); if (d?.rental) setRental(d.rental) })
      .catch(() => {})
  }, [])
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scrollspy: light up the nav link of the section currently on screen.
  useEffect(() => {
    const ids = ['mobile', 'travel', 'intl', 'services', 'visit']
    const secs = ids.map((id) => document.getElementById(id)).filter(Boolean)
    const mark = (id) => {
      document.querySelectorAll('.sk-navlink, .sk-mobnav a').forEach((a) => {
        a.classList.toggle('on', a.getAttribute('href') === `#${id}`)
      })
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) mark(e.target.id) })
    }, { rootMargin: '-45% 0px -50% 0px' })
    secs.forEach((s) => obs.observe(s))
    // Above the first section (hero) nothing should be lit.
    const clearAtTop = () => { if (window.scrollY < 300) mark('') }
    window.addEventListener('scroll', clearAtTop, { passive: true })
    return () => { obs.disconnect(); window.removeEventListener('scroll', clearAtTop) }
  }, [lang])
  const pick = (l) => { setLang(l); try { localStorage.setItem('kcLang', l) } catch {} }
  // Strip ?paid=1 on dismiss so a refresh or shared link doesn't re-announce it.
  const dismissPaid = () => { setPaid(false); try { window.history.replaceState(null, '', window.location.pathname) } catch {} }
  // Every prefill string in both languages. A door may replace the message
  // when it is still exactly one of these — i.e. seeded, not typed. Full
  // equality only: prefix matching would eat text typed after the ": ".
  const PREFILLS = useMemo(() => {
    const out = new Set()
    Object.values(T).forEach((d) => {
      ;(d.bands || []).forEach((b) => { if (b.prefill) out.add(b.prefill.trim()) })
      ;(d.moreGroups || []).forEach((g) => (g.items || []).forEach((m) => { if (m.prefill) out.add(m.prefill.trim()) }))
    })
    return out
  }, [])
  const seedMessage = (prefill) => setForm((f) => {
    const cur = f.message.trim()
    return (cur && !PREFILLS.has(cur)) ? f : { ...f, message: prefill }
  })
  const t = T[lang]
  const waHref = `https://wa.me/441615311386?text=${encodeURIComponent(t.waText)}`

  useEffect(() => {
    // js-on arms the reveal's hidden state — see the .sk-reveal CSS comment.
    // Only added here, so a no-JS visitor never gets content hidden on them.
    const root = document.querySelector('.sk')
    const els = document.querySelectorAll('.sk-reveal:not(.in)')
    // Build the observer FIRST. On engines without it (iOS 11-12.1) the throw
    // used to happen after .js-on had already hidden every reveal, leaving the
    // page blank below the hero. Now a failure simply means no animation.
    let obs
    try {
      obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) } })
      }, { threshold: 0.12 })
    } catch { return }
    if (root) root.classList.add('js-on')
    els.forEach((c) => obs.observe(c))
    return () => obs.disconnect()
  }, [lang])

  const submit = async (e) => {
    e.preventDefault()
    if (sending) return
    if (!nameOk(form.name)) { setSent('err'); setErrCode('name'); return }
    if (!contactOk(form.contact)) { setSent('err'); setErrCode('contact'); return }
    setSending(true); setSent(''); setErrCode('')
    try {
      const r = await fetch('/api/public/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), contact: form.contact.trim(), message: form.message.trim(),
          email: form.email.trim(), address: form.address.trim(),
          preferredContact: form.preferredContact,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.success) { setSent('ok'); setForm(EMPTY_FORM) }
      // Keep the CODE, never the server's English sentence — printing that
      // verbatim put English inside the Hebrew page (WCAG 3.1.2).
      else { setSent('err'); setErrCode(j.code || 'server') }
    } catch { setSent('err'); setErrCode('offline') }
    finally { setSending(false) }
  }

  return (
    <>
      <Head>
        <title>Kosher Connect — kosher phones, SIMs & travel rentals in Manchester</title>
        <meta name="description" content="Kosher Connect - Kosher phones, SIM plans, travel phones, repairs, and international numbers. Serving the Heimishe community from Manchester." />
        <link rel="canonical" href="https://www.kosher-connect.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kosher Connect" />
        <meta property="og:title" content="Kosher Connect — Your phone bill, halved" />
        <meta property="og:description" content="Kosher phones, SIM plans, travel rentals, international numbers, Kol Torah audio and repairs — under one roof in Manchester." />
        <meta property="og:url" content="https://www.kosher-connect.com/" />
        <meta property="og:image" content="https://www.kosher-connect.com/logo-full.png" />
        <meta property="og:image:width" content="1080" />
        <meta property="og:image:height" content="509" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: LD_JSON }} />
        {/* Built from the rendered strings, so the markup can't drift from
            what a visitor actually reads. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: t.faq.map((f) => ({
            '@type': 'Question', name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }) }} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: SKY_CSS }} />
      {/* Physical side, chosen from the page's language — NOT insetInlineEnd.
          This button is rendered outside the dir="rtl" wrapper below, so a
          logical inset resolves against the document (always LTR) and pinned it
          to the right at every width, while .sk-nav reserves its 56px lane at
          the bar's logical end — the LEFT in Hebrew. The toggle therefore sat
          directly on top of the Hebrew logo, at 320px and at 1440px alike.
          Measured overlapping at every width tested before this line changed. */}
      <ThemeToggle style={{ position: 'fixed', top: 14, [t.dir === 'rtl' ? 'left' : 'right']: 14, zIndex: 60 }} />

      <div className="sk" dir={t.dir} lang={lang === 'en' ? 'en-GB' : lang}>
        <header className="sk-nav-wrap">
          <div className="sk-wrap sk-nav">
            <a className="sk-brand" href="#top">
              <span className="sk-logo" role="img" aria-label={t.brandName} />
            </a>
            <nav className="sk-nav-links" aria-label="Site">
              <a href="#mobile" className="sk-navlink">{t.nav.mobile}</a>
              <a href="#travel" className="sk-navlink">{t.nav.travel}</a>
              <a href="#intl" className="sk-navlink">{t.nav.intl}</a>
              <a href="#services" className="sk-navlink">{t.nav.repairs}</a>
              <a href="#visit" className="sk-navlink">{t.nav.visit}</a>
              <div className="sk-lang" role="group" aria-label="Language">
                {['en', 'he'].map((l) => (
                  <button key={l} type="button" lang={l === 'en' ? 'en' : l}
                    className={lang === l ? 'on' : ''} aria-pressed={lang === l}
                    onClick={() => pick(l)}>{T[l].langLabel}</button>
                ))}
              </div>
              <a href="/portal" className="sk-btn sk-btn-ghost sk-btn-sm">{t.nav.account}</a>
              <a href="#contact" className="sk-btn sk-btn-sky sk-btn-sm">{t.nav.message}</a>
            </nav>
          </div>
          {/* Phones lose the top nav links entirely (<=960px) — give them a
              swipeable chip strip so the sections stay one tap away. */}
          <div className="sk-mobnav-wrap">
          <nav className="sk-mobnav" aria-label="Site sections">
            {/* On phones the bar has no room for the CTA, so it rides here —
                first, so it is never what has scrolled out of view. Hidden by
                CSS above 640px, where it sits in the bar instead. */}
            <a href="#contact" className="sk-mobnav-cta">{t.nav.message}</a>
            <a href="#mobile">{t.nav.mobile}</a>
            <a href="#travel">{t.nav.travel}</a>
            <a href="#intl">{t.nav.intl}</a>
            <a href="#services">{t.nav.repairs}</a>
            <a href="#faq">{t.nav.faq}</a>
            <a href="#visit">{t.nav.visit}</a>
            <a href="/portal">{t.nav.account}</a>
          </nav>
          </div>
        </header>

        {paid && (
          <div className="sk-paid" role="status">
            <div className="sk-wrap sk-paid-in">
              <span className="sk-paid-tick" aria-hidden="true">✓</span>
              <span className="sk-paid-txt">
                <strong>{t.paidTitle}</strong>
                <span>{t.paidBody}</span>
              </span>
              <button type="button" className="sk-paid-x" onClick={dismissPaid} aria-label={t.paidClose}>×</button>
            </div>
          </div>
        )}

        <section className="sk-hero" id="top">
          <div className="sk-hero-stars" aria-hidden="true" />
          <div className="sk-wrap">
            <span className="sk-eyebrow">{t.heroEyebrow}</span>
            <h1>{t.heroTitle}</h1>
            <p className="sk-hero-body">{t.heroBody}</p>
            <span className="sk-pill">{t.heroPill}</span>
            <div className="sk-hero-cta">
              <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact">{t.ctaMessage}</a>
              <a className="sk-btn sk-btn-ghost sk-btn-lg" href={PHONE_TEL}>{t.ctaCall}{' '}<span dir="ltr">{PHONE_SHOWN}</span></a>
            </div>
            <p className="sk-hero-sub">{t.heroSub}</p>
          </div>
        </section>

        {t.bands.map((rawBand, i) => {
          const b = withPrices(rawBand, rental, lang)
          return (
          <section className={`sk-band ${i % 2 ? 'sk-band-tint' : ''}`} id={BAND_IDS[i]} key={`${lang}-b${i}`}>
            <div className="sk-wrap sk-band-inner sk-reveal">
              <span className="sk-eyebrow">{b.eyebrow}</span>
              <h2>{b.title}</h2>
              <div className="sk-accent">{b.accent}</div>
              <div className="sk-subline">{b.sub}</div>
              <p className="sk-band-body">{b.body}</p>
              {b.note && <p className="sk-band-note">{b.note}</p>}
              <div className="sk-chips">{b.chips.map((c, j) => <span key={j}>✓ {c}</span>)}</div>
              {b.price && <div className="sk-band-price">{b.price}</div>}
              {/* Each band CTA promises a different door ("Plan your trip"…)
                  but they all land on the one form — seed the message so the
                  form reflects the promise. Empty-only: never clobber text the
                  visitor already typed. The anchor jump itself is untouched. */}
              <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact"
                onClick={() => { if (b.prefill) seedMessage(b.prefill) }}>{b.cta}</a>
            </div>
          </section>
          )
        })}

        <section className="sk-also" id="services">
          <div className="sk-wrap">
            <h2 className="sk-reveal">{t.moreTitle}</h2>
            <p className="sk-also-lead sk-reveal">{t.moreLead}</p>
            {t.moreGroups.map((g, gi) => (
              <div key={`${lang}-g${gi}`}>
                <div className="sk-group-label sk-reveal">{g.label}</div>
                <div className="sk-grid">
                  {g.items.map((m, i) => {
                    const Icon = MORE_ICONS[m.icon] || ChatIcon
                    // Every tile is a real door, not a poster (owner ask
                    // 08-04: "every tile should be clickable"). Tiles that
                    // land on the contact form seed a fitting message the
                    // same way the band CTAs do — empty-only, never
                    // clobbering what the visitor already typed.
                    const Tag = m.href ? 'a' : 'div'
                    return (
                      <Tag className={`sk-tile sk-reveal ${m.href ? 'sk-tile-link' : ''}`}
                        key={`${lang}-g${gi}-m${i}`}
                        {...(m.href ? {
                          href: m.href,
                          onClick: m.prefill
                            ? () => seedMessage(m.prefill)
                            : undefined,
                        } : {})}>
                        <div className="sk-tile-ico" aria-hidden="true"><Icon /></div>
                        <h4>{m.title}</h4>
                        <p>{m.body}</p>
                        {m.linkLabel && <span className="sk-tile-cta">{m.linkLabel}</span>}
                      </Tag>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className="sk-guide"><a href="/phone-guide">{t.phoneGuideCta}</a></p>
            <p className="sk-guide"><a href="/repair">{t.repairCta}</a></p>
          </div>
        </section>

        <section className="sk-friends">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.friendsEyebrow}</span>
            <p className="sk-friends-line">{t.friendsText}</p>
          </div>
        </section>

        <section className="sk-faq" id="faq">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.faqEyebrow}</span>
            <h2>{t.faqTitle}</h2>
            <div className="sk-faq-list">
              {t.faq.map((f, i) => (
                <details className="sk-faq-item" key={i}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Google's OAuth branding review reads THIS page as the app's
            homepage, and its checklist wants the application itself explained
            here — what the app does and what Google sign-in data is used for —
            not only the business. Keep this section: removing it re-fails the
            "homepage does not explain the purpose of your app" check. */}
        {/* Deliberately NOT .sk-reveal: the scroll-reveal renders unscrolled
            content at opacity 0, and Google's homepage verifier (like our own
            harness) loads without scrolling — an invisible purpose statement
            fails the check exactly like a missing one. */}
        <section className="sk-appinfo" id="app">
          <div className="sk-wrap">
            <span className="sk-eyebrow">{t.appEyebrow}</span>
            <h2>{t.appTitle}</h2>
            <p>{t.appBody1}</p>
            <p>{t.appBody2}</p>
            <p className="sk-appinfo-links">
              <a href="/privacy">{t.appPolicy}</a>
              <a href="/portal">{t.appAccount}</a>
            </p>
          </div>
        </section>

        <section className="sk-contact" id="contact">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.contactEyebrow}</span>
            <h2>{t.contactTitle}</h2>
            <p className="sk-contact-lead">{t.contactLead}</p>
            <form className="sk-form" onSubmit={submit}>
              <input type="text" name="name" autoComplete="name" placeholder={t.fName} aria-label={t.fName}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input type="text" name="contact" placeholder={t.fContact} aria-label={t.fContact}
                value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required />
              <input type="email" name="email" placeholder={t.fEmail} aria-label={t.fEmail}
                dir="ltr" inputMode="email" autoComplete="email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <div className="sk-form-reach">
                <span className="sk-form-hint" id="sk-reach-label">{t.fReach}</span>
                <div className="sk-reach-chips" role="radiogroup" aria-labelledby="sk-reach-label">
                  {['call', 'text', 'whatsapp', 'email']
                    .filter((k) => k !== 'whatsapp' || WHATSAPP_ENABLED)
                    .map((k) => {
                      const on = form.preferredContact === k
                      return (
                        <button key={k} type="button" role="radio" aria-checked={on} className="sk-reach-chip"
                          onClick={() => setForm({ ...form, preferredContact: on ? '' : k })}>
                          {t.fReachOpts[k]}
                        </button>
                      )
                    })}
                </div>
              </div>
              {/* Places owns this field once loaded, so browser autofill stays
                  off — the two together produce a half-filled address. */}
              <input type="text" name="address" ref={addrRef} placeholder={t.fAddress}
                aria-label={t.fAddress} autoComplete="off"
                onFocus={() => { setWantAddr(true); attachAddr() }}
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <textarea name="message" rows={3} placeholder={t.fMsg} aria-label={t.fMsg}
                value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <input type="text" name="company" tabIndex={-1} autoComplete="off"
                value="" onChange={() => {}} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden="true" />
              <button type="submit" className="sk-btn sk-btn-sky sk-btn-lg" disabled={sending}>
                {sending ? t.fSending : t.fSend}
              </button>
              {sent === 'ok' && <p className="sk-form-ok" role="status">{t.fOk}</p>}
              {sent === 'err' && (
                <p className="sk-form-err" role="alert">
                  {(t.fErrCodes && t.fErrCodes[errCode]) || t.fErrLead}{' '}
                  <a href={PHONE_TEL} dir="ltr" style={{ whiteSpace: 'nowrap' }}>{PHONE_SHOWN}</a>
                </p>
              )}
              {/* Why we're asking, next to where they type it — the address
                  field is optional and this is where doubt shows up. */}
              <p className="sk-form-privacy">{t.fPrivacy} <a href="/privacy">{t.fPrivacyLink}</a></p>
            </form>
            <p className="sk-prefer">
              {t.preferCall} <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a>
              {WHATSAPP_ENABLED && (
                <>&nbsp;·&nbsp;<a href={waHref} target="_blank" rel="noopener noreferrer">{t.waLabel}</a></>
              )}
            </p>
          </div>
        </section>

        <section className="sk-visit" id="visit">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.nav.visit}</span>
            <h2>{t.visitTitle}</h2>
            <div className="sk-visit-grid">
              <div className="sk-map-card">
                <iframe
                  src={`${MAPS_EMBED}&hl=${lang === 'he' ? 'iw' : 'en'}`}
                  title={t.visitTitle} loading="lazy" allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade" />
                {/* No own "open in Maps" button: Google's embed already renders
                    its own link (localised via the iframe's hl param), and two
                    buttons for one action read as a mistake (owner, 08-03). */}
              </div>
              <div className="sk-visit-info">
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><PinIcon /></span>
                  <div>
                    <strong>{t.addressLabel}</strong>
                    <p dir="ltr">{t.addressLine}</p>
                    <p>{t.findUs}</p>
                  </div>
                </div>
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><ClockIcon /></span>
                  <div><strong>{t.hoursLabel}</strong><p>{hours}</p></div>
                </div>
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><PhoneCallIcon /></span>
                  <div><strong>{t.phoneLabel}</strong><p><a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a></p></div>
                </div>
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><MailIcon /></span>
                  <div><strong>{t.emailLabel}</strong><p><a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a></p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="sk-foot">
          <div className="sk-wrap">
            <div className="sk-foot-grid">
              <div className="sk-foot-brand">
                <span className="sk-logo sk-foot-logo" role="img" aria-label={t.brandName} />
                <p dir="ltr">{t.addressLine}</p>
                <p><a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a></p>
                {WHATSAPP_ENABLED && (
                  <p><a href={waHref} target="_blank" rel="noopener noreferrer">{t.waLabel}</a></p>
                )}
                <p><a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a></p>
              </div>
              <nav className="sk-foot-col" aria-label={t.footServices}>
                <strong>{t.footServices}</strong>
                <a href="#mobile">{t.nav.mobile}</a>
                <a href="#travel">{t.nav.travel}</a>
                <a href="#intl">{t.nav.intl}</a>
                <a href="#services">{t.nav.repairs}</a>
                <a href="/repair">{t.nav.repair}</a>
              </nav>
              {/* No staff sign-in here — the public page is for customers;
                  staff go straight to /login (owner call, 08-04). */}
              {/* "New here?" used to sit above this and went to #contact — the
                  same place as "Message us" two links away. A second door into
                  one room is not a service, it is a thing to read and dismiss
                  (owner, 17 Aug: "why do we need new if it only directs to
                  contact us"). The account column now offers the one thing it
                  is for. */}
              <nav className="sk-foot-col" aria-label={t.footAccount}>
                <strong>{t.footAccount}</strong>
                <a href="/portal">{t.nav.account}</a>
              </nav>
              <nav className="sk-foot-col" aria-label={t.footLegal}>
                <strong>{t.footLegal}</strong>
                <a href="#faq">{t.nav.faq}</a>
            <a href="#visit">{t.nav.visit}</a>
                <a href="/privacy">{t.legalPrivacy}</a>
                <a href="/terms">{t.legalTerms}</a>
                <a href="/refund">{t.legalRefunds}</a>
              </nav>
            </div>
            <p className="sk-foot-legal">
              © {new Date().getFullYear()} {t.brandName}. {t.rights} {t.tradingName} <bdi>{legalIdentifier()}</bdi>
            </p>
          </div>
        </footer>

        <button type="button" className={`sk-top ${showTop ? 'show' : ''}`}
          onClick={() => window.scrollTo({ top: 0 })} aria-label={t.backTop} title={t.backTop}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* Only mounted once the address field has been touched — see wantAddr.
          The Maps key is referrer-restricted, so it is safe in the browser. */}
      {wantAddr && (
        <>
          <Script id="kc-maps-key" strategy="afterInteractive">
            {`window.KC_MAPS_KEY=${JSON.stringify(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '')};`}
          </Script>
          <Script src="/address-autocomplete.js" strategy="afterInteractive" onLoad={attachAddr} />
        </>
      )}
    </>
  )
}

// The --sk-* tokens this page is built from now live in styles/globals.css, so
// sign-in, the portal, /repair and /phone-guide render on the same scale
// instead of falling back to the app's ivory. Only page-specific rules below.
const SKY_CSS = `
  /* overflow-x must live on <html> only: any overflow value on <body> turns it
     into its own scroll container, which silently disables the sticky nav. */
  html{height:auto;overflow-x:hidden;overflow-y:auto}
  body{height:auto;overflow:visible}
  #__next{display:block;height:auto;overflow:visible}
  /* The sticky nav is 66px tall — keep anchor targets clear of it. */
  .sk [id]{scroll-margin-top:78px}
  @media (prefers-reduced-motion:no-preference){ html{scroll-behavior:smooth} }
  .sk *{box-sizing:border-box}
  .sk{background:var(--sk-paper);color:var(--sk-text);font-family:var(--sk-fbody);
    font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .sk a{color:inherit;text-decoration:none}
  .sk-wrap{max-width:var(--sk-maxw);margin:0 auto;padding:0 24px}
  .sk h1,.sk h2,.sk h4{font-family:var(--sk-fdisp);font-weight:800;letter-spacing:-.028em;margin:0;line-height:1.05}
  .sk-eyebrow{font-family:var(--sk-fbody);font-weight:700;font-size:12.5px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--sk-sky);display:block;margin-bottom:14px}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-eyebrow{color:var(--sk-sky-bright)}}
  :root[data-theme="dark"] .sk-eyebrow{color:var(--sk-sky-bright)}

  /* nav */
  .sk-nav-wrap{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--sk-paper) 88%,transparent);
    backdrop-filter:saturate(150%) blur(12px);border-bottom:1px solid var(--sk-line)}
  .sk-paid{background:#e8f6ee;border-bottom:1px solid #bfe5cd;color:#14532d}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-paid{background:#0e2b1c;border-bottom-color:#1e5c3a;color:#c7f0d8}}
  :root[data-theme="dark"] .sk-paid{background:#0e2b1c;border-bottom-color:#1e5c3a;color:#c7f0d8}
  .sk-paid-in{display:flex;align-items:center;gap:16px;padding:20px 24px}
  .sk-paid-tick{flex:none;width:40px;height:40px;border-radius:50%;background:#1a9a50;color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800}
  .sk-paid-txt{display:flex;flex-direction:column;gap:3px}
  .sk-paid-txt strong{font-family:var(--sk-fdisp);font-size:19.5px;letter-spacing:-.015em;line-height:1.2}
  .sk-paid-txt > span{font-size:15px;opacity:.92}
  .sk-paid-x{margin-inline-start:auto;background:none;border:0;color:inherit;font-size:26px;line-height:1;cursor:pointer;opacity:.7;padding:2px 8px}
  .sk-paid-x:hover{opacity:1}
  .sk-nav{display:flex;align-items:center;justify-content:space-between;height:66px;gap:14px}
  /* logo-full-tight.png is the artwork with its transparent padding cropped off —
     the original canvas is ~2/3 empty, which made the mark render ~11px tall. */
  /* Dark mode gets its own artwork rather than a filter: brightness(0)+invert
     flattened the whole mark to one flat white, losing the gold and the blue.
     -dark.png keeps the gold and lifts only the navy wordmark to near-white,
     so the brand still reads as the brand on the dark canvas. Background-image
     (not two <img>s) so only the theme's own file is ever fetched. */
  .sk-logo{height:32px;aspect-ratio:825/196;width:fit-content;display:block;
    background:url(/logo-full-tight.png) center/contain no-repeat}
  /* ?v=2 because the FILE changed on 17 Aug (white knock-out → the brand's own
     dark-theme blue) and next.config.js serves the logos as immutable for a
     year. Without a new URL every existing visitor keeps the old one until
     their cache expires. Bump this whenever a logo is edited in place. */
  :root[data-theme="dark"] .sk-logo{background-image:url("/logo-full-tight-dark.png?v=2")}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-logo{background-image:url("/logo-full-tight-dark.png?v=2")}}
  /* The row is a fixed run of nowrap items, so it cannot shrink — gap 20 once
     overflowed every desktop width (with the phone block still in the row).
     With the phone block gone the links only render at ≥~1260px, and gap 18
     measures clean at 1280–1320 with no overflow and no CTA clipping
     (verified in-browser 08-04); 12px read as cramped (owner). min-width:0
     stays so the row can never wedge the container open again. */
  .sk-nav-links{display:flex;align-items:center;gap:18px;min-width:0}
  /* The theme toggle is position:fixed at inset-inline-end:14px, so it floats
     over this bar at every width — it was sitting on top of "Message us" and
     clipping the word. Reserve its lane instead of letting it overlap. */
  .sk-nav{padding-inline-end:56px}
  /* 56px is a floor, not a preference: .theme-toggle is 38px wide at
     inset-inline-end:14px, so it occupies the last 52px of the bar at every
     width. A tighter lane puts the last item under it.

     This block used to also say padding-inline-end:44px, which would have
     done exactly that — it never fired only because the max-width:640px
     block further down re-states 56px and wins on source order. A dead
     declaration that was also wrong; removed rather than left to be
     "restored" by someone tidying the cascade. */
  @media (max-width:560px){
    .sk-nav{gap:8px}
  }
  .sk-navlink{color:var(--sk-muted);font-weight:600;font-size:14.5px;white-space:nowrap;
    border-bottom:2px solid transparent;padding-bottom:2px}
  .sk-navlink:hover{color:var(--sk-text)}
  .sk-navlink.on{color:var(--sk-sky);border-bottom-color:var(--sk-sky)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-navlink.on{color:var(--sk-sky-bright);border-bottom-color:var(--sk-sky-bright)}}
  :root[data-theme="dark"] .sk-navlink.on{color:var(--sk-sky-bright);border-bottom-color:var(--sk-sky-bright)}
  /* flex:none — as a shrinkable flex item the pill was being crushed to 2px on
     a phone, so the Hebrew/Yiddish switch was there but impossible to hit. */
  .sk-lang{display:inline-flex;flex:none;border:1px solid var(--sk-line);border-radius:999px;overflow:hidden}
  .sk-lang button{border:0;background:transparent;color:var(--sk-muted);font-weight:700;font-size:12.5px;
    padding:5px 11px;cursor:pointer}
  .sk-lang button.on{background:var(--sk-sky);color:#fff}
  /* back to top */
  .sk-top{position:fixed;bottom:22px;inset-inline-end:22px;z-index:40;width:44px;height:44px;
    border-radius:50%;border:1px solid var(--sk-line);background:var(--sk-paper);color:var(--sk-text);
    display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 16px rgba(10,21,38,.14);
    opacity:0;visibility:hidden;transform:translateY(8px);
    transition:opacity .2s var(--sk-ease-out),transform .2s var(--sk-ease-out),visibility 0s .2s}
  .sk-top.show{opacity:1;visibility:visible;transform:none;transition:opacity .2s var(--sk-ease-out),transform .2s var(--sk-ease-out)}
  .sk-top:hover{color:var(--sk-sky);border-color:var(--sk-sky)}
  :root[data-theme="dark"] .sk-top:hover{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-top:hover{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}}
  /* buttons */
  .sk-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35em;font-weight:700;
    border-radius:999px;cursor:pointer;transition:transform .12s var(--sk-ease-out),filter .12s var(--sk-ease-out);white-space:nowrap;
    border:0;font-family:inherit}
  /* Hover-lift only for a pointer that can actually hover: on touch a tap
     fires a synthetic :hover, so the button lurched up 1px on every press and
     the lift could stick until the next tap elsewhere (plans/003). Colour
     hovers (.sk-btn-sky brightness etc.) stay unguarded — colour is harmless
     on touch; it's the movement that reads as a glitch. */
  @media (hover:hover) and (pointer:fine){
    .sk-btn:hover{transform:translateY(-1px)}
  }
  .sk-btn:disabled{opacity:.6;cursor:default;transform:none}
  /* Scoped under .sk on purpose. The "a{color:inherit}" rule above is (0,1,1)
     and a bare .sk-btn-sky is only (0,1,0) — so every button that is an <a>
     lost its colour to the page ink and painted near-black on the blue pill
     (the form's <button>, untouched by that rule, stayed white: same class,
     two colours). .sk .sk-btn-* is (0,2,0) and wins. Keep the .sk prefix. */
  .sk .sk-btn-sky{background:var(--sk-sky);color:#fff}
  .sk .sk-btn-sky:hover{filter:brightness(1.08)}
  .sk .sk-btn-ghost{background:transparent;color:var(--sk-sky);border:1.5px solid var(--sk-sky)}
  /* The ghost button had no dark rule at all, in either form — the deep sky on
     the near-black paper is 2.86:1, and "My account" is the button a customer
     is looking for. Both halves, like everything else here. */
  :root[data-theme="dark"] .sk .sk-btn-ghost{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk .sk-btn-ghost{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}}
  .sk-btn-sm{padding:9px 17px;font-size:14px}
  .sk-btn-lg{padding:13px 26px;font-size:15.5px}

  /* hero — always the dark Sky banner, both themes, with a faint starfield */
  .sk-hero{position:relative;overflow:hidden;padding:88px 0 78px;
    background:radial-gradient(130% 150% at 14% 0%,#123a6b 0%,#0b2350 42%,#071634 100%);color:#eaf2ff}
  .sk-hero-stars{position:absolute;inset:0;pointer-events:none;opacity:.5;
    background-image:
      radial-gradient(1.4px 1.4px at 12% 22%,#cfe0f6 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 28% 62%,#9fc3ea 40%,transparent 41%),
      radial-gradient(1.5px 1.5px at 46% 14%,#eaf2ff 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 63% 44%,#bcd6f2 40%,transparent 41%),
      radial-gradient(1.6px 1.6px at 78% 20%,#eaf2ff 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 88% 58%,#9fc3ea 40%,transparent 41%),
      radial-gradient(1.3px 1.3px at 36% 82%,#cfe0f6 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 70% 78%,#bcd6f2 40%,transparent 41%),
      radial-gradient(1.4px 1.4px at 55% 30%,#eaf2ff 40%,transparent 41%)}
  .sk-hero .sk-wrap{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center}
  .sk-hero .sk-eyebrow{color:#7db8e6}
  .sk-hero h1{font-size:clamp(38px,7vw,74px);max-width:16ch;color:#fff;letter-spacing:-.035em;line-height:1.0}
  .sk-hero-body{color:#c4d4ee;max-width:47ch;margin:22px auto 0;font-size:clamp(16.5px,2.2vw,20px)}
  .sk-pill{display:inline-block;margin-top:22px;border:1px solid rgba(255,255,255,.22);
    border-radius:999px;padding:9px 18px;font-size:13.5px;font-weight:600;color:#cfe0f6;background:rgba(255,255,255,.05)}
  .sk-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px;justify-content:center}
  .sk-hero .sk-btn-ghost{color:#fff;border-color:rgba(255,255,255,.5)}
  .sk-hero .sk-btn-ghost:hover{background:rgba(255,255,255,.08)}
  .sk-hero-sub{color:#9fb4d6;max-width:46ch;margin:24px auto 0;font-size:15px}

  /* feature bands — centred, text only */
  .sk-band{padding:70px 0;border-bottom:1px solid var(--sk-line)}
  .sk-band-tint{background:var(--sk-band-alt)}
  .sk-band-inner{max-width:760px;margin:0 auto;text-align:center;display:flex;flex-direction:column;align-items:center}
  .sk-band-inner h2{font-size:clamp(26px,4vw,38px);line-height:1.08}
  /* The accent and the subline are ONE sentence broken over two lines
     ("Shabbos & Yom Tov / never charged — priced by the day"). At 34px against
     14.5px the eye took the accent as a finished headline and never travelled
     to the line that says what about it — so the claim read as a fragment.
     Closing the ratio from 2.3× to ~1.6× bound them together by SIZE. The
     spacing still said the opposite (owner, 20 Aug: "isnt the spacing here
     somewhat off?"): the gap was 4px above the accent and 5px below it, so the
     three lines sat evenly and nothing grouped. Allowing for line-height the
     optical gaps were ~7.6px above and ~10.1px below — the sentence was held
     LESS tightly to itself than to the headline it is not part of.
     Proximity is the strongest grouping cue there is, so it now says what is
     true — but the first attempt at that overshot: 16px above and NOTHING
     inside jammed the two lines together, and the owner said so straight away
     ("the close spacing is actually what made it akward"). Grouping needs the
     inner gap SMALLER than the outer one, not absent. 20px above, 8px inside:
     the pair reads as one phrase and each line still has air. */
  .sk-accent{font-family:var(--sk-fdisp);font-weight:800;font-size:clamp(21px,3vw,28px);
    color:var(--sk-sky);letter-spacing:-.02em;margin-top:20px;line-height:1.15}
  :root[data-theme="dark"] .sk-accent{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-accent{color:var(--sk-sky-bright)}}
  .sk-subline{color:var(--sk-gold-ink);font-size:17px;font-weight:600;margin-top:8px;
    font-style:italic;line-height:1.35}
  .sk-band-body{color:var(--sk-muted);margin:18px 0 0;font-size:16.5px;max-width:60ch}
  .sk-band-note{color:var(--sk-muted);margin:10px 0 0;font-size:15px;font-weight:600;max-width:60ch}
  .sk-band-price{color:var(--sk-muted);margin:12px 0 0;font-size:13.5px}
  .sk-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:22px 0 0}
  .sk-chips span{background:var(--sk-band);border:1px solid var(--sk-line);border-radius:999px;
    padding:7px 14px;font-size:13.5px;font-weight:600;color:var(--sk-text)}
  .sk-band-tint .sk-chips span{background:var(--sk-paper)}
  .sk-band-inner .sk-btn{margin-top:26px}

  /* more grid, grouped */
  .sk-also{padding:70px 0;background:var(--sk-band)}
  .sk-also h2{font-size:clamp(24px,3.6vw,34px);text-align:center}
  .sk-also-lead{color:var(--sk-muted);text-align:center;max-width:60ch;margin:12px auto 30px}
  .sk-group-label{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    color:var(--sk-muted);text-align:center;margin:26px 0 14px}
  .sk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .sk-tile{background:var(--sk-band-alt);border:1px solid var(--sk-line);border-radius:16px;padding:22px}
  a.sk-tile{color:inherit;text-decoration:none;display:block}
  .sk-tile-link:hover{border-color:var(--sk-sky)}
  .sk-tile-cta{display:inline-block;margin-top:10px;font-weight:700;font-size:14px;color:var(--sk-sky)}
  :root[data-theme="dark"] .sk-tile-cta{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-tile-cta{color:var(--sk-sky-bright)}}
  .sk-tile-ico{width:38px;height:38px;color:var(--sk-sky);margin-bottom:12px}
  :root[data-theme="dark"] .sk-tile-ico{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-tile-ico{color:var(--sk-sky-bright)}}
  .sk-tile-ico svg{width:100%;height:100%}
  .sk-tile h4{font-size:18px;margin:0 0 8px}
  .sk-tile p{color:var(--sk-muted);font-size:14.5px;margin:0}
  .sk-guide{text-align:center;margin-top:30px}
  .sk-guide a{color:var(--sk-sky);font-weight:700}
  :root[data-theme="dark"] .sk-guide a{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-guide a{color:var(--sk-sky-bright)}}
  /* friends — dark one-liner band */
  .sk-friends{background:radial-gradient(130% 150% at 84% 0%,#123a6b 0%,#0b2350 45%,#071634 100%);
    color:#eaf2ff;padding:60px 0;text-align:center}
  .sk-friends .sk-eyebrow{color:#7db8e6}
  .sk-friends-line{font-family:var(--sk-fdisp);font-weight:800;letter-spacing:-.02em;
    font-size:clamp(21px,3.2vw,30px);line-height:1.25;max-width:24ch;margin:0 auto;color:#fff}

  /* contact + message form */
  .sk-contact{padding:70px 0;background:var(--sk-band-alt);text-align:center}
  .sk-contact h2{font-size:clamp(24px,3.6vw,34px)}
  .sk-contact-lead{color:var(--sk-muted);max-width:52ch;margin:12px auto 26px}
  .sk-form{max-width:440px;margin:0 auto;display:flex;flex-direction:column;gap:12px;text-align:start}
  .sk-form input,.sk-form textarea{width:100%;padding:12px 14px;border:1px solid var(--sk-line);
    border-radius:12px;background:var(--sk-paper);color:var(--sk-text);font:inherit;font-size:15px}
  .sk-form textarea{resize:vertical;min-height:88px}
  .sk-form input:focus,.sk-form textarea:focus{outline:2px solid var(--sk-sky);outline-offset:1px;border-color:transparent}
  .sk-form .sk-btn{margin-top:2px}
  /* The optional block folded in from the old /join page. Kept visually quiet
     so the three fields that matter still read as the form. */
  .sk-form-reach{display:flex;flex-direction:column;gap:8px}
  .sk-form-hint{font-size:13px;color:var(--sk-muted);font-weight:600}
  .sk-form-privacy{margin:12px 0 0;font-size:12.5px;color:var(--sk-muted);line-height:1.5}
  .sk-faq{padding:74px 0}
  /* About-the-app: modest strip; exists chiefly for the OAuth review's
     homepage checklist, so it must stay real page copy, not footer print. */
  .sk-appinfo{padding:0 0 74px}
  .sk-appinfo p{margin:14px 0 0;max-width:70ch;color:var(--sk-muted);line-height:1.65;font-size:15px}
  .sk-appinfo-links{display:flex;gap:18px;flex-wrap:wrap}
  .sk-appinfo-links a{color:var(--sk-sky);font-weight:600;display:inline-flex;align-items:center;min-height:24px}
  :root[data-theme="dark"] .sk-appinfo-links a{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-appinfo-links a{color:var(--sk-sky-bright)}}
  .sk-faq-list{margin-top:26px;display:flex;flex-direction:column;gap:1px;
    background:var(--sk-line);border:1px solid var(--sk-line);border-radius:14px;overflow:hidden}
  .sk-faq-item{background:var(--sk-card)}
  .sk-faq-item summary{cursor:pointer;padding:18px 22px;font-size:16px;font-weight:600;
    color:var(--sk-text);list-style:none;display:flex;align-items:center;gap:12px;min-height:24px}
  .sk-faq-item summary::-webkit-details-marker{display:none}
  /* The marker is drawn, not a glyph, so it mirrors correctly in RTL. */
  .sk-faq-item summary::after{content:'';margin-inline-start:auto;flex:none;width:9px;height:9px;
    border-right:2px solid currentColor;border-bottom:2px solid currentColor;opacity:.45;
    transform:rotate(45deg);transition:transform .18s var(--sk-ease-out)}
  .sk-faq-item[open] summary::after{transform:rotate(-135deg)}
  .sk-faq-item summary:hover{color:var(--sk-sky)}
  .sk-faq-item summary:focus-visible{outline:2px solid var(--sk-sky);outline-offset:-2px}
  .sk-faq-item p{margin:0;padding:0 22px 20px;color:var(--sk-muted);line-height:1.65;font-size:15px}
  @media (max-width:560px){
    .sk-faq{padding:54px 0}
    .sk-faq-item summary{padding:16px 16px;font-size:15px}
    .sk-faq-item p{padding:0 16px 18px;font-size:14.5px}
  }
  .sk-form-privacy a{color:inherit;text-decoration:underline}
  /* Not .sk-chips — that is already the feature bands' tick list, and it
     carries justify-content:center and a 22px top margin this row must not
     inherit. */
  .sk-reach-chips{display:flex;flex-wrap:wrap;gap:8px}
  .sk-reach-chip{padding:8px 14px;border:1px solid var(--sk-line);border-radius:999px;
    background:var(--sk-paper);color:var(--sk-text);font-family:inherit;font-size:14px;
    font-weight:600;cursor:pointer;min-height:24px;transition:border-color .15s,background .15s}
  .sk-reach-chip:hover{border-color:var(--sk-sky)}
  .sk-reach-chip:focus-visible{outline:2px solid var(--sk-sky);outline-offset:2px}
  .sk-reach-chip[aria-checked="true"]{background:var(--sk-sky);border-color:var(--sk-sky);color:#fff}
  :root[data-theme="dark"] .sk-reach-chip[aria-checked="true"]{background:var(--sk-sky-bright);color:#08122b}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-reach-chip[aria-checked="true"]{background:var(--sk-sky-bright);color:#08122b}}
  .sk-form-ok{color:#1a7f4b;font-size:14px;margin:2px 0 0;font-weight:600}
  .sk-form-err{color:var(--sk-gold-ink);font-size:14px;margin:2px 0 0;font-weight:600}
  :root[data-theme="dark"] .sk-form-ok{color:#5fd08a}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-form-ok{color:#5fd08a}}
  .sk-prefer{color:var(--sk-muted);font-size:14px;margin:24px auto 0;max-width:60ch}
  .sk-prefer a{color:var(--sk-sky);font-weight:700}
  :root[data-theme="dark"] .sk-prefer a{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-prefer a{color:var(--sk-sky-bright)}}
  /* visit — live map card + shop details */
  .sk-visit{padding:70px 0 76px;background:var(--sk-band);text-align:center}
  .sk-visit h2{font-size:clamp(24px,3.6vw,34px)}
  .sk-visit-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;margin-top:32px;text-align:start}
  .sk-map-card{position:relative;border:1px solid var(--sk-line);border-radius:16px;overflow:hidden;
    background:var(--sk-band-alt);display:flex;min-height:380px}
  .sk-map-card iframe{border:0;width:100%;min-height:380px;flex:1;display:block}
  /* Top corner, not bottom-left: Google's embed puts its logo and the place
     thumbnail bottom-left and the "Map data / Terms" attribution bottom-right,
     and the button sat squarely on top of them — hiding attribution we are
     required to leave visible. The top edge is clear in this embed. */
  .sk-map-open{position:absolute;top:14px;inset-inline-end:14px;box-shadow:0 4px 14px rgba(7,22,52,.35)}
  .sk-visit-info{border:1px solid var(--sk-line);border-radius:16px;background:var(--sk-band-alt);
    padding:26px 24px;display:flex;flex-direction:column;gap:20px;justify-content:center}
  .sk-visit-row{display:flex;gap:12px}
  .sk-visit-ico{flex:none;width:20px;height:20px;color:var(--sk-sky);margin-top:3px}
  :root[data-theme="dark"] .sk-visit-ico{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-visit-ico{color:var(--sk-sky-bright)}}
  .sk-visit-ico svg{width:100%;height:100%}
  .sk-visit-row strong{display:block;font-size:14.5px;margin-bottom:2px}
  /* text-wrap:balance evens these short blocks out instead of leaving a stub
     last line. Browsers that do not support it still get no orphan here: the
     copy ties "level 2." / "קומה 2." together with a non-breaking space, so
     the floor number can never end up alone on a line of its own. */
  .sk-visit-row p{margin:0;color:var(--sk-muted);font-size:14px;line-height:1.55;
    text-wrap:balance}
  .sk-visit-row a{color:var(--sk-sky);font-weight:600}
  :root[data-theme="dark"] .sk-visit-row a{color:var(--sk-sky-bright)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-visit-row a{color:var(--sk-sky-bright)}}
  /* footer — labelled columns */
  .sk-foot{background:var(--sk-band);border-top:1px solid var(--sk-line);padding:48px 0 40px}
  .sk-foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:26px;align-items:start;text-align:start}
  .sk-foot-logo{height:36px;margin-bottom:12px}
  /* overflow-wrap:anywhere, not break-word: only "anywhere" lowers the
     element's MIN-CONTENT contribution, and min-content is what a track
     floors at. (No backticks in this comment — the whole stylesheet is a JS
     template literal, and one would end the string mid-file.)
     support@kosher-connect.com is a single 151px unbreakable token, so the
     footer's auto-sized column could not go below it — and at 320px that made
     the whole page 337px wide, every section stretched to match. break-word
     would wrap the text on screen and still leave the track wedged open. */
  .sk-foot-brand p{margin:6px 0 0;color:var(--sk-muted);font-size:13.5px;overflow-wrap:anywhere}
  .sk-foot-brand a{color:var(--sk-muted)}
  .sk-foot-brand a:hover{color:var(--sk-text)}
  .sk-foot-col{display:flex;flex-direction:column;gap:9px}
  .sk-foot-col strong{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
    color:var(--sk-text);margin-bottom:2px}
  .sk-foot-col a{color:var(--sk-muted);font-size:14px}
  .sk-foot-col a:hover{color:var(--sk-text)}
  .sk-foot-legal{color:var(--sk-muted);font-size:13px;margin:30px 0 0;padding-top:18px;
    border-top:1px solid var(--sk-line);line-height:1.7}

  /* reveal — additive on purpose: content ships visible, and only once JS has
     marked the root .js-on does it hide pre-scroll. Without JS (blocked, slow,
     or crashed) the hidden state never applies, so the page below the hero —
     including the contact form — still reads. The reduce rule repeats the
     .js-on selector because the scoped hidden rule is three classes deep and
     would otherwise out-rank it. */
  .sk-reveal{transition:opacity .6s var(--sk-ease-out),transform .6s var(--sk-ease-out)}
  .js-on .sk-reveal:not(.in){opacity:0;transform:translateY(16px)}
  .sk-reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){
    .sk-reveal,.js-on .sk-reveal:not(.in){opacity:1;transform:none;transition:none}
  }

  /* WCAG 2.5.8 — 24×24. The footer's link columns are seven stacked standalone
     links (Mobile & SIM, Questions, Privacy…) at a 22px line box with a 9px
     gap: a list of thumb targets on the page most visitors meet on a phone.
     The exception 2.5.8 grants to a link inside a sentence does not cover a
     nav list. Scoped to a coarse pointer, matching the staff-side rule — the
     case that matters is a touch device, not a narrow window. min-height only,
     so the type and spacing are unchanged; each link grows by 2px. */
  @media (pointer:coarse){
    .sk-foot-col a{display:flex;align-items:center;min-height:24px}
    .sk-brand{min-height:24px}
    /* The two standalone links under the services grid ("Choosing a handset?
       See the phone guide", "Something broken? Book a repair") are their own
       centred rows, not links inside a paragraph, so the exception does not
       reach them either. */
    .sk-guide a{display:inline-flex;align-items:center;min-height:24px}
    /* The phone number and support address, in the "Visit us" block and again
       in the footer's brand column. Each stands alone in its own <p>, so the
       inline-in-a-sentence exemption does not reach them — and these two are
       what a customer taps when something has gone wrong. */
    .sk-visit-row a, .sk-foot-brand a{display:inline-flex;align-items:center;min-height:24px}
  }
  @media (max-width:960px){ .sk-foot-grid{grid-template-columns:1fr 1fr} }
  /* One column on phones. Two 130px-ish tracks made "International numbers"
     wrap onto three lines and left the columns reading as a puzzle; a footer
     is a list, and on a phone a list is one column. */
  @media (max-width:560px){ .sk-foot-grid{grid-template-columns:1fr;gap:22px} }
  /* The link row needs 1009px beside the logo; the container only offers that
     from 1280px up once the toggle's lane is reserved. Hand over to the chip
     strip below that rather than let the bar overflow — the old 960 breakpoint
     left every width from 961 to 1280 permanently broken. */
  @media (max-width:1279px){ .sk-navlink{display:none} }
  /* Mobile section chips (hidden on desktop, where the nav links exist) */
  .sk-mobnav{display:none}
  /* The CTA only joins the chips on phones — above 640px it is in the bar. */
  .sk-mobnav-cta{display:none}
  @media (max-width:1279px){
    /* Must not grow to the chip row's content width — the nav scrolls
       INSIDE it. Without these the wrapper stretched to 679px and took
       the whole page sideways with it. */
    .sk-mobnav-wrap{position:relative;width:100%;min-width:0;max-width:100vw;overflow:hidden}
    /* Trailing fade = "there is more this way". Logical inset, so it sits on
       the correct edge in RTL. Pointer-events off so it never eats a tap. */
    .sk-mobnav-wrap::after{content:'';position:absolute;inset-block:0;inset-inline-end:0;
      width:34px;pointer-events:none;
      background:linear-gradient(to left,var(--sk-bg) 12%,transparent)}
    [dir="rtl"] .sk-mobnav-wrap::after{background:linear-gradient(to right,var(--sk-bg) 12%,transparent)}
    .sk-mobnav{display:flex;gap:8px;overflow-x:auto;padding:0 16px 10px;
      -webkit-overflow-scrolling:touch;scrollbar-width:none}
    .sk-mobnav::-webkit-scrollbar{display:none}
    .sk-mobnav a{flex:none;font-size:13px;font-weight:600;color:var(--sk-muted);
      border:1px solid var(--sk-line);border-radius:999px;padding:6px 12px;line-height:1.2}
    .sk-mobnav a.on{color:var(--sk-sky);border-color:var(--sk-sky)}
    :root[data-theme="dark"] .sk-mobnav a.on{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}
    @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-mobnav a.on{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}}
    /* Taller sticky header on phones (bar + chips) — keep anchors clear of it. */
    .sk [id]{scroll-margin-top:122px}
  }
  /* Keep the nav's CTA clear of the fixed theme toggle on phones. That 60px,
     plus the logo and both buttons, added up to 511px of bar in a 390px
     viewport — "Message us" sat 61px off the right edge. The account link goes
     (it's in the footer's "Your account" column); logo and CTA get compact. */
  @media (max-width:640px){
    .sk-nav{padding-inline-start:16px;padding-inline-end:56px}
    .sk-nav .sk-logo{height:26px}
    @media (max-width:560px){.sk-nav .sk-logo{height:22px}}
    /* Phones: the bar keeps identity and language, and every ACTION moves to
       the chip row directly beneath it.

       Laying out logo + language + CTA needed 386px, so the bar overflowed
       every common phone and only fitted from ~387px up: 320 by 66px, 360 by
       26, and the 375 of an iPhone SE. 390 "passed" with nothing to spare,
       which is not passing — one longer translation and it breaks again.
       Shaving the logo, the pill, the gap and the button all at once could
       just about reach 320 and would leave every one of them one word from
       overflowing. Moving the CTA out buys 133px in one move, and the row it
       moves to is already this page's phone navigation, is inside the same
       sticky header, and needs no scrolling to see. */
    .sk-nav .sk-btn-ghost, .sk-nav .sk-btn-sky{display:none}
    /* Filled, so it still reads as the action and not as a section link.
       First in the DOM, so it is the one chip that is always in view. */
    .sk-mobnav a.sk-mobnav-cta{display:block;background:var(--sk-sky);
      border-color:var(--sk-sky);color:#fff;font-weight:700}
    /* The scrollspy only lights ids it tracks and #contact is not one, but
       keep the filled treatment if that ever changes. */
    .sk-mobnav a.sk-mobnav-cta.on{color:#fff;border-color:var(--sk-sky)}
  }
  @media (max-width:820px){ .sk-grid{grid-template-columns:1fr} .sk-visit-grid{grid-template-columns:1fr} .sk-map-card{min-height:300px} .sk-map-card iframe{min-height:300px} }

  /* ── PROTOTYPE, off unless :root[data-sk="calm"] ────────────────────────
     The four findings from the 24 Aug design audit that survived a second
     look. Inert by default — exactly like the light-rail prototype — so the
     page a customer sees is unchanged until the owner has judged these.
     If adopted, each one becomes a real edit (markup deleted, base values
     changed) rather than an override; display:none is how you AUDITION a
     removal, not how you ship one.

     1. NINE EYEBROWS. Uppercase letter-spaced labels above nine of the page's
        sections. As a device they mark a chapter; used on every section they
        mark nothing — and four of them restate the heading directly beneath
        ("Message us" over "Send us a message", "Common questions" over "The
        things people ring up and ask", "Visit us" over "Come and see us",
        "The Kosher Connect app" over "Your account online"). Those four go.
        The other five stay and the reason is in each: the hero's carries the
        town, the three band labels are the words the nav links use — with a
        scrollspy lighting them, the label confirms you arrived where you
        clicked — and "Why people send their friends" has no heading under
        it, so it IS the heading. */
  :root[data-sk="calm"] .sk-faq .sk-eyebrow,
  :root[data-sk="calm"] .sk-appinfo .sk-eyebrow,
  :root[data-sk="calm"] .sk-contact .sk-eyebrow,
  :root[data-sk="calm"] .sk-visit .sk-eyebrow{display:none}

  /*  2. ONE RHYTHM FOR EVERY SECTION. Eight sections at 70–76px top and
        bottom, so the page scrolls at a metronome tick and nothing is
        louder than anything else. Padding is the cheapest way to say what
        matters. The pitch (the three bands) gets air; the list of extras
        gets tightened because it is a list; the one-line "why people send
        their friends" gets least, because a single sentence between two
        big sections is punctuation, not a chapter. */
  :root[data-sk="calm"] .sk-band{padding:84px 0}
  :root[data-sk="calm"] .sk-also{padding:56px 0}
  :root[data-sk="calm"] .sk-friends{padding:44px 0}
  :root[data-sk="calm"] .sk-faq{padding:62px 0}
  :root[data-sk="calm"] .sk-contact{padding:66px 0}
  :root[data-sk="calm"] .sk-visit{padding:62px 0 68px}
  /* The phone already tightens the FAQ (74→54 in the max-width:560px block).
     A flat calm value out-specifies that and made the section BIGGER on a
     phone than it is today — the opposite of the finding. Keep the same
     ratio the phone rule chose, against the new desktop number. */
  @media (max-width:560px){ :root[data-sk="calm"] .sk-faq{padding:46px 0} }

  /*  3. EVERYTHING FADES UP. Nine blocks carry .sk-reveal, so the page never
        settles: something is always arriving. Keep the entrance where it is
        an entrance — the three feature bands, which are the argument, read
        as one orchestrated run — and let the practical half of the page
        simply BE there when the reader arrives at it. Someone scrolling to
        find the phone number should not have to wait for it to animate. */
  :root[data-sk="calm"] .js-on .sk-also .sk-reveal:not(.in),
  :root[data-sk="calm"] .js-on .sk-friends .sk-reveal:not(.in),
  :root[data-sk="calm"] .js-on .sk-faq .sk-reveal:not(.in),
  :root[data-sk="calm"] .js-on .sk-contact .sk-reveal:not(.in),
  :root[data-sk="calm"] .js-on .sk-visit .sk-reveal:not(.in){opacity:1;transform:none}

  /*  4. THE ITALIC SUBLINE. Tier three of every band heading is italic. An
        italicised line inside an otherwise upright heading stack is one of
        the most reliable generated-page tells, and this one does not need
        it: the line is already gold and already 600, which is two signals
        of difference before the slant. Roman, and nothing else changes. */
  :root[data-sk="calm"] .sk-subline{font-style:normal}
`
