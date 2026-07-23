// Snapshot of the ELID (MOR) reseller's user accounts, captured from the ELID
// admin Users list (23 Jul 2026). The reseller API user can't call users_get
// ("Access Denied"), so this seed is how the import/review tool knows which
// accounts exist. Usernames only — the importer looks each one up live to get
// the real name + balance before creating anything, so this list going a little
// stale only affects which accounts are OFFERED, never the data written.
export const ELID_ACCOUNTS = [
  'Arale-toisig', 'avrohom-kalmenovits', 'Aysterlits', 'babbygrinfeld', 'Betsalel-luntser',
  'betsalel-rapaport', 'Binem-feldmanj', 'Binyomin-ollech', 'burech-y-taitelbam', 'Burech-y-teitelbaum',
  'Burech-y-Teitelbaum-new', 'chaim-lemberger', 'chaim-rosen', 'chaskel-lamm', 'Dov-Doitsch',
  'dovid-malul', 'dovid-frishman', 'dovid-priever', 'eber-englander', 'efroim-lee',
  'Elchonon-Houchauser', 'eliezer-zanbel', 'Elozor-Zilber', 'Elye-abitan', 'fishel-thaler',
  'Floor-mordche', 'getzl-gross', 'goldman-grosman', 'grinfeld-mordche', 'Harav-Pollak',
  'hershi-kraus', 'hershl-glick', 'hershy-gross', 'HomeCorner', 'israel-geldsailer',
  'isreal-hersh-friedman', 'kosher-connect-phone', 'kosher-connect-rental', 'laibl-tauber', 'laiby-enden',
  'mailech-grinfeld', 'Mammy-home', 'manachem-tambur', 'Mayer-Gottesman', 'mayer-grinhot',
  'Mechel-Kahana', 'mechlileber', 'mechl-lieber', 'Mechl-lieber-rental', 'menachem-d-grossman',
  'menachem-glick', 'Menachem-simon-home', 'mendl-horowits', 'Mendl-hersh-grinfeld', 'Meshilem-roitenbarg',
  'michaelber-hartman', 'moishe-rubinshtain', 'Moishe-Bodner', 'moishe-grinfeld-antwerp', 'moishe-mayer',
  'Moishe-y-ruach', 'moishe-yosi-roitenbarg', 'mordche-z-perlman', 'mosheyoeltaitelbaum', 'mrs-erlanger',
  'mrs-feld', 'mrs-gross', 'Naftaly-foigel', 'naftaly-kalish', 'Naftaly-Padwa-playground',
  'Naftaly-shvarts', 'noson-simche-knephler', 'nuchem-danstiger', 'osher-jung', 'osher-rothbart',
  'Osher-shtark', 'Phone-Rentals', 'pinches-foigel', 'pinches-krishevsky', 'rachel-samet',
  'refoel-kohn', 'Reiven-y-austerlits', 'Rental-B458283861', 'rental-us-1284', 'Satmar11',
  'shauli-vercberger', 'shechter-mrs', 'shimshon-taub', 'shloime-grinfeld', 'Shloime-unger',
  'Shloime-m-Mandelbaum', 'Shloimegrinfeld-home', 'Shmiel-halpern', 'shmiel-shpiro', 'shmuel-bleier',
  'sholom-piller', 'sholom-shapiro', 'sholom-shapiro2', 'shulem-dovid-friezel', 'Shulem-Shapiro',
  'simcha-adler', 'test-company', 'test-uk', 'test_kc', 'toibe_grinfeld',
  'Toive-fekete-usa', 'Usher-zusman', 'work-zone-mcr', 'yakov-eichental', 'yakov-tsan',
  'yakov-horowits', 'yechezkel-lam', 'yechezkel-taitelbaum', 'Yechiel-Chaim-halberstam', 'yechiel-schenk',
  'yehoisha-broier', 'yehoisha-lebracht', 'yehoishe-lebowits', 'yehoishe-valdman', 'yehoishe-gross',
  'Yehoishe-hoffmann', 'Yehuda-altovsky', 'Yekisiel-zalmen-lee', 'yeshay-bergl', 'yeshaye-shneck',
  'yeshaye-dimand', 'yidl-fisher', 'yidl-wosner', 'Yisrael-Melul', 'yisroel-tsuker',
  'yissochor-kahanah', 'Yissochor-dov-rotter', 'yissochr-dov-rotter-callingcard', 'yitschock-shloim-grinfeld', 'yitschock-shloime-gross',
  'Yochenen-pinches-tversky', 'yoel-horowits', 'yoel-kahana', 'Yosef-chaim-cohen-london', 'yosef-y-matyash',
  'Yossef-askal', 'yossef-hersh-rosenberg', 'yossy-adler', 'Zalmen-laib-daitch', 'Zalmen-Rapaport',
  'zev-elimelech-fried',
]

// Accounts that are NOT real people — internal lines, rentals, test rows. The
// importer pre-unticks these so they aren't created as customers by accident.
export function elidIsInternal(username) {
  return /test|rental|playground|call(ing)?card|home$|homecorner|mammy|work.?zone|not.?in.?use|satmar\d|kosher.?connect|phone.?rentals/i
    .test(String(username || ''))
}
