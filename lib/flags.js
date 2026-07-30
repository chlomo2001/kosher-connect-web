// Channel switches. Small, boring, one place to flip.
//
// WHATSAPP_ENABLED — off since 30/07/2026 at the owner's request ("strip
// whatsapp all over in the meantime"). Off hides the customer-facing
// "WhatsApp us" links on /welcome, drops WhatsApp from the /join preferred-
// contact chips, and hides the staff "Open in WhatsApp" buttons and the
// customer Has-WhatsApp checkbox. Stored has_whatsapp values are left alone,
// so turning this back on restores the data with it.
//
// public/main.js carries its own copy of this constant — it is a plain browser
// script, not a module, so it cannot import from here. Change both together.
export const WHATSAPP_ENABLED = false
