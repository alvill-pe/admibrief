// Fuentes de AdmiBrief. Todas son RSS públicos de los medios.
// full: el feed trae el texto completo de la nota (content:encoded).
// scrape: hay que leer la página de la nota para obtener el texto.
export const FEEDS = [
  // ---------- Perú ----------
  { sec: 'peru',  name: 'El Comercio', url: 'https://elcomercio.pe/arcio/rss/category/peru/' },
  { sec: 'peru',  name: 'Gestión',     url: 'https://gestion.pe/arcio/rss/category/peru/' },
  { sec: 'peru',  name: 'Infobae Perú', url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/peru/' },
  { sec: 'peru',  name: 'Andina',      url: 'https://andina.pe/agencia/rss.aspx', scrape: true },
  { sec: 'peru',  name: 'RPP',         url: 'https://rpp.pe/rss', scrape: true },

  // ---------- Política ----------
  { sec: 'pol',   name: 'El Comercio', url: 'https://elcomercio.pe/arcio/rss/category/politica/' },
  { sec: 'pol',   name: 'La República', url: 'https://larepublica.pe/rss/politica.xml' },

  // ---------- Economía ----------
  { sec: 'eco',   name: 'Gestión',     url: 'https://gestion.pe/arcio/rss/category/economia/' },
  { sec: 'eco',   name: 'El Comercio', url: 'https://elcomercio.pe/arcio/rss/category/economia/' },
  { sec: 'eco',   name: 'La República', url: 'https://larepublica.pe/rss/economia.xml' },
  { sec: 'eco',   name: 'Gestión',     url: 'https://gestion.pe/arcio/rss/category/tu-dinero/' },

  // ---------- Mundo ----------
  { sec: 'world', name: 'El Comercio', url: 'https://elcomercio.pe/arcio/rss/category/mundo/' },
  { sec: 'world', name: 'Gestión',     url: 'https://gestion.pe/arcio/rss/category/mundo/' },
  { sec: 'world', name: 'La República', url: 'https://larepublica.pe/rss/mundo.xml' },
  { sec: 'world', name: 'Infobae',     url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/america/' },
  { sec: 'world', name: 'BBC Mundo',   url: 'https://feeds.bbci.co.uk/mundo/rss.xml', scrape: true },

  // ---------- Salud ----------
  // (además, la app pasa a «Salud» las notas de salud de las otras fuentes: Minsa, EsSalud, hospitales, dengue, etc.)
  { sec: 'salud', name: 'Infobae Salud', url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/salud/' },

  // ---------- Negocios y prensa global ----------
  // brief: el medio solo publica un adelanto en su RSS (no se lee la página: puede tener muro de pago)
  { sec: 'biz', name: 'Bloomberg Línea', url: 'https://www.bloomberglinea.com/arc/outboundfeeds/rss/?outputType=xml' },
  { sec: 'biz', name: 'Expansión',       url: 'https://e00-expansion.uecdn.es/rss/portada.xml', brief: true },
  { sec: 'biz', name: 'Fortune',         url: 'https://fortune.com/feed/', lang: 'en' },
  { sec: 'biz', name: 'Harvard Business Review', url: 'http://feeds.hbr.org/harvardbusiness', lang: 'en', brief: true, maxAge: 168 },
  { sec: 'biz', name: 'Forbes',          url: 'https://www.forbes.com/business/feed/', lang: 'en', brief: true },

  // ---------- Economía (general) ----------
  { sec: 'eco',   name: 'Gestión',       url: 'https://gestion.pe/arcio/rss/' }
];

// Secciones de las URL que no interesan (deporte, espectáculos, etc.)
export const EXCLUDE_URL = /\/(deportes?|futbol|deporte-total|espectaculos|entretenimiento|tvmas|luces|horoscopo|signos|somos|viu|provecho|respuestas|celebridades|farandula|cine|musica|videojuegos|loterias?|virales|gastronomia|estilos?|cultura|vamos|mag|wuf|ocio|trome|mujer|familia|elecciones-resultados)\//i;
export const EXCLUDE_TITLE = /(EN VIVO|minuto a minuto|hor[oó]scopo|loter[ií]a|la tinka|k[aá]bala|d[oó]nde ver|a qu[eé] hora juega|qu[eé] canal|crucigrama|sudoku|resultados onpe al|conteo oficial|ver aqu[ií] el|link para ver|\\bWWE\\b|\\bNFL\\b|\\bNBA\\b|\\bMLB\\b|\\bNHL\\b|Premier League|Super Bowl|predictions|box office|wordle|crossword|quordle|horoscope)/i;
