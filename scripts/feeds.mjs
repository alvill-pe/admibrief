// Fuentes de Pulso Empresarial. Todas son RSS públicos de los medios.
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

  // ---------- Economía (general) ----------
  // general: el feed mezcla de todo (deportes, series, etc.); solo se guardan las notas que tratan de economía o negocios
  { sec: 'eco',   name: 'Gestión',       url: 'https://gestion.pe/arcio/rss/', general: true }
];

// Secciones de las URL que no interesan (deporte, espectáculos, etc.)
export const EXCLUDE_URL = /\/(deportes?|futbol|deporte-total|espectaculos|entretenimiento|tvmas|luces|horoscopo|signos|somos|viu|provecho|respuestas|celebridades|farandula|cine|musica|videojuegos|loterias?|virales|gastronomia|estilos?|cultura|vamos|mag|wuf|ocio|trome|mujer|familia|elecciones-resultados)\//i;
export const EXCLUDE_TITLE = /(EN VIVO|minuto a minuto|hor[oó]scopo|loter[ií]a|la tinka|k[aá]bala|d[oó]nde ver|a qu[eé] hora juega|qu[eé] canal|crucigrama|sudoku|resultados onpe al|conteo oficial|ver aqu[ií] el|link para ver|\bWWE\b|\bNFL\b|\bNBA\b|\bMLB\b|\bNHL\b|Premier League|Super Bowl|predictions|box office|wordle|crossword|quordle|horoscope)/i;

// ---------- Filtro de tema: solo política, economía, negocios y mundo ----------
const SPORTS = /(f[uú]tbol|liga mx|liga 1\b|liga profesional|champions league|europa league|copa (libertadores|sudamericana|am[eé]rica|del mundo)|eliminatorias|selecci[oó]n (peruana|nacional)|mundial (de clubes|sub|femenino)|fecha \d+ (del|de la) (torneo|liga|apertura|clausura)|torneo (apertura|clausura)|tabla de posiciones|alianza lima|universitario de deportes|sporting cristal|boca juniors|real madrid|\bTUDN\b|\bESPN\b|\bUFC\b|f[oó]rmula 1|\bF1\b|gran premio|tenis|atletismo|v[oó]ley|c[oó]mo mirar|a qu[eé] hora (juega|sonar[aá])|resultado del partido|la ?liga\b|jornada \d+|\b\d{1,2}-\d{1,2}\b.{0,40}(fecha|jornada|liga|copa)|\bvs\.? [A-ZÁÉÍÓÚ][\w. ]{2,30} (por|en) (la|el) )/i;
const ENTERTAINMENT = /(netflix|disney\+|prime video|hbo max|star\+|k-?dramas?|telenovela|\breality\b|miss (per[uú]|universo|mundo)|top 11|far[aá ]ndula|cantante|actriz|concierto|pel[ií]cula|estreno de|streaming|chisme|\btarot\b|hor[oó]scopo|receta|recetas|mascotas?|viral|tiktok|influencer|serie de (netflix|suspenso|tv))/i;
const BUSINESS_OVERRIDE = /(econ[oó]m|S\/\s?\d|US\$|millones|empresa|inversi[oó]n|ingresos|ventas|sunat|impuesto|exporta|importa|\bPBI\b|inflaci[oó]n|mercado|presupuesto|congreso|gobierno|ministerio)/i;
const ECON = /(econ[oó]m|empres|negocio|mercado|inversi|inflaci|d[oó]lar|tipo de cambio|bolsa|\bBVL\b|\bBCR\b|\bBCRP\b|banco|cr[eé]dito|pr[eé]stamo|deuda|tribut|impuesto|sunat|aranc|exporta|importa|\bPBI\b|crecimiento|empleo|desempleo|sueldo|salario|remuneraci|\bAFP\b|pensi[oó]n|precio|tarifa|combustible|petr[oó]leo|cobre|oro\b|miner|agro|pesca|energ|el[eé]ctric|gas natural|proyecto|capacidad|planta|infraestructura|constru|inmobil|vivienda|turismo|aerol|transporte|log[ií]stic|puerto|telecom|tecnolog|inteligencia artificial|\bIA\b|comercio|industria|producci[oó]n|consumo|ventas|ingresos|utilidad|ganancia|p[eé]rdida|presupuesto|fiscal|MEF\b|ministerio de econom|bcp\b|interbank|bbva|scotiabank|startup|emprend|pyme|mype|inversionista|finanzas|financ|seguros?\b|reforma|ley\b|congreso|gobierno|ministro|presidente|elecci|pol[ií]tic)/i;

// true = la nota no corresponde a la app (deportes, espectáculos, recetas...) o, en un feed general, no trata de economía
export function offTopic(feed, title, desc) {
  const text = title + ' ' + (desc || '').slice(0, 300);
  if (BUSINESS_OVERRIDE.test(title)) return false;
  if (SPORTS.test(text) || ENTERTAINMENT.test(text)) return true;
  if (feed && feed.general && !ECON.test(text)) return true;
  return false;
}
