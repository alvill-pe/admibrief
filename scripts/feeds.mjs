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

  // ---------- Administración, empresas, marketing y tecnología ----------
  { sec: 'adm',   name: 'Mercado Negro', url: 'https://www.mercadonegro.pe/feed/' },
  { sec: 'adm',   name: 'El Comercio Tecnología', url: 'https://elcomercio.pe/arcio/rss/category/tecnologia/' }
];

// Secciones de las URL que no interesan (deporte, espectáculos, etc.)
export const EXCLUDE_URL = /\/(deportes?|futbol|deporte-total|espectaculos|entretenimiento|tvmas|luces|horoscopo|signos|somos|viu|provecho|respuestas|celebridades|farandula|cine|musica|videojuegos|loterias?|virales|gastronomia|estilos?|cultura|vamos|mag|wuf|ocio|trome|mujer|familia|salud\/bienestar|elecciones-resultados)\//i;
export const EXCLUDE_TITLE = /(EN VIVO|minuto a minuto|hor[oó]scopo|loter[ií]a|la tinka|k[aá]bala|d[oó]nde ver|a qu[eé] hora juega|qu[eé] canal|crucigrama|sudoku|resultados onpe al|conteo oficial|ver aqu[ií] el|link para ver)/i;
